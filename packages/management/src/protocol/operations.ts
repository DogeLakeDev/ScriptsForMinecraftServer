/**
 * operations.ts — 后台任务（耗时操作）的协议类型
 *
 * 使用场景：安装/更新/启停等耗时写操作返回 OperationAccepted，
 * 客户端经 operation 事件或 operations.get 跟踪进度；
 * 连接中断后用 operations.list/get 查询原任务，禁止自动重发写请求。
 * 任务记录由守护进程持久化在 `<SFMC_ROOT>/.sfmc/operations/`。
 */

import type { ManagementError } from "./errors.js";

/** 任务状态机：queued → running → succeeded / failed；异常退出恢复为 interrupted */
export type OperationStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "interrupted";

/** 任务阶段（维护顺序：准备→停服→备份→执行→验证→恢复，由执行器按场景裁剪） */
export interface OperationPhase {
  /** 阶段标识（机器可读，如 "prepare" / "stop-services" / "backup" / "execute" / "verify" / "restore"） */
  name: string;
  status: "pending" | "running" | "done" | "failed" | "skipped";
  /** 阶段说明或失败原因（诊断文案） */
  message?: string;
  startedAt?: string;
  finishedAt?: string;
}

/** 持久化任务记录（operations.list / operations.get 的结果元素，亦是 operation 事件载荷） */
export interface OperationRecord {
  /** 任务标识（服务端生成） */
  id: string;
  /** 任务种类（机器可读，如 "module.install" / "updates.run" / "services.stop"） */
  kind: string;
  /** 人类可读标题（诊断展示用） */
  title: string;
  status: OperationStatus;
  phases: OperationPhase[];
  createdAt: string;
  updatedAt: string;
  /** 成功时的结构化结果（按 kind 而定） */
  result?: unknown;
  /** 失败时的错误信封 */
  error?: ManagementError;
}

/** 耗时写操作的统一受理应答（LSP：所有异步写方法返回同一信封） */
export interface OperationAccepted {
  operationId: string;
}

/** operations.list 参数 */
export interface OperationsListParams {
  /** 仅包含这些状态；缺省为全部 */
  statuses?: OperationStatus[];
  /** 仅保留最近 N 条；缺省由服务端给上限 */
  limit?: number;
}

/** operations.list 结果 */
export interface OperationsListResult {
  operations: OperationRecord[];
}

/** operations.get 参数 */
export interface OperationsGetParams {
  operationId: string;
}

/** operations.get 结果 */
export interface OperationsGetResult {
  operation: OperationRecord;
}
