/**
 * routes/qq-events.ts — MC 事件入站
 *
 *   POST /api/sfmc/qq/events — 单条或 { events: [...] }（≤100）
 *   GET/POST /api/sfmc/qq/events/settings — 查询或修改推送开关和聚合间隔
 */

import type { QqEventsAggregator, QqEventPayload, ResolvedQqEventsConfig } from "../domain/qq-events.js";
import { normalizeEventPayload } from "../domain/qq-events.js";

interface Deps {
  body: (req: import("http").IncomingMessage) => Promise<Record<string, unknown>>;
  json: (res: import("http").ServerResponse, data: Record<string, unknown>, status?: number) => void;
  aggregator: QqEventsAggregator;
  getSettings: () => ResolvedQqEventsConfig;
  setSettings: (patch: Partial<ResolvedQqEventsConfig>) => ResolvedQqEventsConfig;
  isAdmin: (openid: string, asGroupAdmin: boolean) => boolean;
}

const SWITCHES = ["enabled", "join", "leave", "death", "crash", "start", "stop"] as const;

function collectPayloads(data: Record<string, unknown>): QqEventPayload[] {
  if (Array.isArray(data.events)) {
    return (data.events as unknown[])
      .map((x) => normalizeEventPayload(x))
      .filter((x): x is QqEventPayload => x != null);
  }
  // 单条：顶层即事件
  const one = normalizeEventPayload(data);
  return one ? [one] : [];
}

function createQqEventsRoutes({ body, json, aggregator, getSettings, setSettings, isAdmin }: Deps) {
  return async function handle({
    path,
    method,
    req,
    res,
  }: {
    path: string;
    method: string;
    params: URLSearchParams;
    req: import("http").IncomingMessage;
    res: import("http").ServerResponse;
  }): Promise<boolean> {
    if (path === "/api/sfmc/qq/events/settings") {
      if (method === "GET") {
        json(res, { success: true, settings: getSettings() });
        return true;
      }
      if (method === "POST") {
        const data = await body(req);
        const openid = typeof data.openid === "string" ? data.openid.trim() : "";
        if (!isAdmin(openid, data.as_group_admin === true)) {
          json(res, { success: false, error: "not_admin" }, 403);
          return true;
        }
        const field = data.field;
        if (field === "window_sec") {
          const seconds = data.value;
          if (typeof seconds !== "number" || !Number.isInteger(seconds) || seconds < 5 || seconds > 600) {
            json(res, { success: false, error: "invalid_setting" }, 400);
            return true;
          }
          json(res, { success: true, settings: setSettings({ window_sec: seconds }) });
          return true;
        }
        if (!SWITCHES.some((key) => key === field) || typeof data.value !== "boolean") {
          json(res, { success: false, error: "invalid_setting" }, 400);
          return true;
        }
        const settings = setSettings({ [field as (typeof SWITCHES)[number]]: data.value });
        json(res, { success: true, settings });
        return true;
      }
      json(res, { success: false, error: "not_found" }, 404);
      return true;
    }
    if (path !== "/api/sfmc/qq/events") return false;

    if (method !== "POST") {
      json(res, { success: false, error: "not_found" }, 404);
      return true;
    }

    const data = await body(req);
    if (Array.isArray(data.events) && (data.events as unknown[]).length > 100) {
      json(res, { success: false, error: "too many requests" }, 413);
      return true;
    }

    const payloads = collectPayloads(data);
    if (payloads.length === 0) {
      json(res, { success: false, error: "invalid" }, 400);
      return true;
    }

    const result = aggregator.ingestMany(payloads);
    json(res, { success: true, ...result });
    return true;
  };
}

export { createQqEventsRoutes };
