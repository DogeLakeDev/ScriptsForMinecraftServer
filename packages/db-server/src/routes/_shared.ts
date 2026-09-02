/**
 * routes/_shared.ts — 路由模块共享类型 + 工厂
 *
 * 所有 db-server 路由统一:
 *   - deps:  { query, db, body, json, ... }      ← 共享注入
 *   - ctx:   { path, method, params, req, res } ← 共享请求上下文
 *   - return: boolean                            ← true 表示已处理
 *
 * http 工具 (json / body) 来自 lib/http.ts
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { DatabaseSync } from "node:sqlite";
import type { Method } from "../lib/http.js";
import { body as sharedBody, json as sharedJson } from "../lib/http.js";
import type { QueryFn } from "../lib/sqlite.js";

export type { Method } from "../lib/http.js";
export type { QueryFn };

/** shared deps factory — 路由可声明最小化 deps 子集 */
export type RouteDeps = {
  query: QueryFn;
  db: DatabaseSync;
  json: (res: ServerResponse, data: Record<string, unknown>, status?: number) => void;
  body: (req: IncomingMessage) => Promise<Record<string, unknown>>;
  params: URLSearchParams;
  projectRoot: string;
  monitorState?: { metrics: object | null; players: object[] };
  ensureEconomyAccount?: (
    playerId: string,
    playerName: string
  ) => { balance: number; player_id: string; version: number };
  economyResult?: (account: object | undefined) => { balance: number; version: number } | null;
  forwardToQQBridge?: (channelId: string, fromName: string, content: string, fromId: string) => void;
  land?: Record<string, (...args: unknown[]) => unknown>;
};

/** v2 模块身份 — 由 handle 校验后写入路由 ctx(勿挂 req 私有字段,LoD)。 */
export type ModuleAuth = { id: string; permissions: string[] };

export type RouteCtx = {
  path: string;
  method: Method | string;
  params: URLSearchParams;
  req: IncomingMessage;
  res: ServerResponse;
  /** v2 路由专用:模块鉴权结果 */
  moduleAuth?: ModuleAuth;
};

export type RouteHandler = (ctx: RouteCtx) => Promise<boolean> | boolean;

export type RouteFactory = (deps: Partial<RouteDeps>) => RouteHandler;

/** 便捷 re-export：路由默认从这里取 json/body */
export const json = sharedJson;
export const body = sharedBody;

/**
 * 标准失败响应信封生成工具（格式：`{ ok: false, error, code? }` + 可选 extra 字段）。
 * 路由层与鉴权中间件统一调用此助手，杜绝与 `{ success: false }` 字段混用。
 *
 * @param res HTTP 响应对象。
 * @param error 错误简短描述。
 * @param status HTTP 状态码。
 * @param code 可选的精细业务错误码。
 * @param extra 可选的附加字段字典。
 */
export function jsonV2Fail(
  res: ServerResponse,
  error: string,
  status: number,
  code?: string,
  extra?: Record<string, unknown>
): void {
  const payload: Record<string, unknown> = { ...(extra ?? {}), ok: false, error };
  if (code) payload.code = code;
  sharedJson(res, payload, status);
}

/**
 * 标准成功响应信封生成工具（格式：`{ ok: true, ...fields }`）。
 * 与 `jsonV2Fail` 对称统一。
 *
 * @param res HTTP 响应对象。
 * @param fields 响应正文字段字典。
 * @param status HTTP 状态码（默认为 200）。
 */
export function jsonV2Ok(
  res: ServerResponse,
  fields: Record<string, unknown> = {},
  status = 200
): void {
  sharedJson(res, { ...fields, ok: true }, status);
}


export {};

