/**
 * service-registry.ts — 跨模块 service.get 后端
 *
 * 协议:
 *   HTTP GET /api/sfmc/services/<name>?input=<urlencoded-json>
 *   鉴权:Bearer module_token + ?moduleId=<callerId>
 *
 * 派发校验:
 *   1. caller moduleId 在 enabledModules
 *   2. caller manifest.services.requires 含此 name
 *   3. 目标服务在某个 enabled 模块 manifest.services.provides 里
 *   4. 提供方模块也必须 enabled(已停用的模块不能被调)
 *
 * 派发:
 *   service-registry 持有 handler map {name → {moduleId, handle(input)}},
 *   提供方模块 init 时通过 registerHandler() 调(在 db-server 进程的内存里,
 *   不是 ipc)。PoC 简化:handler 注册由 db-server 自己持有(后续如要在
 *   独立进程可换 ipc,但目前 handler 就是 db-server 内的同步函数)。
 *
 * 事务内调用:
 *   派发时若有 active tx,把当前 db handle 注入 handler 上下文(handler
 *   要复写 db.query/insert ... — 通过新接口 TxContext)。
 *   当前 PoC:简单场景 service handler 同步返回结果,不要求 handler 自己
 *   写 db;真要写则走独立 transaction(嵌套事务暂不支持 — 平台拒绝)。
 */

import type { ModuleManifestV2 } from "./manifest-loader.js";

export interface ServiceCallInput {
  moduleId: string; // caller
  serviceName: string;
  payload: unknown;
}

export interface ServiceCallResult {
  ok: true;
  result: unknown;
}

export type ServiceCallError =
  | { ok: false; error: string; code: "no_such_service" | "not_in_requires" | "forbidden" | "internal"; status: number };

export interface ServiceDispatchContext {
  callerModuleId: string;
  payload: unknown;
  /** PoC:不暴露 db tx handle;handler 是纯函数。 */
}

export type ServiceHandler = (ctx: ServiceDispatchContext) => Promise<unknown>;

interface RegisteredHandler {
  moduleId: string;
  handle: ServiceHandler;
}

export class ServiceRegistry {
  private readonly handlers = new Map<string, RegisteredHandler>();

  /** 提供方模块 init 时调(在 db-server 进程里注册纯函数)。 */
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

  /**
   * 派发并返回统一 envelope。
   * 失败 → throw,被上层路由 catch 翻译成 HTTP 响应。
   */
  async dispatch(
    enabled: Map<string, ModuleManifestV2>,
    callerModuleId: string,
    name: string,
    payload: unknown
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
    if (!declared) {
      throw new DispatchError(
        `${callerModuleId} 的 manifest.services.requires 未声明 "${name}"`,
        "not_in_requires",
        403
      );
    }
    try {
      const result = await handler.handle({ callerModuleId, payload });
      return { ok: true, result };
    } catch (e) {
      const err = e as Error;
      throw new DispatchError(`handler 抛错: ${err.message}`, "internal", 500);
    }
  }
}

export class DispatchError extends Error {
  code: "no_such_service" | "not_in_requires" | "forbidden" | "internal";
  status: number;
  constructor(message: string, code: "no_such_service" | "not_in_requires" | "forbidden" | "internal", status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
