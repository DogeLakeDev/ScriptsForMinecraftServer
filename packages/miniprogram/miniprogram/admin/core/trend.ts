/**
 * trend.ts — 总览页趋势图的采样窗口与断线
 *
 * 使用场景：overview 按用户选择的 15 分钟 / 1 小时 / 一天，把 metrics.read 的历史收成折线数据。
 * 断线规则与桌面端 renderer/lib/metric-series.ts 的 trendPoints 相同（重启、采样间隔过大不连线，不补造点）。
 * 桌面端那份会引用主题模块，不能整文件打进小程序 vendor，因此算法在这里保持一份同步实现。
 */
import type { MetricsResult, MetricsSample, ResourceSample } from "../../core/types";

/** 可选的时间范围，与桌面端 MetricMinutes 相同。默认仍是 1 小时。 */
export const METRIC_SPANS = ["15", "60", "1440"] as const;
export type MetricSpan = (typeof METRIC_SPANS)[number];

/** 运行指标的基础断线间隔（毫秒），与桌面端 scalarLine / entityLines 的 baseGap 相同 */
const RUNTIME_GAP_MS = 20_000;
/** 内存指标的基础断线间隔（毫秒），与桌面端 memoryLines 的 baseGap 相同 */
const RESOURCE_GAP_MS = 45_000;

/**
 * 图表用色：色板变量名（--chart-1 … --chart-8），下标与 packages/ui/src/theme.ts 的 CHART_COLORS 一致。
 * 总览原先的三条线继续用蓝 / 绿 / 紫，新增的进程与实体曲线沿用桌面端的下标。
 * 实际颜色由 build-assets.mjs 按 iOS 强调色生成（scripts/ios-palette.mjs 的 IOS_CHART_COLORS）：
 * 折线图用 core/palette.ts 按当前主题解析，图例圆点在 wxml 里写成 var(变量名)，两处随深浅色一起切换。
 */
const CHART_COLORS = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5", "--chart-6", "--chart-7", "--chart-8"] as const;
/** TPS 与在线玩家两张单线图的颜色（图例圆点与曲线共用，避免 wxml 再写一遍） */
const TPS_COLOR = CHART_COLORS[2];
const PLAYERS_COLOR = CHART_COLORS[4];

/** 实体维度的固定名称。服务端目前只接受这三项，其余键按原样显示以备扩展。 */
const DIMENSIONS: [string, string, string][] = [
  ["minecraft:overworld", "主世界", CHART_COLORS[4]],
  ["minecraft:nether", "下界", CHART_COLORS[7]],
  ["minecraft:the_end", "末地", CHART_COLORS[3]],
];

/** 一条已对齐时间的曲线。times 与 values 等长，null 表示该时刻断开。 */
export interface TrendSeries {
  /** 图例与点按读数 */
  name: string;
  /** 色板变量名（如 "--chart-3"），折线图与图例按当前主题解析 */
  color: string;
  /** 0 左轴，1 右轴。内存图里主机与进程不在一个量级，进程走右轴。 */
  axis: 0 | 1;
  times: number[];
  values: (number | null)[];
}

/** 总览「运行趋势」一次渲染需要的全部曲线 */
export interface TrendView {
  begin: number;
  end: number;
  /** 左轴上界（主机内存总量，MB）。0 表示按数据自适应。 */
  memoryMax: number;
  /** TPS / 在线玩家图例圆点的颜色（色板变量名），没有曲线时图例也要显示 */
  tpsColor: string;
  playersColor: string;
  tps: TrendSeries[];
  players: TrendSeries[];
  /** 主机与各进程 CPU 占用率（%），同一条纵轴 */
  cpu: TrendSeries[];
  memory: TrendSeries[];
  entities: TrendSeries[];
}

/** 还没有采样时的空窗口，避免页面初次 setData 缺字段 */
export function emptyTrend(now = Date.now(), span: MetricSpan = "60"): TrendView {
  const end = now;
  return {
    begin: end - Number(span) * 60_000,
    end,
    memoryMax: 0,
    tpsColor: TPS_COLOR,
    playersColor: PLAYERS_COLOR,
    tps: [],
    players: [],
    cpu: [],
    memory: [],
    entities: [],
  };
}

/** 把字符串收成合法档位；非法时保持原来的 1 小时 */
export function asMetricSpan(value: string): MetricSpan | null {
  return (METRIC_SPANS as readonly string[]).includes(value) ? (value as MetricSpan) : null;
}

