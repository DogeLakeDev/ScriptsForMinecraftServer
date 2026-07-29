/**
 * config-manager — 在 BP 启动时一次性从 db-server 拉取所有配置并缓存。
 *
 * 设计要点:
 * - **零外部耦合**:本文件不知道 HttpDB / CreativeArea / Peace 等具体模块存在。
 *   IO 通过 `DataAdapter` 注入(由 @sfmc-bds/sdk/sapi/host 数据适配器提供)。
 *   模块开关变化通过 `onModuleEnabledChange(cb)` 订阅,模块自己决定如何响应。
 * - **无热重载**:配置在 SAPI 启动时一次拉取,改 configs/*.json 后重启 BDS 即可。
 *
 * 历史形态:曾硬编码 `_syncRuntimeFlags` 把 CreativeArea.enable / Peace.enable 推下去,
 *          这种反向耦合是旧 @sfmc-bds/sapi-host 时代的产物。本轮迁到 @sfmc-bds/sdk
 *          时彻底切断,改为事件订阅。
 */

// DataAdapter 已迁出到 ../data-adapter.ts,这里仅 re-export 保留 import 兼容
export type { DataAdapter } from "../data-adapter.js";

/** ConfigManager 可读的配置域键名。 */
export type ConfigKey =
  | "modules"
  | "settings"
  | "areas"
  | "permissions"
  | "banned_items"
  | "clean"
  | "grids"
  | "peace_filters"
  | "questions";

type ConfigCache = {
  /** 启停态:同时按 catalog id 与 configKey 索引(OCP/LSP) */
  modules: Map<string, boolean>;
  /** catalog id → configKey */
  moduleConfigKeys: Map<string, string>;
  /** catalog id → HMAC module token(来自 configs/all.module_tokens) */
  moduleTokens: Map<string, string>;
  settings: Map<string, string>;
  areas: any[];
  permissions: Record<string, number>;
  bannedItems: string[];
  clean: { itemMax: number; pollInterval: number };
  grids: Record<string, any>;
  peaceFilters: any[];
  questions: any[];
};

type AllConfigs = {
  modules: Array<{
    id?: string;
    module_id?: string;
    config_key?: string;
    configKey?: string;
    name?: string;
    enabled?: boolean;
    installed?: boolean;
  }>;
  /** loopback 下发的模块 HMAC token;SAPI 无 fs,靠此注入身份(DIP) */
  module_tokens?: Record<string, string>;
  settings: Record<string, any>;
  areas: Array<{
    name?: string;
    module: string;
    dimension: any;
    start_x: number;
    start_z: number;
    end_x: number;
    end_z: number;
  }>;
  permissions: Array<{ player_name: string; level: number }>;
  /** 权威为 string[];兼容历史 {item_id} */
  banned_items: Array<string | { item_id?: string }>;
  clean: { item_max?: number; poll_interval?: number };
  grids: Array<{
    name: string;
    start_x: number;
    start_y: number;
    start_z: number;
    size_h: number;
    size_v: number;
    direction: number;
    face: number;
  }>;
  peace_filters: any[];
  questions: any[];
};

/** BP 启动时一次性拉取并缓存的平台配置（无热重载）。 */
export class ConfigManager {
  private static cache: ConfigCache = {
    modules: new Map(),
    moduleConfigKeys: new Map(),
    moduleTokens: new Map(),
    settings: new Map(),
    areas: [],
    permissions: {},
    bannedItems: [],
    clean: { itemMax: 192, pollInterval: 60 },
    grids: {},
    peaceFilters: [],
    questions: [],
  };
  private static _initialized = false;
  private static _ready = false;
  private static _data: DataAdapter | null = null;
  private static _moduleChangeListeners: Set<(key: string, enabled: boolean) => void> = new Set();

  /** 由 installHostBootstrap 调用,注入 db-server 数据适配器。 */
  static bindDataAdapter(adapter: DataAdapter): void {
    ConfigManager._data = adapter;
  }

