/** 运行指标的受控校验与有界历史；只记录平台上报，不接受任意表名或 SQL。 */
import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createQuery, type QueryFn } from "../lib/sqlite.js";

/** 运行指标写入去重间隔。读历史时一小时内的点数按这个间隔封顶，避免再被固定 720 条截断。 */
export const RUNTIME_SAMPLE_MS = 3_000;
/** 资源指标写入去重间隔。 */
export const RESOURCE_SAMPLE_MS = 8_000;
/** 不抽稀的最长窗口，与原先「最近一小时」一致。 */
export const METRICS_RAW_WINDOW_MS = 3_600_000;
/** 落库保留时长，与 prune 删除条件一致。请求更长的范围会被截到这里。 */
export const METRICS_RETENTION_MS = 72 * METRICS_RAW_WINDOW_MS;

const METRIC_TABLES = {
  runtime: "sfmc_runtime_metrics",
  resource: "sfmc_resource_metrics",
} as const;

/**
 * 把调用方给出的窗口收成落库能覆盖的范围。
 * 缺省仍是一小时，旧客户端不传 spanMs 时行为不变。
 */
export function clampMetricsSpan(value: unknown): number {
  if (value === undefined) return METRICS_RAW_WINDOW_MS;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) throw new Error("非法时间范围");
  return Math.min(value, METRICS_RETENTION_MS);
}

export interface MetricsSample {
  recordedAt: number;
  bootId: string;
  tps: number | null;
  onlineCount: number;
  entities: Record<string, number | null>;
  entitiesUpdatedAt: number | null;
  chunkEstimate: number | null;
}
const DIMENSIONS = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"];
const count = (value: unknown) =>
  value === null || (typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 100_000_000);

export function parseMetrics(data: Record<string, unknown>, now: number): MetricsSample | null {
  if (!Array.isArray(data.players) || data.players.length > 1000) return null;
  if (
    typeof data.bootId !== "string" ||
    !/^[a-zA-Z0-9-]{1,96}$/.test(data.bootId) ||
    !(
      data.tps === null ||
      (typeof data.tps === "number" && Number.isFinite(data.tps) && data.tps >= 0 && data.tps <= 20)
    ) ||
    !count(data.chunkEstimate) ||
    typeof data.onlineCount !== "number" ||
    data.onlineCount !== (data.players as unknown[]).length ||
    !data.entities ||
    typeof data.entities !== "object" ||
    Array.isArray(data.entities) ||
    !(
      data.entitiesUpdatedAt === null ||
      (typeof data.entitiesUpdatedAt === "number" &&
        Number.isSafeInteger(data.entitiesUpdatedAt) &&
        data.entitiesUpdatedAt > 0 &&
        data.entitiesUpdatedAt <= now + 2000)
    )
  )
    return null;
  const raw = data.entities as Record<string, unknown>;
  if (Object.keys(raw).some((key) => !DIMENSIONS.includes(key)) || DIMENSIONS.some((key) => !count(raw[key])))
    return null;
  return {
    recordedAt: now,
    bootId: data.bootId,
    tps: data.tps as number | null,
    onlineCount: data.onlineCount,
    entities: { ...raw } as Record<string, number | null>,
    entitiesUpdatedAt: data.entitiesUpdatedAt as number | null,
    chunkEstimate: data.chunkEstimate as number | null,
  };
}

export interface ResourceSample {
  recordedAt: number;
  hostUsedMb: number | null;
  dbMb: number | null;
  bdsMb: number | null;
}
const memoryMb = (value: unknown) =>
  value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 8_388_608);

export class ResourceHistory {
  private lastWrite = 0;
  private lastPrune = 0;
  constructor(private query: QueryFn) {
    query("CREATE TABLE IF NOT EXISTS sfmc_resource_metrics (recorded_at INTEGER PRIMARY KEY, sample TEXT NOT NULL)");
  }
  append(sample: ResourceSample): void {
    if (sample.recordedAt - this.lastWrite < RESOURCE_SAMPLE_MS) return;
    if (sample.hostUsedMb === null && sample.dbMb === null && sample.bdsMb === null) return;
    if (!memoryMb(sample.hostUsedMb) || !memoryMb(sample.dbMb) || !memoryMb(sample.bdsMb)) return;
    this.query("INSERT OR REPLACE INTO sfmc_resource_metrics (recorded_at, sample) VALUES (?, ?)", [
      sample.recordedAt,
      JSON.stringify(sample),
    ]);
    if (sample.recordedAt - this.lastPrune > 60_000) {
      this.query("DELETE FROM sfmc_resource_metrics WHERE recorded_at < ?", [sample.recordedAt - METRICS_RETENTION_MS]);
      this.query(
        "DELETE FROM sfmc_resource_metrics WHERE recorded_at NOT IN (SELECT recorded_at FROM sfmc_resource_metrics ORDER BY recorded_at DESC LIMIT 60000)"
      );
      this.lastPrune = sample.recordedAt;
    }
    this.lastWrite = sample.recordedAt;
  }
  read(now = Date.now(), spanMs = METRICS_RAW_WINDOW_MS): ResourceSample[] {
    return parseResourceRows(readMetricRows(this.query, "resource", now, spanMs));
  }
}

