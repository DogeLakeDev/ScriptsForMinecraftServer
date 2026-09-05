/**
 * client.ts — 模块私有配置（configs/<configKey>.json）SAPI 侧客户端门面
 *
 * 架构设计（方案 A：作用域实例）：
 * - 推荐 `createConfigClient(moduleId, configKey, token)`：读写与 onChange 均绑定该 configKey
 * - `_buckets` 按 configKey 分桶缓存（多模块共存）；变更 handlers 按客户端/configKey 隔离，杜绝跨模块广播
 * - 单例 `config` 兼容旧代码，转发到「当前激活」configKey 对应客户端
 *
 * 职责边界：
 * 全局平台级配置（`modules` / `settings` / `permissions`）由 `ConfigManager` 统一缓存维护；
 * 模块私有业务配置按命名空间独立隔离，统一经本客户端与服务端的 module-config API 交互。
 */

import { HttpDB, type HttpRequestAuthOpts } from "../runtime/httpdb.js";
import { HttpRequestMethod } from "@minecraft/server-net";

type ConfigBucket = {
  moduleId: string;
  authToken: string;
  cache: Map<string, unknown>;
  loadPromise: Promise<void> | null;
};

type ChangeHandler = (key: string, value: unknown) => void;

/** configKey → 缓存桶字典；支持多模块配置共存。 */
const _buckets = new Map<string, ConfigBucket>();

/**
 * 作用域配置客户端：绑定固定 configKey，onChange 仅接收本客户端 set 触发的事件。
 */
export interface ConfigClient {
  readonly moduleId: string;
  readonly configKey: string;
  setAuthToken(token: string): void;
  get<T = unknown>(key: string): Promise<T | undefined>;
  getAll<T = Record<string, unknown>>(): Promise<T>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  onChange(handler: ChangeHandler): () => void;
}

function authOpts(token: string): HttpRequestAuthOpts | undefined {
  const t = (token || "").trim();
  return t ? { authToken: t } : undefined;
}

function withModuleId(path: string, moduleId: string): string {
  return HttpDB.withModuleId(path, moduleId);
}

function ensureBucket(moduleId: string, configKey: string, token: string): ConfigBucket {
  const existing = _buckets.get(configKey);
  if (existing && existing.moduleId === moduleId) {
    existing.authToken = token;
    return existing;
  }
  const bucket: ConfigBucket = {
    moduleId,
    authToken: token,
    cache: new Map(),
    loadPromise: null,
  };
  _buckets.set(configKey, bucket);
  return bucket;
}

async function ensureLoaded(bucket: ConfigBucket, configKey: string): Promise<void> {
  if (bucket.loadPromise) return bucket.loadPromise;
  bucket.loadPromise = (async () => {
    const res = await HttpDB.typedRequest<{ config: Record<string, unknown> }>(
      HttpRequestMethod.GET,
      withModuleId(`/api/sfmc/configs/${encodeURIComponent(configKey)}`, bucket.moduleId),
      undefined,
      authOpts(bucket.authToken)
    );
    if (res.ok && res.data) {
      for (const [k, v] of Object.entries(res.data.config ?? {})) {
        bucket.cache.set(k, v);
      }
    }
  })();
  return bucket.loadPromise;
}

/**
 * 创建绑定到指定模块 / configKey 的配置客户端（推荐路径）。
 */
