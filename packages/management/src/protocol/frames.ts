/**
 * frames.ts — 管理协议帧结构（换行分隔 JSON，与守护进程协议同构）
 *
 * 使用场景：`sfmc manage --stdio` 的标准输入/输出、以及桌面端 SSH 通道上
 * 传输的帧格式。请求/响应按 id 配对；订阅后服务端可推送 event 帧。
 * 诊断信息一律走 stderr，不得混入 stdout 帧流。
 */

import type { ManagementError } from "./errors.js";
import type { LogEventPayload } from "./logs.js";
import type { OperationRecord } from "./operations.js";
import type { ServiceStateChanged } from "./services.js";

/** 客户端 → 服务端请求帧 */
export interface ManagementRequest {
  /** 请求标识（客户端生成，响应原样带回） */
  id: string;
  /** 方法名（见 methods.ts 的 ManagementMethodMap） */
  method: string;
  /** 方法参数（按 method 而定） */
  params?: unknown;
}

/** 服务端 → 客户端响应帧 */
export interface ManagementResponse {
  type: "res";
  id: string;
  ok: boolean;
  /** 成功时的结构化结果（按 method 而定） */
  result?: unknown;
  /** 失败时的结构化错误信封 */
  error?: ManagementError;
}

/** 可订阅的事件种类 */
export type ManagementEventKind = "log" | "serviceState" | "operation";

/** 服务端 → 客户端事件推送帧（events.subscribe 之后） */
export interface ManagementEvent {
  instanceId: string;
  type: "event";
  event: ManagementEventKind;
  /** 事件载荷：log→LogEventPayload；serviceState→ServiceStateChanged；operation→OperationRecord */
  payload: LogEventPayload | ServiceStateChanged | OperationRecord;
}

/** 线缆帧 = 响应 | 事件 */
export type ManagementFrame = ManagementResponse | ManagementEvent;

/** events.subscribe 参数 */
export interface EventsSubscribeParams {
  /** 仅订阅这些事件种类；缺省订阅全部 */
  kinds?: ManagementEventKind[];
}

/** events.subscribe 结果 */
export interface EventsSubscribeResult {
  subscribed: true;
  kinds: ManagementEventKind[];
}

/** 类型守卫：帧是否为事件 */
export function isManagementEvent(frame: ManagementFrame): frame is ManagementEvent {
  return frame.type === "event";
}

/** 序列化一帧为一行 NDJSON（不含换行符由调用方追加亦可，这里统一带上） */
export function encodeFrame(frame: ManagementFrame): string {
  return JSON.stringify(frame) + "\n";
}

/** 解析一行 NDJSON 为帧；格式非法返回 null（调用方忽略坏行） */
export function decodeFrame(line: string): ManagementFrame | null {
  try {
    const v = JSON.parse(line) as ManagementFrame;
    if (v && (v.type === "res" || v.type === "event")) return v;
    return null;
  } catch {
    return null;
  }
}