export class MetricsHistory {
  private lastWrite = 0;
  private lastPrune = 0;
  constructor(private query: QueryFn) {
    query("CREATE TABLE IF NOT EXISTS sfmc_runtime_metrics (recorded_at INTEGER PRIMARY KEY, sample TEXT NOT NULL)");
  }
  append(sample: MetricsSample): void {
    // 同一采样窗口去重，防止异常重试造成无界落库。
    if (sample.recordedAt - this.lastWrite < RUNTIME_SAMPLE_MS) return;
    this.query("INSERT OR REPLACE INTO sfmc_runtime_metrics (recorded_at, sample) VALUES (?, ?)", [
      sample.recordedAt,
      JSON.stringify(sample),
    ]);
    if (sample.recordedAt - this.lastPrune > 60_000) {
      this.prune(sample.recordedAt);
      this.lastPrune = sample.recordedAt;
    }
    this.lastWrite = sample.recordedAt;
  }
  private prune(now: number): void {
    this.query("DELETE FROM sfmc_runtime_metrics WHERE recorded_at < ?", [now - METRICS_RETENTION_MS]);
    this.query(
      "DELETE FROM sfmc_runtime_metrics WHERE recorded_at NOT IN (SELECT recorded_at FROM sfmc_runtime_metrics ORDER BY recorded_at DESC LIMIT 60000)"
    );
  }
  read(now = Date.now(), spanMs = METRICS_RAW_WINDOW_MS): MetricsSample[] {
    return parseRuntimeRows(readMetricRows(this.query, "runtime", now, spanMs));
  }
}

/**
 * 只读打开已落盘的指标库。文件不存在或仍被占用时返回 null，不创建文件、不建表。
 * 使用场景：数据服务进程没在跑时，管理通道仍要画出停服前的曲线。
 */
export function readPersistedMetrics(filePath: string, now: number, spanMs: number): { history: MetricsSample[]; resourceHistory: ResourceSample[] } | null {
  if (!existsSync(filePath)) return null;
  let db: DatabaseSync | undefined;
  try {
    db = new DatabaseSync(filePath, { readOnly: true });
    db.exec("PRAGMA query_only = ON");
    db.exec("PRAGMA busy_timeout = 5000");
    const query = createQuery(db);
    return {
      history: parseRuntimeRows(readMetricRows(query, "runtime", now, spanMs)),
      resourceHistory: parseResourceRows(readMetricRows(query, "resource", now, spanMs)),
    };
  } catch {
    return null;
  } finally {
    try { db?.close(); } catch { /* 只读连接关闭失败时调用方仍按没有落盘处理。 */ }
  }
}

/**
 * 窗口右端对齐最后一条真实采样，所以停服后请求「最近 15 分钟」看到的是停服前的 15 分钟。
 * 不超过一小时时返回原始点；更长则每个时间桶保留一条已落盘的点，不补造采样。
 */
function readMetricRows(query: QueryFn, kind: keyof typeof METRIC_TABLES, now: number, spanMs: number): { sample: string }[] {
  const table = METRIC_TABLES[kind];
  const span = clampMetricsSpan(spanMs);
  const intervalMs = kind === "runtime" ? RUNTIME_SAMPLE_MS : RESOURCE_SAMPLE_MS;
  const latestRows = query(`SELECT MAX(recorded_at) AS latest FROM ${table}`);
  if (!Array.isArray(latestRows)) return [];
  const latest = (latestRows[0] as { latest: number | null } | undefined)?.latest;
  if (typeof latest !== "number") return [];
  const end = Math.min(latest, now);
  const since = end - span;
  const hourPoints = Math.ceil(METRICS_RAW_WINDOW_MS / intervalMs);
  const rows = span <= METRICS_RAW_WINDOW_MS
    ? query(
        `SELECT sample FROM (SELECT sample, recorded_at FROM ${table} WHERE recorded_at >= ? AND recorded_at <= ? ORDER BY recorded_at DESC LIMIT ?) ORDER BY recorded_at ASC`,
        [since, end, Math.ceil(span / intervalMs)]
      )
    : query(
        // 绑定参数在 SQLite 里是浮点，直接相除不会按整数分桶，所以先 CAST 成整数。
        `SELECT sample FROM (SELECT sample, recorded_at FROM (SELECT sample, recorded_at, ROW_NUMBER() OVER (PARTITION BY recorded_at / CAST(? AS INTEGER) ORDER BY recorded_at DESC) AS rn FROM ${table} WHERE recorded_at >= ? AND recorded_at <= ?) WHERE rn = 1 ORDER BY recorded_at DESC LIMIT ?) ORDER BY recorded_at ASC`,
        [Math.ceil(span / hourPoints), since, end, hourPoints]
      );
  return Array.isArray(rows) ? rows as { sample: string }[] : [];
}

function parseRuntimeRows(rows: { sample: string }[]): MetricsSample[] {
  return rows.flatMap((row) => {
    try {
      return [JSON.parse(row.sample) as MetricsSample];
    } catch {
      return [];
    }
  });
}

function parseResourceRows(rows: { sample: string }[]): ResourceSample[] {
  return rows.flatMap((row) => {
    try {
      const sample = JSON.parse(row.sample) as ResourceSample;
      if (!memoryMb(sample.hostUsedMb) || !memoryMb(sample.dbMb) || !memoryMb(sample.bdsMb)) return [];
      return [sample];
    } catch {
      return [];
    }
  });
}
