/**
 * client.ts — 跨模块服务注册表（Service Registry）SAPI 侧客户端门面
 *
 * 模块间通过面向接口与服务名称（如 `economy.account.get`）进行松耦合调用，解耦模块代码依赖。
 *
 * 鉴权与调用设计：
 * - 鉴权机制与 db 保持一致：`moduleId` 经 URL Query 传递，`token` 按请求 Bearer 注入
 * - 常规调用：`service.get(name, input)` 向服务端发起 `GET /api/sfmc/services/:name` 请求
 * - 事务内调用：若处于事务上下文中，必须改用 `db.tx` 的 `tx.call(name, input)`，以纳入统一事务边界
 */

import { HttpDB, type HttpRequestAuthOpts } from "../runtime/httpdb.js";
import { HttpRequestMethod } from "@minecraft/server-net";

let _moduleId = "";
let _authToken = "";
let _isInTx: () => boolean = () => false;

/**
 * 注入当前模块的 service 访问身份上下文。
 *
 * @param moduleId 模块唯一标识符。
 * @param token 模块专属访问 token。
 * @param inTx 用于检查当前是否处于事务中的探针函数。
 */
export function setServiceModuleContext(moduleId: string, token: string, inTx: () => boolean): void {
  _moduleId = moduleId;
  _authToken = token;
  _isInTx = inTx;
}

/**
 * 清理当前模块的 service 身份上下文。
 *
 * @param moduleId 可选的模块 id。若指定，则仅当与当前上下文匹配时才清空（迪米特法则）；若省略则强制全量清空。
 */
export function clearServiceModuleContext(moduleId?: string): void {
  if (moduleId && _moduleId !== moduleId) return;
  _moduleId = "";
  _authToken = "";
  _isInTx = () => false;
}

/** 已注册跨模块服务（service）的元信息。 */
export interface ServiceInfo {
  /** 服务完整标识名称（例如 "economy.account.get"）。 */
  name: string;
  /** 提供此服务的模块 id。 */
  moduleId: string;
}

/** 跨模块服务调用异常（包含服务端返回的业务 code 与 HTTP status）。 */
export class ServiceError extends Error {
  /** 错误码（例如 "use_tx_call"、"unauthorized"、"not_found"）。 */
  code: string;
  /** HTTP 状态码；网络异常时为 0。 */
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
      `[service.${op}] 模块上下文未初始化: setServiceModuleContext 未调用`,
      "unauthorized",
      0
    );
  }
}

/** 跨模块服务注册表访问门面。 */
export const service = {
  /**
   * 调用指定的跨模块服务。
   * 注意：若处于 `db.tx` 事务会话内，须改用事务上下文的 `tx.call(name, input)`。
   *
   * @template T 服务调用返回结果类型。
   * @param name 服务完整名称。
   * @param input 传递给服务的参数字典。
   * @returns 服务执行返回的结果数据。
   * @throws {ServiceError} 服务不存在、鉴权失败或执行出错时抛出。
   */
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
      const data = res.data as { error?: string; code?: string } | undefined;
      throw new ServiceError(data?.error ?? res.error ?? "service_error", data?.code || "internal", res.status);
    }
    return (res.data as { ok: true; result: T }).result;
  },

  /**
   * 获取当前所有处于启用状态的模块所提供的全部服务列表。
   *
   * @returns 可用服务信息数组。
   */
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

