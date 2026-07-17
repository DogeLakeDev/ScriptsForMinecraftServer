import { CreativeArea } from "../area/CreativeArea.js";
import { Peace } from "../area/Peace.js";
import { HttpDB } from "./HttpDB.js";

type ConfigCache = {
  modules: Map<string, boolean>;
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
  modules: Array<{ config_key?: string; configKey?: string; name?: string; enabled?: boolean; installed?: boolean }>;
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
  banned_items: string[];
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

export class ConfigManager {
  private static cache: ConfigCache = {
    modules: new Map(),
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

  static async init(): Promise<void> {
    if (this._initialized) return;
    this._initialized = true;
    await HttpDB.checkHealth();
    await this.loadAll();
    HttpDB.setAuthToken(this.getSetting("db_auth_token", ""));
    this._syncRuntimeFlags();
    this._ready = true;
    console.log("[ConfigManager] 配置已加载");
  }

  static isReady(): boolean {
    return this._ready;
  }

  static isEnabled(module: string): boolean {
    if (!this._ready) return false;
    return this.cache.modules.get(module) ?? false;
  }

  static getSetting<T>(key: string, defaultVal?: T): T {
    const val = this.cache.settings.get(key);
    if (val === undefined) return defaultVal as T;
    try {
      return JSON.parse(val) as T;
    } catch {
      return val as unknown as T;
    }
  }

  static getAreas(module: string): any[] {
    return this.cache.areas.filter((a) => a.module === module);
  }

  static getPermissions(): Record<string, number> {
    return { ...this.cache.permissions };
  }

  static getBannedItems(): string[] {
    return [...this.cache.bannedItems];
  }

  static getClean(): { itemMax: number; pollInterval: number } {
    return { ...this.cache.clean };
  }

  static getGrid(name: string): any {
    return this.cache.grids[name] ?? null;
  }

  static getPeaceFilters(): any[] {
    return [...this.cache.peaceFilters];
  }

  static getQuestions(): any[] {
    return [...this.cache.questions];
  }

  /**
   * SAPI 启动时一次性从 db-server 拉取所有配置。
   * db-server 直接读取 configs/*.json 文件并返回，不走 SQLite，无热重载。
   * 改配置后需重启 BDS 才会生效。
   */
  static async loadAll(): Promise<void> {
    const body = await HttpDB.get("/api/sfmc/configs/all");
    if (!body) {
      console.warn("[ConfigManager] 配置拉取失败，使用空缓存");
      return;
    }
    try {
      const all = JSON.parse(body) as AllConfigs;
      this.populate(all);
    } catch (e) {
      console.warn(`[ConfigManager] 配置解析失败: ${(e as Error).message}`);
    }
  }

  /**
   * 切换模块后局部刷新（AdminGUI 用）。
   * 仅刷新 modules 缓存，不重新拉取其它配置。
   */
  static async refreshModules(): Promise<void> {
    try {
      const body = await HttpDB.get("/api/sfmc/modules");
      if (!body) return;
      const { modules } = JSON.parse(body);
      this.cache.modules.clear();
      for (const m of modules) {
        const key = m.config_key || m.configKey || m.name;
        if (key) this.cache.modules.set(key, !!m.enabled && m.installed !== false);
      }
    } catch (e) {
      console.warn(`[ConfigManager] 模块缓存刷新失败: ${(e as Error).message}`);
    }
  }

  // ── Internal ──

  private static populate(all: AllConfigs): void {
    this.cache.modules.clear();
    for (const m of all.modules || []) {
      const key = m.config_key || m.configKey || m.name;
      if (key) this.cache.modules.set(key, !!m.enabled && m.installed !== false);
    }

    this.cache.settings.clear();
    for (const [k, v] of Object.entries(all.settings || {})) {
      this.cache.settings.set(k, typeof v === "string" ? v : JSON.stringify(v));
    }

    this.cache.areas = (all.areas || []).map((a) => ({
      name: a.name || "",
      dimension: a.dimension,
      module: a.module,
      start: [a.start_x, a.start_z],
      end: [a.end_x, a.end_z],
    }));

    this.cache.permissions = {};
    for (const p of all.permissions || []) {
      this.cache.permissions[p.player_name] = p.level;
    }

    this.cache.bannedItems = (all.banned_items || []).filter((s) => typeof s === "string");

    if (all.clean) {
      this.cache.clean = {
        itemMax: all.clean.item_max ?? 192,
        pollInterval: all.clean.poll_interval ?? 60,
      };
    }

    this.cache.grids = {};
    for (const g of all.grids || []) {
      this.cache.grids[g.name] = {
        ...g,
        size: [g.size_h, g.size_v],
        start: [g.start_x, g.start_y, g.start_z],
      };
    }

    this.cache.peaceFilters = Array.isArray(all.peace_filters) ? all.peace_filters : [];

    this.cache.questions = (all.questions || []).map((q: any) => ({
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

  /** 启动时把模块开关同步到运行时的模块标志 */
  private static _syncRuntimeFlags(): void {
    CreativeArea.enable = this.isEnabled("creative");
    Peace.getInstance().enable = this.isEnabled("peace");
  }
}