  /** 订阅模块开关变化。模块启动时注册,启用/禁用态翻转时被回调。 */
  static onModuleEnabledChange(cb: (key: string, enabled: boolean) => void): () => void {
    ConfigManager._moduleChangeListeners.add(cb);
    return () => ConfigManager._moduleChangeListeners.delete(cb);
  }

  /** 初始化：健康检查 → 拉全量配置 → 设置 auth token → 标记 ready。 */
  static async init(): Promise<void> {
    if (ConfigManager._initialized) return;
    ConfigManager._initialized = true;
    if (!ConfigManager._data) throw new Error("ConfigManager: bindDataAdapter() before init()");
    await ConfigManager._data.checkHealth();
    await ConfigManager.loadAll();
    ConfigManager._data.setAuthToken(ConfigManager.getSetting("db_auth_token", ""));
    ConfigManager._notifyModuleChanges(/* force */ true);
    ConfigManager._ready = true;
    console.log("[ConfigManager] 配置已加载");
  }

  /** 配置是否已完成 init 并可读。 */
  static isReady(): boolean {
    return ConfigManager._ready;
  }

  /**
   * 模块是否启用。key 可为 catalog id(feature-afk)或 configKey(afk);
   * populate 时双写索引,避免 ModuleRegistry / 旧 Modules 枚举键不一致(LSP)。
   */
  static isEnabled(module: string): boolean {
    if (!ConfigManager._ready) return false;
    return ConfigManager.cache.modules.get(module) ?? false;
  }

  /** 取模块 HMAC token(来自 configs/all.module_tokens)。 */
  static getModuleToken(moduleId: string): string {
    return ConfigManager.cache.moduleTokens.get(moduleId) ?? "";
  }

  /** 取模块 configKey;无则空串。 */
  static getModuleConfigKey(moduleId: string): string {
    return ConfigManager.cache.moduleConfigKeys.get(moduleId) ?? "";
  }

  /** 读 settings 键；值经 JSON.parse，失败则原样返回。 */
  static getSetting<T>(key: string, defaultVal?: T): T {
    const val = ConfigManager.cache.settings.get(key);
    if (val === undefined) return defaultVal as T;
    try {
      return JSON.parse(val) as T;
    } catch {
      return val as unknown as T;
    }
  }

  /** 取指定模块的区域配置列表。 */
  static getAreas(module: string): any[] {
    return ConfigManager.cache.areas.filter((a) => a.module === module);
  }

  /** 取玩家权限覆盖表副本。 */
  static getPermissions(): Record<string, number> {
    return { ...ConfigManager.cache.permissions };
  }

  /** 取禁物品 id 列表副本。 */
  static getBannedItems(): string[] {
    return [...ConfigManager.cache.bannedItems];
  }

  /** 取清道夫配置（物品上限与轮询间隔）。 */
  static getClean(): { itemMax: number; pollInterval: number } {
    return { ...ConfigManager.cache.clean };
  }

  /** 按名称取网格配置；不存在返回 null。 */
  static getGrid(name: string): any {
    return ConfigManager.cache.grids[name] ?? null;
  }

  /** 取和平模式过滤器列表副本。 */
  static getPeaceFilters(): any[] {
    return [...ConfigManager.cache.peaceFilters];
  }

  /** 取问答库题目列表副本。 */
  static getQuestions(): any[] {
    return [...ConfigManager.cache.questions];
  }

  /** 从 db-server 重新拉取全量配置并填充缓存。 */
  static async loadAll(): Promise<void> {
    const body = await ConfigManager._data!.getAllConfigs();
    if (!body) {
      console.warn("[ConfigManager] 配置拉取失败,使用空缓存");
      return;
    }
    try {
      const all = JSON.parse(body) as AllConfigs;
      ConfigManager.populate(all);
    } catch (e) {
      console.warn(`[ConfigManager] 配置解析失败: ${(e as Error).message}`);
    }
  }

