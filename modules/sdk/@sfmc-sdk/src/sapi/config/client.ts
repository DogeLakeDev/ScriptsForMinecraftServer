/**
 * client.ts — 模块配置(configs/<configKey>.json)的 SAPI 侧客户端
 *
 * 设计:
 *   - 首次访问时,SDK 发 GET /api/sfmc/configs/<configKey> 拉全,缓存在 _cache
 *   - get(key):同步从 _cache 读
 *   - set(key, value):写 _cache + 发 POST /api/sfmc/configs/<configKey>/set 持久化
 *   - onChange:订阅 set 触发的内存变更
 *
 * 为什么不放 ConfigManager:ConfigManager 现有缓存只展平 settings.json;
 * 模块私有 configKey(land.json / economy.json)按 configKey 隔离,需要新机制。
 */

import { HttpDB } from "../runtime/httpdb.js";
import { HttpRequestMethod } from "@minecraft/server-net";

let _moduleId = "";
let _configKey = "";
const _cache = new Map<string, unknown>();
let _loadPromise: Promise<void> | null = null;

export function setConfigModuleContext(moduleId: string, configKey: string, token: string): void {
  _moduleId = moduleId;
  _configKey = configKey;
  _cache.clear();
  _loadPromise = null;
  HttpDB.setAuthToken(token);
}

export function clearConfigModuleContext(): void {
  _moduleId = "";
  _configKey = "";
  _cache.clear();
  _loadPromise = null;
  HttpDB.setAuthToken("");
}

/**
 * 与 db/service 客户端一致:鉴权身份走 ?moduleId=。
 * verifyModuleAuth 只认 query 上的 moduleId,body 里的 moduleId 不算数;
 * 之前 config 漏带 query → 即便注入了 token 也会 401(LSP/DRY 违规)。
 */
function withModuleId(path: string): string {
  if (!_moduleId) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}moduleId=${encodeURIComponent(_moduleId)}`;
}

async function ensureLoaded(): Promise<void> {
  if (!_configKey) {
    throw new Error("[config] 模块上下文未初始化,setConfigModuleContext 未调用");
  }
  if (_loadPromise) return _loadPromise;
  _loadPromise = (async () => {
    const res = await HttpDB.typedRequest<{ config: Record<string, unknown> }>(
      HttpRequestMethod.GET,
      withModuleId(`/api/sfmc/configs/${encodeURIComponent(_configKey)}`),
      undefined
    );
    if (res.ok && res.data) {
      for (const [k, v] of Object.entries(res.data.config ?? {})) {
        _cache.set(k, v);
      }
    }
  })();
  return _loadPromise;
}

const _changeHandlers = new Set<(key: string, value: unknown) => void>();

export const config = {
  async get<T = unknown>(key: string): Promise<T | undefined> {
    await ensureLoaded();
    return _cache.get(key) as T | undefined;
  },

  async set<T = unknown>(key: string, value: T): Promise<void> {
    if (!_configKey) {
      throw new Error("[config] 模块上下文未初始化");
    }
    const res = await HttpDB.typedRequest<{ ok: true }>(
      HttpRequestMethod.POST,
      withModuleId(`/api/sfmc/configs/${encodeURIComponent(_configKey)}/set`),
      { key, value }
    );
    if (res.ok) {
      _cache.set(key, value);
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
