/** 运行指标的受控校验与有界历史；只记录平台上报，不接受任意表名或 SQL。 */
import type { QueryFn } from "../lib/sqlite.js";

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

export class MetricsHistory {
  private lastWrite = 0;
  private lastPrune = 0;
  constructor(private query: QueryFn) {
    query("CREATE TABLE IF NOT EXISTS sfmc_runtime_metrics (recorded_at INTEGER PRIMARY KEY, sample TEXT NOT NULL)");
  }
  append(sample: MetricsSample): void {
    // 同一采样窗口去重，防止异常重试造成无界落库。
    if (sample.recordedAt - this.lastWrite < 3000) return;
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
    this.query("DELETE FROM sfmc_runtime_metrics WHERE recorded_at < ?", [now - 72 * 3600_000]);
    this.query(
      "DELETE FROM sfmc_runtime_metrics WHERE recorded_at NOT IN (SELECT recorded_at FROM sfmc_runtime_metrics ORDER BY recorded_at DESC LIMIT 60000)"
    );
  }
  read(now = Date.now()): MetricsSample[] {
    const rows = this.query(
      "SELECT sample FROM sfmc_runtime_metrics WHERE recorded_at >= ? ORDER BY recorded_at DESC LIMIT 720",
      [now - 3600_000]
    ) as { sample: string }[];
    return rows.reverse().flatMap((row) => {
      try {
        return [JSON.parse(row.sample) as MetricsSample];
      } catch {
        return [];
      }
    });
  }
}
