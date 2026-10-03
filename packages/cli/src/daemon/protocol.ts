/**
 * protocol.ts — CLI ↔ 守护进程 换行分隔 JSON 协议类型
 *
 * 请求/响应成对匹配 id；subscribe 后服务端可推送 event 帧。
 * 所有请求须携带与 daemon.json 一致的 token。
 */

import type { UnifiedLog, LogLevel, LogSource } from "../logs.js";
import type { ServiceName, ServiceStateEvent, ServiceStatus } from "../services.js";
import type { ManagementRequest, ManagementResponse, ManagementEvent } from "@sfmc-bds/management";

/** 协议方法名（固定集合，OCP：新增能力加此处与 server 分发） */
export type DaemonMethod =
  | "management"
  | "maintenanceStop"
  | "ping"
  | "status"
  | "start"
  | "stop"
  | "restart"
  | "startAll"
  | "stopAll"
  | "send"
  | "update"
  | "subscribe"
  | "shutdown";

/** 客户端 → 服务端请求帧 */
export interface DaemonRequest {
  id: string;
  token: string;
  method: DaemonMethod;
  params?: DaemonParams;
}

/** 各方法参数（按 method 选用） */
export type DaemonParams = {
  request?: ManagementRequest;
  maintenanceToken?: string;
  name?: string;
  message?: string;
  args?: string[];
};

/** 服务端 → 客户端响应帧 */
export interface DaemonResponse {
  type: "res";
  id: string;
  ok: boolean;
  result?: DaemonResult;
  error?: string;
}

/** 服务端推送事件（subscribe 之后） */
export interface DaemonEvent {
  type: "event";
  event: "log" | "state" | "management";
  payload: DaemonLogPayload | ServiceStateEvent | ManagementEvent;
}

/** 日志事件载荷（与 UnifiedLog 对齐，便于 CLI 侧 pushLog） */
export interface DaemonLogPayload {
  text: string;
  source: LogSource;
  level: LogLevel;
  time?: string;
}

/** status 等方法的结构化结果 */
export type DaemonResult =
  | { kind: "management"; response: ManagementResponse }
  | { kind: "pong" }
  | { kind: "text"; text: string }
  | { kind: "status"; text: string; rows: ServiceStatus[] }
  | { kind: "subscribed" }
  | { kind: "shutdown" };

export type DaemonFrame = DaemonResponse | DaemonEvent;

/** 类型守卫：日志事件载荷 */
export function isLogPayload(p: DaemonEvent["payload"]): p is DaemonLogPayload {
  return typeof (p as DaemonLogPayload).text === "string" && typeof (p as DaemonLogPayload).source === "string";
}

/** 从 UnifiedLog 构造可序列化日志载荷 */
export function toLogPayload(log: UnifiedLog): DaemonLogPayload {
  return {
    text: log.text,
    source: log.source,
    level: log.level,
    time: log.time instanceof Date ? log.time.toISOString() : String(log.time ?? ""),
  };
}

export type { ServiceName, ServiceStateEvent, ServiceStatus };
