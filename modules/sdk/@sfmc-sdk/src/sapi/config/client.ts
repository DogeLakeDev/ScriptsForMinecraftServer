/**
 * client.ts — 模块配置(configs/<configKey>.json)的 SAPI 侧客户端
 *
 * 设计:
 *   - 首次访问时,SDK 发 GET /api/sfmc/configs/<configKey> 拉全,缓存在 _cache
 *   - get(key):从 _cache 读单字段
 *   - getAll():整份配置对象
 *   - set(key, value):写 _cache + 发 POST /api/sfmc/configs/<configKey>/set 持久化
 *   - onChange:订阅 set 触发的内存变更
 *
 * 为什么不放 ConfigManager:ConfigManager 现有缓存只展平 settings.json;
 * 模块私有 configKey(land.json / economy.json)按 configKey 隔离,需要新机制。
 *
 * 多模块:按 configKey 分桶缓存(OCP),bootModule 注入时不互相清空。
 */

import { HttpDB, type HttpRequestAuthOpts } from "../runtime/httpdb.js";
import { HttpRequestMethod } from "@minecraft/server-net";

type ConfigBucket = {
  moduleId: string;
  authToken: string;
  cache: Map<string, unknown>;
  loadPromise: Promise<void> | null;
};

/** configKey → 桶;支持多模块并存(OCP)。 */
const _buckets = new Map<string, ConfigBucket>();
/** 最近一次 setConfigModuleContext 的 configKey(兼容无参 get/set)。 */
let _activeConfigKey = "";

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

export function clearConfigModuleContext(): void {
  _buckets.clear();
  _activeConfigKey = "";
}

function activeBucket(): ConfigBucket {
  if (!_activeConfigKey) {
    throw new Error("[config] 模块上下文未初始化,setConfigModuleContext 未调用");
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
 * 与 db/service 客户端一致:鉴权身份走 ?moduleId=。
 * verifyModuleAuth 只认 query 上的 moduleId,body 里的 moduleId 不算数;
 * 之前 config 漏带 query → 即便注入了 token 也会 401(LSP/DRY 违规)。
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

export const config = {
  async get<T = unknown>(key: string): Promise<T | undefined> {
    const bucket = activeBucket();
    await ensureLoaded(bucket, _activeConfigKey);
    return bucket.cache.get(key) as T | undefined;
  },

  /** 整份模块配置(afk.json 顶层字段一次取齐)。 */
  async getAll<T = Record<string, unknown>>(): Promise<T> {
    const bucket = activeBucket();
    await ensureLoaded(bucket, _activeConfigKey);
    const out: Record<string, unknown> = {};
    for (const [k, v] of bucket.cache.entries()) out[k] = v;
    return out as T;
  },

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

  onChange(handler: (key: string, value: unknown) => void): () => void {
    _changeHandlers.add(handler);
    return () => _changeHandlers.delete(handler);
  },
};
