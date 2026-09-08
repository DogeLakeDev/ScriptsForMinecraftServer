/**
 * client.ts — 跨模块服务注册表（Service Registry）SAPI 侧客户端门面
 *
 * 模块间通过面向接口与服务名称（如 `economy.account.get`）进行松耦合调用，解耦模块代码依赖。
 *
 * 鉴权与调用设计（方案 A：作用域实例）：
 * - 推荐 `createServiceClient(moduleId, token, inTx)`：身份封闭在闭包；`inTx` 应绑定配对 DbClient.isTxRecording
 * - `setServiceModuleContext` + 单例 `service` 兼容旧代码，按 moduleId 登记并转发到激活实例
 * - 进程内 `provide` 注册本地 handler；`get` / `call` 优先走本地总线，未命中再 HTTP fallback
 */

import { HttpDB, SafeHttpMethod, type HttpRequestAuthOpts } from "../runtime/httpdb.js";

/** 已注册跨模块服务（service）的元信息。 */
export interface ServiceInfo {
  /** 服务完整标识名称（例如 "economy.account.get"）。 */
  name: string;
  /** 提供此服务的模块 id。 */
  moduleId: string;
}

/** 进程内服务处理函数（SAPI 同进程注册）。 */
export type ServiceHandler = (
  input: Record<string, unknown>
) => unknown | Promise<unknown>;

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

/* ── 进程内本地总线（优先于 HTTP） ── */

type LocalEntry = { moduleId: string; handler: ServiceHandler };

interface GlobalServiceClientState {
  localHandlers: Map<string, LocalEntry>;
  clients: Map<string, ServiceClient>;
  activeModuleId: string;
}

const gServiceState: GlobalServiceClientState = (((globalThis as unknown as Record<string, unknown>).__sfmcServiceClientState as GlobalServiceClientState) ??= {
  localHandlers: new Map<string, LocalEntry>(),
  clients: new Map<string, ServiceClient>(),
  activeModuleId: "",
});

const _localHandlers = gServiceState.localHandlers;

/**
 * 在 SAPI 进程内注册服务处理器。
 * @returns 注销函数（cleanup 时调用）。
 */
export function provide(name: string, handler: ServiceHandler): () => void {
  if (!name || typeof handler !== "function") {
    throw new ServiceError("[service.provide] 需要非空 name 与 handler", "invalid_argument", 0);
  }
  const moduleId = gServiceState.activeModuleId || "unknown";
  _localHandlers.set(name, { moduleId, handler });
  return () => {
    const cur = _localHandlers.get(name);
    if (cur && cur.handler === handler) _localHandlers.delete(name);
  };
}

/** 按模块 id 批量清除本地处理器（模块 cleanup 用）。 */
export function clearLocalProvides(moduleId?: string): void {
  if (!moduleId) {
    _localHandlers.clear();
    return;
  }
  for (const [name, entry] of _localHandlers) {
    if (entry.moduleId === moduleId) _localHandlers.delete(name);
  }
}

async function tryLocal<T>(name: string, input: Record<string, unknown>): Promise<T | undefined> {
  const entry = _localHandlers.get(name);
  if (!entry) return undefined;
  return (await entry.handler(input ?? {})) as T;
}

/**
 * 作用域 service 客户端：moduleId/token 封闭在实例内。
 * `inTx` 探针应由配对的 DbClient.isTxRecording 提供，避免全局事务误杀。
 */
export interface ServiceClient {
  readonly moduleId: string;
  setAuthToken(token: string): void;
  setInTxProbe(inTx: () => boolean): void;
  get<T = unknown>(name: string, input?: Record<string, unknown>): Promise<T>;
  /** 与 get 同义；语义上强调跨模块 RPC 调用。 */
  call<T = unknown>(name: string, input?: Record<string, unknown>): Promise<T>;
  /** 进程内注册服务；返回注销函数。 */
  provide(name: string, handler: ServiceHandler): () => void;
  list(): Promise<ServiceInfo[]>;
}

/**
 * 创建绑定到指定模块身份的 service 客户端（推荐路径）。
 *
 * @param moduleId 模块唯一标识符。
 * @param token 模块专属访问 token。
 * @param inTx 检查配对 DbClient 是否处于事务中的探针（默认恒 false）。
 */
