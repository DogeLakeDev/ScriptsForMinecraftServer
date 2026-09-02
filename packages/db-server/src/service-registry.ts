/**
 * service-registry.ts — 跨模块服务注册表与调度中心（Service Registry）
 *
 * 协议规范：
 * - HTTP GET `/api/sfmc/services/<name>?input=<urlencoded-json>`
 * - 鉴权机制：Bearer module_token + 查询参数 `?moduleId=<callerId>`
 *
 * 调度与事务边界：
 * 服务处理器注册在 db-server 进程内存中。
 * 在外层 `db.tx` 事务会话内调用 `tx.call` 时，会通过 `ctx.tx = { query, db }` 注入现有事务上下文，
 * 处理器复用当前事务连接，严禁重复开启嵌套事务。
 */

import type { DatabaseSync } from "node:sqlite";
import type { ModuleManifestV2 } from "./manifest-loader.js";
import type { QueryFn } from "./lib/sqlite.js";

export interface ServiceCallResult {
  ok: true;
  result: unknown;
}

export interface ServiceTxContext {
  query: QueryFn;
  db: DatabaseSync;
}

export interface ServiceDispatchContext {
  callerModuleId: string;
  payload: unknown;
  /** 外层 db.tx 已打开时注入；处理器复用此连接，禁止开启嵌套 BEGIN。 */
  tx?: ServiceTxContext;
}

export type ServiceHandler = (ctx: ServiceDispatchContext) => Promise<unknown>;

interface RegisteredHandler {
  moduleId: string;
  handle: ServiceHandler;
}

/** 跨模块服务注册表管理器。 */
export class ServiceRegistry {
  private readonly handlers = new Map<string, RegisteredHandler>();

  /**
   * 注册指定模块提供的跨模块服务处理器。
   *
   * @param moduleId 服务提供方模块 ID。
   * @param name 服务完整名称。
   * @param handle 业务处理函数。
   */
  registerHandler(moduleId: string, name: string, handle: ServiceHandler): void {
    if (this.handlers.has(name)) {
      throw new Error(`[service] "${name}" 已被 ${this.handlers.get(name)?.moduleId} 注册, ${moduleId} 抢注`);
    }
    this.handlers.set(name, { moduleId, handle });
  }

  /**
   * 注销指定名称的服务处理器。
   *
   * @param name 待注销的服务名称。
   */
  unregisterHandler(name: string): void {
    this.handlers.delete(name);
  }

  /**
   * 获取当前已注册的全部跨模块服务列表。
   *
   * @returns 包含服务名与所属模块 ID 的列表。
   */
  list(): Array<{ name: string; moduleId: string }> {
    return [...this.handlers.entries()].map(([name, h]) => ({ name, moduleId: h.moduleId }));
  }

  /**
   * 调度并执行指定的跨模块服务。
   * 包含调用方与提供方启停状态校验、声明式契约（`services.requires`）匹配及异常分流。
   *
   * @param enabled 当前所有已启用的模块清单字典。
   * @param callerModuleId 发起调用的模块唯一标识符。
   * @param name 目标服务完整名称。
   * @param payload 传入调用的参数数据。
   * @param tx 可选的当前事务上下文。
   * @returns 服务执行返回结果。
   * @throws {DispatchError} 服务未找到、未声明依赖或鉴权失败时抛出。
   */
  async dispatch(

    enabled: Map<string, ModuleManifestV2>,
    callerModuleId: string,
    name: string,
    payload: unknown,
    tx?: ServiceTxContext
  ): Promise<ServiceCallResult> {
    const handler = this.handlers.get(name);
    if (!handler) {
      throw new DispatchError(`service "${name}" 未注册`, "no_such_service", 404);
    }
    if (!enabled.has(handler.moduleId)) {
      throw new DispatchError(`service "${name}" 提供方 ${handler.moduleId} 未 enabled`, "forbidden", 403);
    }
    const caller = enabled.get(callerModuleId);
    if (!caller) {
      throw new DispatchError(`调用方 ${callerModuleId} 未 enabled`, "forbidden", 403);
    }
    const declared = caller.services.requires.find((r) => r.name === name);
    // 提供方调自己的 service 免 requires(例如 economy 白皮书调 stats.monthly)
    if (!declared && callerModuleId !== handler.moduleId) {
      throw new DispatchError(
        `${callerModuleId} 的 manifest.services.requires 未声明 "${name}"`,
        "not_in_requires",
        403
      );
    }
    try {
      const result = await handler.handle({
        callerModuleId,
        payload,
        ...(tx ? { tx } : {}),
      });
      return { ok: true, result };
    } catch (e) {
      // 保留 handler 抛出的领域/鉴权错误契约,勿压成 500 internal(LSP)
      if (e instanceof DispatchError) throw e;
      const err = e as Error & { code?: string; status?: number };
      if (typeof err.status === "number" && err.code) {
        throw new DispatchError(err.message, err.code as DispatchError["code"], err.status);
      }
      throw new DispatchError(`handler 抛错: ${err.message}`, "internal", 500);
    }
  }

}

export class DispatchError extends Error {
  code: "no_such_service" | "not_in_requires" | "forbidden" | "internal" | "domain_error";
  status: number;
  constructor(
    message: string,
    code: "no_such_service" | "not_in_requires" | "forbidden" | "internal" | "domain_error",
    status: number
  ) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
