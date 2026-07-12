import { system, world } from "@minecraft/server";
import { HttpDB } from "./HttpDB";
import { Msg } from "./Tools";
import { CreativeArea } from "../area/CreativeArea";
import { Peace } from "../area/Peace";
import { DogeChat } from "../chat/DogeChat";

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
  shopCategories: any[];
  shopItems: any[];
  _lastFetch: number;
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
    shopCategories: [],
    shopItems: [],
    _lastFetch: 0,
  };

  private static _initialized = false;

  static async init(): Promise<void> {
    if (this._initialized) return;
    this._initialized = true;
    await HttpDB.checkHealth();
    await this.reloadAll();
    this._syncRuntimeFlags();
    console.log("[ConfigManager] 配置已加载");
  }

  static startPolling(intervalTicks = 72000): void {
    system.runInterval(() => this._poll(), intervalTicks);
  }

  /**
   * 快速信号检查（每 2 秒），检测 _reload_signal → 立即全量重载
   */
  static startFastPoll(intervalTicks = 40): void {
    system.runInterval(() => this._fastPoll(), intervalTicks);
  }

  static isEnabled(module: string): boolean {
    return this.cache.modules.get(module) ?? true;
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

  static getShopCategories(): any[] {
    return [...this.cache.shopCategories];
  }

  static getShopItems(): any[] {
    return [...this.cache.shopItems];
  }

  static async reloadAll(): Promise<void> {
    const now = Date.now();
    const promises = [
      this._fetchModules(),
      this._fetchSettings(),
      this._fetchAreas(),
      this._fetchPermissions(),
      this._fetchBannedItems(),
      this._fetchClean(),
      this._fetchGrids(),
      this._fetchPeaceFilters(),
      this._fetchQA(),
      this._fetchShop(),
    ];
    await Promise.allSettled(promises);
    this.cache._lastFetch = now;
  }

  static async reloadModule(module: string): Promise<void> {
    // Reload settings that might affect this module
    await this._fetchSettings();
    await this._fetchAreas();
  }

  // ── Internal fetchers ──

  private static async _poll(): Promise<void> {
    if (!this.cache._lastFetch) return;
    try {
      const body = await HttpDB.get(`/api/sfmc/configs/updated-since/${this.cache._lastFetch}`);
      if (!body) return;
      const data = JSON.parse(body);
      const upd = data.updated;
      if (!upd) return;
      this.cache._lastFetch = data.timestamp || Date.now();
      if (upd.modules) await this._fetchModules();
      if (upd.settings) await this._fetchSettings();
      if (upd.areas) await this._fetchAreas();
      if (upd.permissions) await this._fetchPermissions();
      if (upd.banned_items) await this._fetchBannedItems();
      if (upd.clean) await this._fetchClean();
      if (upd.grids) await this._fetchGrids();
      if (upd.peace_filters) await this._fetchPeaceFilters();
      if (upd.qa_questions) await this._fetchQA();
      if (upd.shop_categories || upd.shop_items) await this._fetchShop();
    } catch {
      /* ignore */
    }
  }

  private static async _fastPoll(): Promise<void> {
    try {
      // 数据库断线时尝试重连
      if (!HttpDB.isAvailable()) {
        const ok = await HttpDB.checkHealth();
        if (!ok) return;
        console.warn("[ConfigManager] 数据库已重连，重新加载配置");
        await this.reloadAll();
        this._syncRuntimeFlags();
        // 重试启动 bridge polling（若之前因 settings 为空而跳过）
        const bridgeId = this.getSetting("bridge_channel_id", "");
        if (bridgeId) DogeChat.startBridgePolling(bridgeId);
        return;
      }

      const body = await HttpDB.get("/api/sfmc/settings/_reload_signal");
      if (!body) return;
      const { value } = JSON.parse(body);
      if (parseInt(value as string, 10) > this.cache._lastFetch) {
        console.warn("[ConfigManager] 收到热重载信号，重新加载配置");
        await this.reloadAll();
        this._syncRuntimeFlags();
        const bridgeId = this.getSetting("bridge_channel_id", "");
        if (bridgeId) DogeChat.startBridgePolling(bridgeId);
        for (const p of world.getPlayers()) {
          Msg.info("配置已热重载", p);
        }
      }
    } catch (e) {
      console.warn(`[ConfigManager] 热重载信号检查失败: ${(e as Error).message || e}`);
    }
  }

  /** 将缓存中的模块开关同步到运行时的模块标志 */
  private static _syncRuntimeFlags(): void {
    CreativeArea.enable = this.isEnabled("creative");
    Peace.getInstance().enable = this.isEnabled("peace");
  }

  private static async _fetchModules(): Promise<void> {
    try {
      const body = await HttpDB.get("/api/sfmc/modules");
      if (!body) return;
      const { modules } = JSON.parse(body);
      this.cache.modules.clear();
      for (const m of modules) this.cache.modules.set(m.name, !!m.enabled);
    } catch (e) {
      console.warn(`[ConfigManager] 获取模块配置失败: ${(e as Error).message || e}`);
    }
  }

  private static async _fetchSettings(): Promise<void> {
    try {
      const body = await HttpDB.get("/api/sfmc/settings");
      if (!body) return;
      const { settings } = JSON.parse(body);
      this.cache.settings.clear();
      for (const s of settings) this.cache.settings.set(s.key, s.value);
    } catch {
      /* ignore */
    }
  }

  private static async _fetchAreas(): Promise<void> {
    try {
      const body = await HttpDB.get("/api/sfmc/areas");
      if (!body) return;
      this.cache.areas = (JSON.parse(body).areas || []).map((a: any) => ({
        name: a.name || "",
        dimension: a.dimension,
        module: a.module,
        start: [a.start_x, a.start_z],
        end: [a.end_x, a.end_z],
      }));
    } catch {
      /* ignore */
    }
  }

  private static async _fetchPermissions(): Promise<void> {
    try {
      const body = await HttpDB.get("/api/sfmc/permissions");
      if (!body) return;
      const { permissions } = JSON.parse(body);
      this.cache.permissions = {};
      for (const p of permissions) this.cache.permissions[p.player_name] = p.level;
    } catch {
      /* ignore */
    }
  }

  private static async _fetchBannedItems(): Promise<void> {
    try {
      const body = await HttpDB.get("/api/sfmc/banned_items");
      if (!body) return;
      this.cache.bannedItems = (JSON.parse(body).items || []).map((i: any) => i.item_id);
    } catch {
      /* ignore */
    }
  }

  private static async _fetchClean(): Promise<void> {
    try {
      const body = await HttpDB.get("/api/sfmc/clean");
      if (!body) return;
      const { clean } = JSON.parse(body);
      if (clean) this.cache.clean = { itemMax: clean.item_max, pollInterval: clean.poll_interval };
    } catch {
      /* ignore */
    }
  }

  private static async _fetchGrids(): Promise<void> {
    try {
      const body = await HttpDB.get("/api/sfmc/grids");
      if (!body) return;
      const { grids } = JSON.parse(body);
      this.cache.grids = {};
      for (const g of grids) {
        this.cache.grids[g.name] = {
          ...g,
          size: [g.size_h, g.size_v],
          start: [g.start_x, g.start_y, g.start_z],
        };
      }
    } catch {
      /* ignore */
    }
  }

  private static async _fetchPeaceFilters(): Promise<void> {
    try {
      const body = await HttpDB.get("/api/sfmc/peace_filters");
      if (!body) return;
      this.cache.peaceFilters = JSON.parse(body).filters || [];
    } catch {
      /* ignore */
    }
  }

  private static async _fetchQA(): Promise<void> {
    try {
      const body = await HttpDB.get("/api/sfmc/qa");
      if (!body) return;
      const { questions } = JSON.parse(body);
      this.cache.questions = questions.map((q: any) => ({
        weight: q.weight,
        q: q.question,
        a: JSON.parse(q.answers || "[]"),
        msg_right: q.msg_right || "",
        msg_wrong: q.msg_wrong || "",
        d: q.explanation || "",
        seq: [q.min_rank, q.max_rank].filter((v: any) => v !== null),
        bonus: this._parseQAItems(q.rewards),
        punish: this._parseQAItems(q.punishments),
      }));
    } catch {
      /* ignore */
    }
  }

  private static _parseQAItems(jsonStr: string): any[] {
    if (!jsonStr) return [];
    try {
      const items = JSON.parse(jsonStr);
      if (!items || items.length === 0) return [];
      if (typeof items[0] === "object" && items[0] !== null) return items;
      return [];
    } catch {
      return [];
    }
  }

  private static async _fetchShop(): Promise<void> {
    try {
      const body = await HttpDB.get("/api/sfmc/shop");
      if (!body) return;
      const { categories, items } = JSON.parse(body);
      this.cache.shopCategories = categories || [];
      this.cache.shopItems = items || [];
    } catch {
      /* ignore */
    }
  }
}
