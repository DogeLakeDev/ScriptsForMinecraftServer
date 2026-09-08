/**
 * config-manager — BP 冷启动时从 db-server 拉取平台配置并保留进程内只读快照。
 *
 * 不是为了「少读几次」，而是提供同步 API（isEnabled / token / permissions），
 * 并落实「改 configs 须重启 BDS」的产品约定。
 */

import type { DataAdapter } from "../data-adapter.js";
export type { DataAdapter };

type ConfigCache = {
  /** 启停态：同时按 catalog id 与 configKey 索引 */
  modules: Map<string, boolean>;
  /** catalog id → configKey */
  moduleConfigKeys: Map<string, string>;
  /** catalog id → HMAC module token（来自 configs/all.module_tokens） */
  moduleTokens: Map<string, string>;
  /** settings.json 投影（保持 JSON 原类型） */
  settings: Map<string, unknown>;
  permissions: Record<string, number>;
};

type ModuleListEntry = {
  id?: string;
  module_id?: string;
  config_key?: string;
  configKey?: string;
  name?: string;
  enabled?: boolean;
  installed?: boolean;
};

type AllConfigs = {
  modules?: ModuleListEntry[];
  /** loopback 下发的模块 HMAC token；SAPI 无 fs，靠此注入身份（DIP） */
  module_tokens?: Record<string, string>;
  settings?: Record<string, unknown>;
  permissions?: Array<{ player_name: string; level: number }>;
};

function emptyCache(): ConfigCache {
  return {
    modules: new Map(),
    moduleConfigKeys: new Map(),
    moduleTokens: new Map(),
    settings: new Map(),
    permissions: {},
  };
}

function indexModuleEntry(cache: ConfigCache, m: ModuleListEntry): void {
  const id = String(m.id || m.module_id || "").trim();
  const key = String(m.config_key || m.configKey || m.name || "").trim();
  const enabled = !!m.enabled && m.installed !== false;
  if (id) {
    cache.modules.set(id, enabled);
    if (key) cache.moduleConfigKeys.set(id, key);
  }
  if (key) cache.modules.set(key, enabled);
}

interface GlobalConfigManagerState {
  cache: ConfigCache;
  ready: boolean;
  data: DataAdapter | null;
}

const gConfigState: GlobalConfigManagerState = (((globalThis as unknown as Record<string, unknown>).__sfmcConfigManagerState as GlobalConfigManagerState) ??= {
  cache: emptyCache(),
  ready: false,
  data: null,
});

/** BP 启动时一次性拉取并缓存的平台配置（无热重载）。 */
export class ConfigManager {
  private static get cache(): ConfigCache {
    return gConfigState.cache;
  }
  private static set cache(val: ConfigCache) {
    gConfigState.cache = val;
  }
  private static get _ready(): boolean {
    return gConfigState.ready;
  }
  private static set _ready(val: boolean) {
    gConfigState.ready = val;
  }
  private static get _data(): DataAdapter | null {
    return gConfigState.data;
  }
  private static set _data(val: DataAdapter | null) {
    gConfigState.data = val;
  }

  /** 由 installHostBootstrap 调用，注入 db-server 数据适配器。 */
  static bindDataAdapter(adapter: DataAdapter): void {
    ConfigManager._data = adapter;
  }

  /**
   * 初始化：健康检查 → 拉全量配置 → 设置 auth token → 标记 ready。
   * 拉取/解析失败时抛错且不置 ready，允许后续重试。
   */
  static async init(): Promise<void> {
    if (ConfigManager._ready) return;
    if (!ConfigManager._data) throw new Error("ConfigManager: bindDataAdapter() before init()");
    await ConfigManager._data.checkHealth();
    const loaded = await ConfigManager.loadAll();
    if (!loaded) {
      throw new Error("ConfigManager: 配置拉取或解析失败，未进入 ready");
    }
    ConfigManager._data.setAuthToken(ConfigManager.getSetting("db_auth_token", ""));
    ConfigManager._ready = true;
    console.log("[ConfigManager] 配置已加载");
  }

  /** 配置是否已成功 init 并可读。 */
  static isReady(): boolean {
    return ConfigManager._ready;
  }

  /** 测试沙箱复位（勿在 BDS 生产路径调用）。 */
  static resetForTesting(): void {
    ConfigManager._ready = false;
    ConfigManager._data = null;
    ConfigManager.cache = emptyCache();
  }

  /**
   * 模块是否启用。key 可为 catalog id（feature-afk）或 configKey（afk）；
   * populate 时按 catalog id 与 configKey 双写索引。
   */
  static isEnabled(module: string): boolean {
    if (!ConfigManager._ready) return false;
    return ConfigManager.cache.modules.get(module) ?? false;
  }

  /** 取模块 HMAC token（来自 configs/all.module_tokens）。 */
  static getModuleToken(moduleId: string): string {
    return ConfigManager.cache.moduleTokens.get(moduleId) ?? "";
  }

  /** 取模块 configKey；无则空串。 */
  static getModuleConfigKey(moduleId: string): string {
    return ConfigManager.cache.moduleConfigKeys.get(moduleId) ?? "";
  }

  /** 读 settings 键；缺失时返回 defaultVal。 */
  static getSetting<T>(key: string, defaultVal?: T): T {
    if (!ConfigManager.cache.settings.has(key)) return defaultVal as T;
    return ConfigManager.cache.settings.get(key) as T;
  }

  /** 取玩家权限覆盖表副本。 */
  static getPermissions(): Record<string, number> {
    return { ...ConfigManager.cache.permissions };
  }

  /**
   * 从 db-server 拉取全量配置并填充缓存。
   * @returns 是否成功写入缓存；失败时保留既有缓存不动。
   */
  static async loadAll(): Promise<boolean> {
    if (!ConfigManager._data) {
      console.warn("[ConfigManager] loadAll: 未 bindDataAdapter");
      return false;
    }
    const body = await ConfigManager._data.getAllConfigs();
    if (!body) {
      console.warn("[ConfigManager] 配置拉取失败");
      return false;
    }
    try {
      const parsed: unknown = JSON.parse(body);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        console.warn("[ConfigManager] 配置根必须是普通对象");
        return false;
      }
      ConfigManager.populate(parsed as AllConfigs);
      return true;
    } catch (e) {
      console.warn(`[ConfigManager] 配置解析失败: ${(e as Error).message}`);
      return false;
    }
  }

  private static populate(all: AllConfigs): void {
    const next = emptyCache();
    for (const m of all.modules || []) {
      indexModuleEntry(next, m);
    }
    for (const [id, token] of Object.entries(all.module_tokens || {})) {
      if (id && typeof token === "string" && token) {
        next.moduleTokens.set(id, token);
      }
    }
    for (const [k, v] of Object.entries(all.settings || {})) {
      next.settings.set(k, v);
    }
    for (const p of all.permissions || []) {
      if (p && typeof p.player_name === "string" && typeof p.level === "number") {
        next.permissions[p.player_name] = p.level;
      }
    }
    ConfigManager.cache = next;
  }
}