/** 按当前档位整理一份指标。metrics 为空时只给出窗口，不编造曲线。 */
export function buildTrend(metrics: MetricsResult | null, span: MetricSpan, now: number): TrendView {
  const historyEnd = metrics?.history.length ? metrics.history[metrics.history.length - 1]?.recordedAt ?? 0 : 0;
  const resourceEnd = metrics?.resourceHistory?.length ? metrics.resourceHistory[metrics.resourceHistory.length - 1]?.recordedAt ?? 0 : 0;
  const end = Math.max(metrics?.resourcesUpdatedAt ?? 0, historyEnd, resourceEnd) || now;
  const begin = end - Number(span) * 60_000;
  const history = metrics?.history ?? [];
  const resources = metrics?.resourceHistory ?? [];
  return {
    begin,
    end,
    memoryMax: metrics?.host?.memory.totalMb ?? 0,
    tpsColor: TPS_COLOR,
    playersColor: PLAYERS_COLOR,
    tps: series("TPS", TPS_COLOR, trendPoints(history, (sample) => sample.tps, begin, end, RUNTIME_GAP_MS)),
    players: series("在线玩家", PLAYERS_COLOR, trendPoints(history, (sample) => sample.onlineCount, begin, end, RUNTIME_GAP_MS)),
    cpu: cpuSeries(resources, begin, end),
    memory: memorySeries(resources, begin, end),
    entities: entitySeries(history, begin, end),
  };
}

function series(name: string, color: string, points: { t: number; v: number | null }[], axis: 0 | 1 = 0): TrendSeries[] {
  if (!points.some((point) => typeof point.v === "number")) return [];
  return [{ name, color, axis, times: points.map((point) => point.t), values: points.map((point) => point.v) }];
}

/**
 * 分项曲线的名称。
 * 使用场景：内存图图例。与桌面端 metric-series.ts 的 sfmcPartLabel、数据服务的 label 一致。
 */
function sfmcPartLabel(key: string): string {
  if (key === "daemon") return "守护进程";
  if (key === "qq") return "QQ 桥";
  if (key === "tunnel") return "隧道";
  if (key === "llbot") return "LLBot";
  if (key.startsWith("sidecar:")) return key.slice("sidecar:".length);
  return key;
}

/** 分项固定用色。下标避开本文件里主机、BDS、数据服务已经占用的 3、6、1。 */
const PART_COLOR_INDEX = [0, 5, 4, 7, 2] as const;
const PART_ORDER = ["daemon", "qq", "tunnel", "llbot"];

function partColor(key: string, sidecarIndex: number): string {
  const slot = PART_ORDER.indexOf(key);
  const index = slot >= 0 ? slot : PART_COLOR_INDEX.length - 1 + sidecarIndex;
  return CHART_COLORS[PART_COLOR_INDEX[index % PART_COLOR_INDEX.length] ?? 0] ?? CHART_COLORS[0];
}

/** 资源曲线的取值函数：主机、BDS、数据服务和分项表（partsMb 或 partsCpuPercent）。 */
interface ResourcePick {
  host: (sample: ResourceSample) => number | null | undefined;
  bds: (sample: ResourceSample) => number | null | undefined;
  db: (sample: ResourceSample) => number | null | undefined;
  parts: (sample: ResourceSample) => Record<string, number> | undefined;
}

/**
 * 主机、BDS、数据服务和已登记进程的曲线，内存图与 CPU 图共用同一套顺序和配色。
 * 使用场景：memorySeries（进程走右轴）、cpuSeries（同一条百分比纵轴）。
 */
function resourceSeries(samples: ResourceSample[], pick: ResourcePick, processAxis: 0 | 1, begin: number, end: number): TrendSeries[] {
  const present = new Set<string>();
  for (const sample of samples) for (const key of Object.keys(pick.parts(sample) ?? {})) present.add(key);
  const partKeys = [
    ...PART_ORDER.filter((key) => present.has(key)),
    ...[...present].filter((key) => !PART_ORDER.includes(key)).sort(),
  ];
  let sidecarIndex = 0;
  const rows: [string, string, 0 | 1, (sample: ResourceSample) => number | null | undefined][] = [
    ["主机", CHART_COLORS[3], 0, pick.host],
    ["BDS", CHART_COLORS[6], processAxis, pick.bds],
    ["数据服务", CHART_COLORS[1], processAxis, pick.db],
    ...partKeys.map((key): [string, string, 0 | 1, (sample: ResourceSample) => number | null] => {
      const color = partColor(key, key.startsWith("sidecar:") ? sidecarIndex++ : 0);
      return [sfmcPartLabel(key), color, processAxis, (sample) => pick.parts(sample)?.[key] ?? null];
    }),
  ];
  return rows.flatMap(([name, color, axis, value]) => series(name, color, trendPoints(samples, value, begin, end, RESOURCE_GAP_MS), axis));
}

