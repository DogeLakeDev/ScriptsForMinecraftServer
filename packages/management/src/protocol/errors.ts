/**
 * errors.ts — 管理协议结构化错误信封
 *
 * 使用场景：所有管理方法的失败响应统一携带本信封（LSP：读/写方法错误结构一致），
 * 界面按 code 做本地化与分流处理，message 仅作诊断展示，不做字符串匹配。
 */

/** 结构化错误码（界面据此本地化；新增错误类型在此扩展） */
export type ManagementErrorCode =
  /** 请求帧无法解析或缺少必要字段 */
  | "invalid_request"
  /** 鉴权失败（token 不符） */
  | "unauthorized"
  /** 当前平台版本/能力集不支持该方法 */
  | "unsupported"
  /** 守护进程或目标服务不可用（未运行、连接断开） */
  | "unavailable"
  /** 目标对象不存在（模块、配置、任务等） */
  | "not_found"
  /** 状态冲突（已在运行、重复接入等） */
  | "conflict"
  /** 维护锁被占用，写操作需稍后重试 */
  | "locked"
  /** 参数或配置校验失败 */
  | "validation"
  /** 底层 IO / 网络 / 子进程失败 */
  | "io"
  /** 未分类内部错误 */
  | "internal";

/** 统一错误信封 */
export interface ManagementError {
  code: ManagementErrorCode;
  /** 诊断用技术描述（服务端语言，不做本地化匹配） */
  message: string;
  /** 可选结构化补充（如校验失败的字段列表） */
  details?: unknown;
}

/** 构造 ManagementError 的便捷助手 */
export function managementError(code: ManagementErrorCode, message: string, details?: unknown): ManagementError {
  return details === undefined ? { code, message } : { code, message, details };
}

/** 类型守卫：未知值是否为 ManagementError 信封 */
export function isManagementError(value: unknown): value is ManagementError {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Partial<ManagementError>;
  return typeof v.code === "string" && typeof v.message === "string";
}

/** 把捕获的异常规整为 ManagementError（默认 internal） */
export function toManagementError(e: unknown, code: ManagementErrorCode = "internal"): ManagementError {
  if (isManagementError(e)) return { code: e.code, message: e.message, ...(e.details === undefined ? {} : { details: e.details }) };
  return { code, message: e instanceof Error ? e.message : String(e) };
}
