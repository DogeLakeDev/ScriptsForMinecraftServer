/**
 * client.ts — 跨模块 service registry 的 SAPI 侧客户端
 *
 * 鉴权同 db:moduleId 走 URL ?moduleId=,token 按请求 Bearer 传入
 * (不写 HttpDB 进程级 static,避免与其它客户端争用 — DIP)
 *
 * 设计:
 *   - service.get(name, input):发 GET /api/sfmc/services/:name?input=...
 *   - 事务内调用走 tx.call(name, input),交互会话内返回真实 result
 *   - service.list:列所有 enabled 模块 provides 的 service
 */

import { HttpDB, type HttpRequestAuthOpts } from "../runtime/httpdb.js";
import { HttpRequestMethod } from "@minecraft/server-net";

let _moduleId = "";
let _authToken = "";
let _isInTx: () => boolean = () => false;

/** 注入当前模块的 service 身份；`inTx` 用于禁止事务外调 service.get。 */
export function setServiceModuleContext(moduleId: string, token: string, inTx: () => boolean): void {
  _moduleId = moduleId;
  _authToken = token;
  _isInTx = inTx;
}

/**
 * 清理 service 模块身份。
 * - 传入 moduleId:仅当当前身份匹配时清空(Demeter:禁用 A 不误清 B)
 * - 省略 moduleId:强制清空
 */
export function clearServiceModuleContext(moduleId?: string): void {
  if (moduleId && _moduleId !== moduleId) return;
  _moduleId = "";
  _authToken = "";
  _isInTx = () => false;
}

/** 已注册跨模块 service 的元信息。 */
export interface ServiceInfo {
  /** service 全名（如 economy.account.get）。 */
  name: string;
  /** 提供方模块 id。 */
  moduleId: string;
}

/** service 客户端错误（含服务端 code 与 HTTP status）。 */
export class ServiceError extends Error {
  /** 错误码。 */
  code: string;
  /** HTTP 状态码；网络错误时为 0。 */
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function withModuleId(path: string): string {
  return HttpDB.withModuleId(path, _moduleId);
}

function authOpts(): HttpRequestAuthOpts | undefined {
  const t = (_authToken || "").trim();
  return t ? { authToken: t } : undefined;
}

function requireModuleContext(op: string): void {
  if (!_moduleId) {
    throw new ServiceError(
      `[service.${op}] 模块上下文未初始化:setServiceModuleContext 未调用`,
      "unauthorized",
      0
    );
  }
}

/** 跨模块 service registry facade。 */
export const service = {
  /** 调用已注册 service；事务内须改用 `db.tx` 的 `tx.call`。 */
  async get<T = unknown>(name: string, input: Record<string, unknown> = {}): Promise<T> {
    requireModuleContext("get");
    if (_isInTx()) {
      throw new ServiceError(
        "事务内调 service 必须用 db.tx 的 tx.call(name, input),不能用 service.get",
        "use_tx_call",
        0
      );
    }
    const qs = new URLSearchParams({ input: JSON.stringify(input) }).toString();
    const res = await HttpDB.typedRequest<{ ok: true; result: T }>(
      HttpRequestMethod.GET,
      withModuleId(`/api/sfmc/services/${encodeURIComponent(name)}?${qs}`),
      undefined,
      authOpts()
    );
    if (!res.ok) {
      // LSP:与 db 客户端一致,保留服务端 code,勿一律打成 internal
      const data = res.data as { error?: string; code?: string } | undefined;
      throw new ServiceError(data?.error ?? res.error ?? "service_error", data?.code || "internal", res.status);
    }
    return (res.data as { ok: true; result: T }).result;
  },

  /** 列出当前 enabled 模块提供的全部 service。 */
  async list(): Promise<ServiceInfo[]> {
    requireModuleContext("list");
    const res = await HttpDB.typedRequest<{ services: ServiceInfo[] }>(
      HttpRequestMethod.GET,
      withModuleId("/api/sfmc/services"),
      undefined,
      authOpts()
    );
    if (res.ok && res.data) return res.data.services;
    return [];
  },
};
