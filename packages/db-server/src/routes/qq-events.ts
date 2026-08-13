/**
 * routes/qq-events.ts — MC 事件入站
 *
 *   POST /api/sfmc/qq/events — 单条或 { events: [...] }（≤100）
 */

import type { QqEventsAggregator, QqEventPayload } from "../domain/qq-events.js";
import { normalizeEventPayload } from "../domain/qq-events.js";

interface Deps {
  body: (req: import("http").IncomingMessage) => Promise<Record<string, unknown>>;
  json: (res: import("http").ServerResponse, data: Record<string, unknown>, status?: number) => void;
  aggregator: QqEventsAggregator;
}

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

function createQqEventsRoutes({ body, json, aggregator }: Deps) {
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
