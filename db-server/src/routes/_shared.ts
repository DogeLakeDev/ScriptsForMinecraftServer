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

export {};

