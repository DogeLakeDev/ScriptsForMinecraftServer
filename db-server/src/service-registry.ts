/**
 * service-registry.ts — 跨模块 service.get 后端
 *
 * 协议:
 *   HTTP GET /api/sfmc/services/<name>?input=<urlencoded-json>
 *   鉴权:Bearer module_token + ?moduleId=<callerId>
 *
 * 派发:
 *   handler 注册在 db-server 进程内存。外层 db.tx 内的 tx.call 会注入
 *   ctx.tx = { query, db },handler 不得再 BEGIN(方案 A)。
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
  /** 外层 db.tx 已打开时注入;handler 复用连接,禁止嵌套 BEGIN */
  tx?: ServiceTxContext;
}

export type ServiceHandler = (ctx: ServiceDispatchContext) => Promise<unknown>;

interface RegisteredHandler {
  moduleId: string;
  handle: ServiceHandler;
}

export class ServiceRegistry {
  private readonly handlers = new Map<string, RegisteredHandler>();

  /** 提供方在 db-server 启动期注册 handler */
  registerHandler(moduleId: string, name: string, handle: ServiceHandler): void {
    if (this.handlers.has(name)) {
      throw new Error(`[service] "${name}" 已被 ${this.handlers.get(name)?.moduleId} 注册,${moduleId} 抢注`);
    }
    this.handlers.set(name, { moduleId, handle });
  }

  unregisterHandler(name: string): void {
    this.handlers.delete(name);
  }

  list(): Array<{ name: string; moduleId: string }> {
    return [...this.handlers.entries()].map(([name, h]) => ({ name, moduleId: h.moduleId }));
  }

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

  /** 查询 service 提供方 moduleId(供 tx.call 与 HTTP 共用鉴权策略) */
  getProvider(name: string): string | undefined {
    return this.handlers.get(name)?.moduleId;
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
