import type { MetricsSample, ResourceSample } from "@sfmc-bds/management";
import { CHART_COLORS } from "../app/theme.js";

export interface ChartLine {
  name: string;
  color: string;
  axis: 0 | 1;
  points: [number, number | null][];
}

const DIMENSIONS: [string, string, string][] = [
  ["minecraft:overworld", "主世界", CHART_COLORS[4]],
  ["minecraft:nether", "下界", CHART_COLORS[7]],
  ["minecraft:the_end", "末地", CHART_COLORS[3]],
];

/**
 * 断线阈值。密采样仍用原来的 20 秒 / 45 秒；抽稀后的间隔更大时，按真实点距的 3 倍断开，
 * 正常相邻的桶不会被拆成碎线，中间缺了采样仍然断开。不补造点。
 */
function connectGap(samples: { recordedAt: number }[], baseGap: number): number {
  const deltas: number[] = [];
  for (let index = 1; index < samples.length; index++) {
    const current = samples[index];
    const previous = samples[index - 1];
    if (!current || !previous) continue;
    const delta = current.recordedAt - previous.recordedAt;
    if (delta > 0) deltas.push(delta);
  }
  if (deltas.length === 0) return baseGap;
  deltas.sort((left, right) => left - right);
  const step = deltas[Math.floor((deltas.length - 1) / 2)];
  return step === undefined ? baseGap : Math.max(baseGap, step * 3);
}

export function trendPoints<T extends { recordedAt: number; bootId?: string }>(
  samples: T[],
  pick: (sample: T) => number | null | undefined,
  from: number,
  end: number,
  gapMs: number
): [number, number | null][] {
  const window = samples.filter((sample) => sample.recordedAt >= from && sample.recordedAt <= end);
  const gap = connectGap(window, gapMs);
  const points: [number, number | null][] = [];
  let previous: T | undefined;
  for (const sample of window) {
    const value = pick(sample);
    const numeric = typeof value === "number" && Number.isFinite(value) ? value : null;
    const restarted = Boolean(previous?.bootId && sample.bootId && previous.bootId !== sample.bootId);
    if (previous && (restarted || sample.recordedAt - previous.recordedAt > gap)) points.push([sample.recordedAt - 1, null]);
    points.push([sample.recordedAt, numeric]);
    previous = sample;
  }
  return points;
}

function hasValue(points: [number, number | null][]) {
  return points.some((point) => typeof point[1] === "number");
}

export function scalarLine(samples: MetricsSample[], field: "tps" | "onlineCount", name: string, color: string, from: number, end: number): ChartLine[] {
  const points = trendPoints(samples, (sample) => sample[field], from, end, 20_000);
  return hasValue(points) ? [{ name, color, axis: 0, points }] : [];
}

/**
 * 分项曲线的名称。
 * 使用场景：内存图图例。与数据服务 tracked-processes.ts 的 label、小程序 trend.ts 的同名函数一致。
 */
export function sfmcPartLabel(key: string): string {
  if (key === "daemon") return "守护进程";
  if (key === "qq") return "QQ 桥";
  if (key === "tunnel") return "隧道";
  if (key === "llbot") return "LLBot";
  if (key.startsWith("sidecar:")) return key.slice("sidecar:".length);
  return key;
}

/** 分项固定用色，避开主机、BDS、数据服务已经占用的下标。附属进程从第 5 个槽位起。 */
const PART_COLOR_INDEX = [0, 5, 4, 7, 3] as const;
const PART_ORDER = ["daemon", "qq", "tunnel", "llbot"];

function partColor(key: string, sidecarIndex: number): string {
  const slot = PART_ORDER.indexOf(key);
  const index = slot >= 0 ? slot : PART_COLOR_INDEX.length - 1 + sidecarIndex;
  return CHART_COLORS[PART_COLOR_INDEX[index % PART_COLOR_INDEX.length] ?? 0] ?? CHART_COLORS[0];
}

/** 资源曲线的一行定义：名称、颜色、纵轴、取值函数。 */
type ResourceSeries = [string, string, 0 | 1, (sample: ResourceSample) => number | null];

/**
 * 主机、BDS、数据服务和已登记进程的曲线定义，内存图与 CPU 图共用同一套顺序和配色。
 * 使用场景：memoryLines、cpuLines。parts 取出该图对应的分项表（partsMb 或 partsCpuPercent）。
 */
function resourceSeries(
  samples: ResourceSample[],
  pick: { host: (s: ResourceSample) => number | null | undefined; bds: (s: ResourceSample) => number | null | undefined; db: (s: ResourceSample) => number | null | undefined; parts: (s: ResourceSample) => Record<string, number> | undefined },
  processAxis: 0 | 1,
): ResourceSeries[] {
  const present = new Set<string>();
  for (const sample of samples) for (const key of Object.keys(pick.parts(sample) ?? {})) present.add(key);
  const partKeys = [
    ...PART_ORDER.filter((key) => present.has(key)),
    ...[...present].filter((key) => !PART_ORDER.includes(key)).sort(),
  ];
  let sidecarIndex = 0;
  return [
    ["主机", CHART_COLORS[2], 0, (sample) => pick.host(sample) ?? null],
    ["BDS", CHART_COLORS[6], processAxis, (sample) => pick.bds(sample) ?? null],
    ["数据服务", CHART_COLORS[1], processAxis, (sample) => pick.db(sample) ?? null],
    ...partKeys.map((key): ResourceSeries => {
      const color = partColor(key, key.startsWith("sidecar:") ? sidecarIndex++ : 0);
      return [sfmcPartLabel(key), color, processAxis, (sample) => pick.parts(sample)?.[key] ?? null];
    }),
  ];
}

function resourceLines(samples: ResourceSample[], series: ResourceSeries[], from: number, end: number): ChartLine[] {
  return series.flatMap(([name, color, axis, pick]) => {
    const points = trendPoints(samples, pick, from, end, 45_000);
    return hasValue(points) ? [{ name, color, axis, points }] : [];
  });
}

export function memoryLines(samples: ResourceSample[], from: number, end: number): ChartLine[] {
  const series = resourceSeries(
    samples,
    { host: (sample) => sample.hostUsedMb, bds: (sample) => sample.bdsMb, db: (sample) => sample.dbMb, parts: (sample) => sample.partsMb },
    1,
  );
  return resourceLines(samples, series, from, end);
}

/**
 * CPU 占用率曲线：主机与各进程同在一条 0–100% 的纵轴上（各进程之和不超过主机）。
 * 使用场景：MetricsPanel 的「CPU」视图。旧采样没有 CPU 字段时这些点为空，不补 0。
 */
export function cpuLines(samples: ResourceSample[], from: number, end: number): ChartLine[] {
  const series = resourceSeries(
    samples,
    {
      host: (sample) => sample.hostCpuPercent,
      bds: (sample) => sample.bdsCpuPercent,
      db: (sample) => sample.dbCpuPercent,
      parts: (sample) => sample.partsCpuPercent,
    },
    0,
  );
  return resourceLines(samples, series, from, end);
}

export function entityLines(samples: MetricsSample[], from: number, end: number): ChartLine[] {
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
    const points = trendPoints(samples, (sample) => sample.entities[key], from, end, 20_000);
    return hasValue(points) ? [{ name, color, axis: 0 as const, points }] : [];
  });
}