export function createServiceClient(
  moduleId: string,
  token: string,
  inTx: () => boolean = () => false
): ServiceClient {
  if (!moduleId) {
    throw new ServiceError("[service] createServiceClient 需要非空 moduleId", "unauthorized", 0);
  }

  const state = {
    token: token || "",
    isInTx: inTx,
  };

  function authOpts(): HttpRequestAuthOpts | undefined {
    const t = (state.token || "").trim();
    return t ? { authToken: t } : undefined;
  }

  function withModuleId(path: string): string {
    return HttpDB.withModuleId(path, moduleId);
  }

  function requireModuleContext(op: string): void {
    if (!moduleId) {
      throw new ServiceError(`[service.${op}] 模块上下文未初始化`, "unauthorized", 0);
    }
  }

  return {
    get moduleId() {
      return moduleId;
    },
    setAuthToken(next: string) {
      state.token = next || "";
    },
    setInTxProbe(probe: () => boolean) {
      state.isInTx = probe;
    },

    async get(name, input = {}) {
      requireModuleContext("get");
      if (state.isInTx()) {
        throw new ServiceError(
          "事务内调 service 必须用 db.tx 的 tx.call(name, input),不能用 service.get",
          "use_tx_call",
          0
        );
      }
      const local = await tryLocal(name, input);
      if (local !== undefined) return local as never;

      const qs = new URLSearchParams({ input: JSON.stringify(input) }).toString();
      const res = await HttpDB.typedRequest<{ ok: true; result: unknown }>(
        SafeHttpMethod.Get,
        withModuleId(`/api/sfmc/services/${encodeURIComponent(name)}?${qs}`),
        undefined,
        authOpts()
      );
      if (!res.ok) {
        const data = res.data as { error?: string; code?: string } | undefined;
        throw new ServiceError(data?.error ?? res.error ?? "service_error", data?.code || "internal", res.status);
      }
      return (res.data as { ok: true; result: unknown }).result as never;
    },

    call(name, input = {}) {
      return this.get(name, input);
    },

    provide(name, handler) {
      requireModuleContext("provide");
      if (!name || typeof handler !== "function") {
        throw new ServiceError("[service.provide] 需要非空 name 与 handler", "invalid_argument", 0);
      }
      _localHandlers.set(name, { moduleId, handler });
      return () => {
        const cur = _localHandlers.get(name);
        if (cur && cur.handler === handler) _localHandlers.delete(name);
      };
    },

    async list() {
      requireModuleContext("list");
      const res = await HttpDB.typedRequest<{ services: ServiceInfo[] }>(
        SafeHttpMethod.Get,
        withModuleId("/api/sfmc/services"),
        undefined,
        authOpts()
      );
      if (res.ok && res.data) return res.data.services;
      return [];
    },
  };
}

/* ── 兼容层：按 moduleId 登记 + 单例转发 ── */

const _clients = gServiceState.clients;

/**
 * 注入/刷新模块的 service 访问身份，并激活为单例 `service` 的转发目标。
 */
export function setServiceModuleContext(moduleId: string, token: string, inTx: () => boolean): void {
  const existing = _clients.get(moduleId);
  if (existing) {
    existing.setAuthToken(token);
    existing.setInTxProbe(inTx);
    gServiceState.activeModuleId = moduleId;
    return;
  }
  _clients.set(moduleId, createServiceClient(moduleId, token, inTx));
  gServiceState.activeModuleId = moduleId;
}

/** 按 moduleId 取出已登记的作用域 service 客户端。 */
export function getServiceClient(moduleId: string): ServiceClient {
  const c = _clients.get(moduleId);
  if (!c) {
    throw new ServiceError(
      `[service] 未找到 moduleId=${moduleId} 的客户端（须先 setServiceModuleContext）`,
      "unauthorized",
      0
    );
  }
  return c;
}

/**
 * 清理当前模块的 service 身份上下文。
 * @param moduleId 若指定则仅删除该模块；省略则清空全部。
 */
export function clearServiceModuleContext(moduleId?: string): void {
  if (!moduleId) {
    _clients.clear();
    gServiceState.activeModuleId = "";
    return;
  }
  _clients.delete(moduleId);
  if (gServiceState.activeModuleId === moduleId) gServiceState.activeModuleId = "";
}

function activeClient(): ServiceClient {
  if (!gServiceState.activeModuleId) {
    throw new ServiceError(
      `[service] 模块上下文未初始化: setServiceModuleContext 未调用`,
      "unauthorized",
      0
    );
  }
  const c = _clients.get(gServiceState.activeModuleId);
  if (!c) {
    throw new ServiceError(
      `[service] 找不到已激活 moduleId=${gServiceState.activeModuleId} 的客户端`,
      "unauthorized",
      0
    );
  }
  return c;
}

/** 跨模块服务注册表访问门面（兼容单例）。 */
export const service: Omit<ServiceClient, "moduleId" | "setAuthToken" | "setInTxProbe"> = {
  get(name, input) {
    return activeClient().get(name, input);
  },
  call(name, input) {
    return activeClient().call(name, input);
  },
  provide(name, handler) {
    return activeClient().provide(name, handler);
  },
  list() {
    return activeClient().list();
  },
};