export function createConfigClient(moduleId: string, configKey: string, token: string): ConfigClient {
  if (!moduleId || !configKey) {
    throw new Error("[config] createConfigClient 需要非空 moduleId 与 configKey");
  }

  const state = { token: token || "" };
  const handlers = new Set<ChangeHandler>();
  ensureBucket(moduleId, configKey, state.token);

  return {
    get moduleId() {
      return moduleId;
    },
    get configKey() {
      return configKey;
    },
    setAuthToken(next: string) {
      state.token = next || "";
      const b = _buckets.get(configKey);
      if (b && b.moduleId === moduleId) b.authToken = state.token;
    },

    async get(key) {
      const bucket = ensureBucket(moduleId, configKey, state.token);
      await ensureLoaded(bucket, configKey);
      return bucket.cache.get(key) as never;
    },

    async getAll() {
      const bucket = ensureBucket(moduleId, configKey, state.token);
      await ensureLoaded(bucket, configKey);
      const out: Record<string, unknown> = {};
      for (const [k, v] of bucket.cache.entries()) out[k] = v;
      return out as never;
    },

    async set(key, value) {
      const bucket = ensureBucket(moduleId, configKey, state.token);
      const res = await HttpDB.typedRequest<{ ok: true }>(
        HttpRequestMethod.POST,
        withModuleId(`/api/sfmc/configs/${encodeURIComponent(configKey)}/set`, moduleId),
        { key, value },
        authOpts(state.token)
      );
      if (res.ok) {
        bucket.cache.set(key, value);
        for (const h of handlers) h(key, value);
      } else {
        throw new Error(`[config] set 失败: ${res.error ?? "unknown"}`);
      }
    },

    onChange(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
  };
}

/* ── 兼容层：按 configKey 登记客户端 + 单例转发 ── */

const _clients = new Map<string, ConfigClient>();
/** moduleId → configKey，供 clear(moduleId) 精确删除。 */
const _configKeyByModule = new Map<string, string>();
let _activeConfigKey = "";

/**
 * 注入模块私有配置上下文（按 configKey 分桶，支持多模块并发访问）。
 */
export function setConfigModuleContext(moduleId: string, configKey: string, token: string): void {
  const existing = _clients.get(configKey);
  if (existing && existing.moduleId === moduleId) {
    existing.setAuthToken(token);
    _activeConfigKey = configKey;
    _configKeyByModule.set(moduleId, configKey);
    return;
  }
  const client = createConfigClient(moduleId, configKey, token);
  _clients.set(configKey, client);
  _configKeyByModule.set(moduleId, configKey);
  _activeConfigKey = configKey;
}

/** 按 configKey 取出已登记的作用域配置客户端。 */
export function getConfigClient(configKey: string): ConfigClient {
  const c = _clients.get(configKey);
  if (!c) {
    throw new Error(`[config] 未找到 configKey=${configKey} 的客户端（须先 setConfigModuleContext）`);
  }
  return c;
}

/**
 * 清理配置缓存与模块上下文。
 * @param moduleId 若指定则仅删除对应模块；省略则清空全部。
 */
export function clearConfigModuleContext(moduleId?: string): void {
  if (!moduleId) {
    _buckets.clear();
    _clients.clear();
    _configKeyByModule.clear();
    _activeConfigKey = "";
    return;
  }
  const key = _configKeyByModule.get(moduleId);
  _configKeyByModule.delete(moduleId);
  if (key) {
    _clients.delete(key);
    _buckets.delete(key);
    if (_activeConfigKey === key) _activeConfigKey = "";
  }
  // 兜底：按 bucket.moduleId 扫描（兼容旧调用未走登记表的情况）
  for (const [k, bucket] of [..._buckets.entries()]) {
    if (bucket.moduleId !== moduleId) continue;
    _buckets.delete(k);
    _clients.delete(k);
    if (_activeConfigKey === k) _activeConfigKey = "";
  }
}

function activeClient(): ConfigClient {
  if (!_activeConfigKey) {
    throw new Error("[config] 模块上下文未初始化, setConfigModuleContext 未调用");
  }
  const c = _clients.get(_activeConfigKey);
  if (!c) {
    throw new Error(`[config] 找不到 configKey=${_activeConfigKey} 的上下文`);
  }
  return c;
}

/** 模块私有配置访问门面（兼容单例）。 */
export const config: Omit<ConfigClient, "moduleId" | "configKey" | "setAuthToken"> = {
  get(key) {
    return activeClient().get(key);
  },
  getAll() {
    return activeClient().getAll();
  },
  set(key, value) {
    return activeClient().set(key, value);
  },
  onChange(handler) {
    return activeClient().onChange(handler);
  },
};
