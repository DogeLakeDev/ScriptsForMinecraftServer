/**
 * client.ts — 模块私有配置（configs/<configKey>.json）SAPI 侧客户端门面
 *
 * 架构设计：
 * - 首次访问时，向 db-server 发送 `GET /api/sfmc/configs/<configKey>` 拉取全量配置并缓存在内存桶中
 * - 多模块隔离：不同模块按 `configKey` 分桶缓存（开闭原则），模块加载时不互相清空
 * - 读写模型：`get` / `getAll` 优先读取内存缓存，`set` 同步更新内存并通过 POST 请求持久化到服务端
 * - 响应式更新：支持通过 `onChange` 订阅内存配置变更通知
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

/** configKey → 缓存桶字典；支持多模块配置共存。 */
const _buckets = new Map<string, ConfigBucket>();
/** 最近一次激活的模块 configKey（兼容快捷的无命名空间访问）。 */
let _activeConfigKey = "";

/**
 * 注入模块私有配置上下文（按 configKey 分桶，支持多模块并发访问）。
 *
 * @param moduleId 模块唯一标识符。
 * @param configKey 配置文件基准名。
 * @param token 模块访问 token。
 */
export function setConfigModuleContext(moduleId: string, configKey: string, token: string): void {
  const existing = _buckets.get(configKey);
  if (existing && existing.moduleId === moduleId && existing.authToken === token) {
    _activeConfigKey = configKey;
    return;
  }
  _buckets.set(configKey, {
    moduleId,
    authToken: token,
    cache: new Map(),
    loadPromise: null,
  });
  _activeConfigKey = configKey;
}

/**
 * 清理配置缓存与模块上下文。
 *
 * @param moduleId 可选的模块 id。若指定，则仅删除对应模块的配置桶（迪米特法则：避免 A 模块操作误清空 B 模块的配置缓存）；若省略则清空全部缓存。
 */
export function clearConfigModuleContext(moduleId?: string): void {
  if (!moduleId) {
    _buckets.clear();
    _activeConfigKey = "";
    return;
  }
  for (const [key, bucket] of [..._buckets.entries()]) {
    if (bucket.moduleId !== moduleId) continue;
    _buckets.delete(key);
    if (_activeConfigKey === key) _activeConfigKey = "";
  }
}

function activeBucket(): ConfigBucket {
  if (!_activeConfigKey) {
    throw new Error("[config] 模块上下文未初始化, setConfigModuleContext 未调用");
  }
  const b = _buckets.get(_activeConfigKey);
  if (!b) {
    throw new Error(`[config] 找不到 configKey=${_activeConfigKey} 的上下文`);
  }
  return b;
}

function authOpts(token: string): HttpRequestAuthOpts | undefined {
  const t = (token || "").trim();
  return t ? { authToken: t } : undefined;
}

/**
 * 为目标 URL 路径附加 `?moduleId=` 或 `&moduleId=` 查询参数（与 db/service 客户端保持一致）。
 * 服务端鉴权中间件通过 URL 查询参数校验模块身份。
 *
 * @param path 原始请求相对路径。
 * @param moduleId 模块唯一标识符。
 * @returns 附加模块参数后的完整请求路径。
 */
function withModuleId(path: string, moduleId: string): string {
  return HttpDB.withModuleId(path, moduleId);
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

const _changeHandlers = new Set<(key: string, value: unknown) => void>();

/** 模块私有配置访问门面（映射 `configs/<configKey>.json`）。 */
export const config = {
  /**
   * 读取指定配置项的值（首次访问时自动向服务端拉取全量配置并缓存）。
   *
   * @template T 配置值类型。
   * @param key 配置项键名。
   * @returns 配置项对应的值，若不存在则返回 `undefined`。
   */
  async get<T = unknown>(key: string): Promise<T | undefined> {
    const bucket = activeBucket();
    await ensureLoaded(bucket, _activeConfigKey);
    return bucket.cache.get(key) as T | undefined;
  },

  /**
   * 读取当前模块的整份配置对象。
   *
   * @template T 配置对象类型。
   * @returns 完整的配置字典。
   */
  async getAll<T = Record<string, unknown>>(): Promise<T> {
    const bucket = activeBucket();
    await ensureLoaded(bucket, _activeConfigKey);
    const out: Record<string, unknown> = {};
    for (const [k, v] of bucket.cache.entries()) out[k] = v;
    return out as T;
  },

  /**
   * 设置并持久化指定配置项。更新内存缓存并向 db-server 发送持久化写入请求。
   *
   * @template T 配置值类型。
   * @param key 配置项键名。
   * @param value 欲写入的新值。
   * @throws {Error} 服务端持久化写入失败时抛出异常。
   */
  async set<T = unknown>(key: string, value: T): Promise<void> {
    const bucket = activeBucket();
    const configKey = _activeConfigKey;
    const res = await HttpDB.typedRequest<{ ok: true }>(
      HttpRequestMethod.POST,
      withModuleId(`/api/sfmc/configs/${encodeURIComponent(configKey)}/set`, bucket.moduleId),
      { key, value },
      authOpts(bucket.authToken)
    );
    if (res.ok) {
      bucket.cache.set(key, value);
      for (const h of _changeHandlers) h(key, value);
    } else {
      throw new Error(`[config] set 失败: ${res.error ?? "unknown"}`);
    }
  },

  /**
   * 订阅模块私有配置项的内存变更事件。
   *
   * @param handler 接收发生变更的键与新值的回调函数。
   * @returns 取消订阅的清理函数。
   */
  onChange(handler: (key: string, value: unknown) => void): () => void {
    _changeHandlers.add(handler);
    return () => _changeHandlers.delete(handler);
  },
};