  /** 仅刷新模块启停缓存（runtime 开关变化后调用）。 */
  static async refreshModules(): Promise<void> {
    const body = await ConfigManager._data!.getModules();
    if (!body) return;
    try {
      const { modules } = JSON.parse(body);
      ConfigManager.cache.modules.clear();
      ConfigManager.cache.moduleConfigKeys.clear();
      for (const m of modules) {
        ConfigManager._indexModuleEntry(m);
      }
      ConfigManager._notifyModuleChanges();
    } catch (e) {
      console.warn(`[ConfigManager] 模块缓存刷新失败: ${(e as Error).message}`);
    }
  }

  // ── Internal ──

  private static _indexModuleEntry(m: {
    id?: string;
    module_id?: string;
    config_key?: string;
    configKey?: string;
    name?: string;
    enabled?: boolean;
    installed?: boolean;
  }): void {
    const id = String(m.id || m.module_id || "").trim();
    const key = String(m.config_key || m.configKey || m.name || "").trim();
    const enabled = !!m.enabled && m.installed !== false;
    if (id) {
      ConfigManager.cache.modules.set(id, enabled);
      if (key) ConfigManager.cache.moduleConfigKeys.set(id, key);
    }
    if (key) ConfigManager.cache.modules.set(key, enabled);
  }

  private static populate(all: AllConfigs): void {
    ConfigManager.cache.modules.clear();
    ConfigManager.cache.moduleConfigKeys.clear();
    ConfigManager.cache.moduleTokens.clear();
    for (const m of all.modules || []) {
      ConfigManager._indexModuleEntry(m);
    }
    for (const [id, token] of Object.entries(all.module_tokens || {})) {
      if (id && typeof token === "string" && token) {
        ConfigManager.cache.moduleTokens.set(id, token);
      }
    }

    ConfigManager.cache.settings.clear();
    for (const [k, v] of Object.entries(all.settings || {})) {
      ConfigManager.cache.settings.set(k, typeof v === "string" ? v : JSON.stringify(v));
    }

    ConfigManager.cache.areas = (all.areas || []).map((a) => ({
      name: a.name || "",
      dimension: a.dimension,
      module: a.module,
      start: [a.start_x, a.start_z],
      end: [a.end_x, a.end_z],
    }));

    ConfigManager.cache.permissions = {};
    for (const p of all.permissions || []) {
      ConfigManager.cache.permissions[p.player_name] = p.level;
    }

    // 权威契约为 string[];兼容历史 {item_id} 以免旧服务端把缓存清空(LSP 防御)
    ConfigManager.cache.bannedItems = (all.banned_items || [])
      .map((s) =>
        typeof s === "string"
          ? s
          : s && typeof s === "object"
            ? String((s as { item_id?: unknown }).item_id || "")
            : ""
      )
      .filter((id) => !!id);

    if (all.clean) {
      ConfigManager.cache.clean = {
        itemMax: all.clean.item_max ?? 192,
        pollInterval: all.clean.poll_interval ?? 60,
      };
    }

    ConfigManager.cache.grids = {};
    for (const g of all.grids || []) {
      ConfigManager.cache.grids[g.name] = {
        ...g,
        size: [g.size_h, g.size_v],
        start: [g.start_x, g.start_y, g.start_z],
      };
    }

    ConfigManager.cache.peaceFilters = Array.isArray(all.peace_filters) ? all.peace_filters : [];

    ConfigManager.cache.questions = (all.questions || []).map((q: any) => ({
      weight: q.weight,
      q: q.question,
      a: q.answers || [],
      msg_right: q.msg_right || "",
      msg_wrong: q.msg_wrong || "",
      d: q.explanation || "",
      seq: [q.min_rank, q.max_rank].filter((v: any) => v !== null && v !== undefined),
      bonus: q.rewards || [],
      punish: q.punishments || [],
    }));
  }

  private static _notifyModuleChanges(force = false): void {
    for (const [key, enabled] of ConfigManager.cache.modules.entries()) {
      ConfigManager._moduleChangeListeners.forEach((cb) => {
        try {
          cb(key, enabled);
        } catch (e) {
          console.warn(`[ConfigManager] listener 异常: ${(e as Error).message || e}`);
        }
      });
      if (!force) break; // refreshModules 不需要全量广播;init 时一次性广播后退出
    }
    if (force) {
      // force 时已经迭代;不二次广播
    }
  }
}