/** 主机走左轴，各进程走右轴，避免进程曲线被主机总量压成一条直线 */
function memorySeries(samples: ResourceSample[], begin: number, end: number): TrendSeries[] {
  return resourceSeries(
    samples,
    { host: (sample) => sample.hostUsedMb, bds: (sample) => sample.bdsMb, db: (sample) => sample.dbMb, parts: (sample) => sample.partsMb },
    1,
    begin,
    end,
  );
}

/**
 * CPU 占用率曲线：主机与各进程同在一条百分比纵轴上（各进程之和不超过主机）。
 * 与桌面端 metric-series.ts 的 cpuLines 相同；旧采样没有 CPU 字段时不出曲线，不补 0。
 */
function cpuSeries(samples: ResourceSample[], begin: number, end: number): TrendSeries[] {
  return resourceSeries(
    samples,
    {
      host: (sample) => sample.hostCpuPercent,
      bds: (sample) => sample.bdsCpuPercent,
      db: (sample) => sample.dbCpuPercent,
      parts: (sample) => sample.partsCpuPercent,
    },
    0,
    begin,
    end,
  );
}

function entitySeries(samples: MetricsSample[], begin: number, end: number): TrendSeries[] {
  const extra = new Set<string>();
  for (const sample of samples) for (const key of Object.keys(sample.entities)) extra.add(key);
  const rows: [string, string, string][] = [
    ...DIMENSIONS,
    ...[...extra]
      .filter((key) => !DIMENSIONS.some((row) => row[0] === key))
      .sort()
      .map((key, index): [string, string, string] => [key, key.replace(/^minecraft:/, ""), CHART_COLORS[index % CHART_COLORS.length]]),
  ];
  return rows.flatMap(([key, name, color]) => {
    if (!samples.some((sample) => key in sample.entities)) return [];
    return series(name, color, trendPoints(samples, (sample) => sample.entities[key], begin, end, RUNTIME_GAP_MS));
  });
}

/**
 * 正常相邻点的间隔中位数的 3 倍以内视为连续；抽稀后的一天窗口间隔更大，仍按真实点距断开。
 * 与桌面端 connectGap 相同。
 */
function connectGap(samples: { recordedAt: number }[], baseGap: number): number {
  const deltas: number[] = [];
  for (let index = 1; index < samples.length; index += 1) {
    const current = samples[index];
    const previous = samples[index - 1];
    if (!current || !previous) continue;
    const delta = current.recordedAt - previous.recordedAt;
    if (delta > 0) deltas.push(delta);
  }
  if (!deltas.length) return baseGap;
  deltas.sort((left, right) => left - right);
  const step = deltas[Math.floor((deltas.length - 1) / 2)];
  return step === undefined ? baseGap : Math.max(baseGap, step * 3);
}

/** 窗口内的点；重启或间隔过大时插入一个 null，让折线断开 */
function trendPoints<T extends { recordedAt: number; bootId?: string }>(
  samples: T[],
  pick: (sample: T) => number | null | undefined,
  begin: number,
  end: number,
  gapMs: number,
): { t: number; v: number | null }[] {
  const window = samples.filter((sample) => sample.recordedAt >= begin && sample.recordedAt <= end);
  const gap = connectGap(window, gapMs);
  const points: { t: number; v: number | null }[] = [];
  let previous: T | undefined;
  for (const sample of window) {
    const value = pick(sample);
    const numeric = typeof value === "number" && Number.isFinite(value) ? value : null;
    const restarted = Boolean(previous?.bootId && sample.bootId && previous.bootId !== sample.bootId);
    if (previous && (restarted || sample.recordedAt - previous.recordedAt > gap)) points.push({ t: sample.recordedAt - 1, v: null });
    points.push({ t: sample.recordedAt, v: numeric });
    previous = sample;
  }
  return points;
}
