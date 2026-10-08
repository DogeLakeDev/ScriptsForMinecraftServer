/**
 * 读取运行指标：实时数值走数据服务，曲线走已落盘的 sqlite。
 * 使用场景：桌面端「运行指标」。数据服务停着时仍返回停服前的历史，不把整页变成失败。
 */
import fs from "node:fs";
import path from "node:path";
import { clampMetricsSpan, readPersistedMetrics } from "@sfmc-bds/db-server/metrics-store";
import type { MetricsResult } from "@sfmc-bds/management";
import { getRoot } from "../runtime.js";

/** 与数据服务相同的配置读取：文件缺失时用默认端口和默认数据库相对路径。 */
function dbConfig(root: string): { db_port?: number; http_auth?: string; dbDir?: string } {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(root, "configs", "db_config.json"), "utf8")) as { db_port?: unknown; http_auth?: unknown; dbDir?: unknown };
    return {
      ...(typeof parsed.db_port === "number" ? { db_port: parsed.db_port } : {}),
      ...(typeof parsed.http_auth === "string" ? { http_auth: parsed.http_auth } : {}),
      ...(typeof parsed.dbDir === "string" && parsed.dbDir.trim() ? { dbDir: parsed.dbDir } : {}),
    };
  } catch {
    return {};
  }
}

/** 指标库与业务库同目录，文件名与数据服务打开的 runtime-metrics.sqlite 一致。 */
function metricsDatabasePath(root: string, dbDir: string | undefined): string {
  return path.join(path.dirname(path.resolve(root, dbDir ?? "data/sfmc_data.db")), "runtime-metrics.sqlite");
}

function spanOf(params: unknown): number {
  if (params === undefined) return clampMetricsSpan(undefined);
  if (!params || typeof params !== "object" || Array.isArray(params)) throw new Error("参数必须为对象");
  return clampMetricsSpan((params as { spanMs?: unknown }).spanMs);
}

function offline(error: unknown): boolean {
  const detail = error instanceof Error ? `${error.message} ${String(error.cause ?? "")}` : String(error);
  return /fetch failed|ECONNREFUSED|ENOTFOUND|AbortError|TimeoutError|timed out/i.test(detail);
}

/**
 * 管理协议 metrics.read。
 * 落盘读取失败时保留数据服务返回的历史；两边都没有时沿用原来的空结果说明。
 */
export async function readRuntimeMetrics(params: unknown): Promise<MetricsResult> {
  const spanMs = spanOf(params);
  const root = getRoot();
  const cfg = dbConfig(root);
  let live: MetricsResult | undefined;
  try {
    const response = await fetch(`http://127.0.0.1:${cfg.db_port ?? 3001}/api/sfmc/metrics?spanMs=${spanMs}`, {
      headers: cfg.http_auth ? { authorization: `Bearer ${cfg.http_auth}` } : {},
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`运行指标读取失败 (${response.status})`);
    const body = await response.json() as MetricsResult;
    if (!body || typeof body !== "object" || !Array.isArray(body.history)) throw new Error("运行指标读取失败");
    live = body;
  } catch (error) {
    if (!offline(error)) throw error;
  }
  let stored: ReturnType<typeof readPersistedMetrics> = null;
  try { stored = readPersistedMetrics(metricsDatabasePath(root, cfg.dbDir), Date.now(), spanMs); } catch { stored = null; }
  if (!live) {
    const history = stored?.history ?? [];
    const resourceHistory = stored?.resourceHistory ?? [];
    return {
      fresh: false,
      updatedAt: history.at(-1)?.recordedAt ?? null,
      current: null,
      history,
      host: null,
      processes: null,
      resourcesUpdatedAt: resourceHistory.at(-1)?.recordedAt ?? null,
      resourceHistory,
      note: history.length || resourceHistory.length ? "数据服务未运行，实时数值不可用" : "数据服务未运行，暂时没有运行指标",
    };
  }
  const history = stored?.history ?? live.history;
  const resourceHistory = stored?.resourceHistory ?? live.resourceHistory;
  return {
    ...live,
    history,
    ...(resourceHistory ? { resourceHistory } : {}),
    updatedAt: live.updatedAt ?? history.at(-1)?.recordedAt ?? null,
    resourcesUpdatedAt: live.resourcesUpdatedAt ?? resourceHistory?.at(-1)?.recordedAt ?? null,
  };
}
