/**
 * services.ts — 服务总览与服务控制的协议类型
 *
 * 使用场景：桌面端服务总览页（services.list）与启停/重启操作
 * （services.start / services.stop / services.restart，写操作返回 OperationAccepted）。
 * 与 CLI 内部 ServiceStatus 结构对齐，但本文件是线缆契约的唯一权威（DRY）。
 */

/** 受管服务名（与 CLI ServiceName 对齐） */
export type ManagedServiceName = "bds" | "db" | "tunnel" | "qq" | "llbot";

/** 单服务运行态行（services.list 结果元素与 serviceState 事件载荷） */
export interface ServiceStatusRow {
  name: ManagedServiceName;
  /** 展示名（如 "BDS" / "DB Server"） */
  title: string;
  running: boolean;
  pid: number;
  /** 运行时长的人性化文本（如 "2h 5m"；未运行为 "—"） */
  uptime: string;
  /** 进程归属：managed=守护进程拉起；external=外部已存在进程 */
  ownership?: "managed" | "external";
}

/** services.list 结果 */
export interface ServicesListResult {
  rows: ServiceStatusRow[];
}

/** services.start / stop / restart 参数 */
export interface ServiceActionParams {
  /** 目标服务；特殊值 "all" 表示批量（仅 start/stop/restart 支持） */
  name: ManagedServiceName | "all";
}

/** 服务启停状态推送（event: "serviceState"） */
export interface ServiceStateChanged {
  name: ManagedServiceName;
  running: boolean;
  pid: number;
}

/** services.send 参数：向服务 stdin 写入一行命令 */
export interface ServiceSendParams {
  name: ManagedServiceName;
  message: string;
}

/** services.send 结果 */
export interface ServiceSendResult {
  /** 是否已写入 stdin（外部进程无 stdin 时为 false） */
  delivered: boolean;
  /** 未投递时的原因说明（诊断文案） */
  reason?: string;
}
