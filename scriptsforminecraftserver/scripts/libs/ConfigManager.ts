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
    _lastFetch: 0,
  };

  private static _initialized = false;
  private static _ready = false;
  private static _configStale = false;
  private static _lastErrors = new Map<string, string>();
  private static _pollInFlight = false;
  private static _fastPollInFlight = false;
  private static _reloadInFlight: Promise<void> | null = null;

  static async init(): Promise<void> {
    if (this._initialized) return;
    this._initialized = true;
    await HttpDB.checkHealth();
    await this.reloadAll();
    HttpDB.setAuthToken(this.getSetting("db_auth_token", ""));
    this._syncRuntimeFlags();
    this._ready = true;
    console.log("[ConfigManager] 配置已加载");
  }

  static isReady(): boolean {
    return this._ready;
  }

  static isStale(): boolean {
    return this._configStale;
  }

  static getLastErrors(): Record<string, string> {
    return Object.fromEntries(this._lastErrors);
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

  static async reloadAll(): Promise<void> {
    if (this._reloadInFlight) return this._reloadInFlight;
    const now = Date.now();
    this._reloadInFlight = (async () => {
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
      ];
      await Promise.allSettled(promises);
      this.cache._lastFetch = now;
      this._configStale = this._lastErrors.size > 0;
    })();
    try {
      await this._reloadInFlight;
    } finally {
      this._reloadInFlight = null;
    }
  }

  static async reloadModule(module: string): Promise<void> {
    // Reload settings that might affect this module
    await this._fetchSettings();
    await this._fetchAreas();
  }

  // ── Internal fetchers ──

  private static async _poll(): Promise<void> {
    if (this._pollInFlight) return;
    this._pollInFlight = true;
    try {
      if (!this.cache._lastFetch) return;
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
    } catch (e) {
      this._recordError("poll", e);
    } finally {
      this._pollInFlight = false;
    }
  }

  private static async _fastPoll(): Promise<void> {
    if (this._fastPollInFlight) return;
    this._fastPollInFlight = true;
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
        // 模块启用/禁用变更触发 cleanup/boot
        const { ModuleRegistry } = await import("./ModuleRegistry");
        const changes = ModuleRegistry.reconcile();
        if (changes.length > 0) {
          for (const p of world.getPlayers()) {
            const list = changes.map((c) => `${c.id} ${c.action === 'disable' ? '已禁用' : '已启用'}`).join(', ');
            Msg.info(`模块变更: ${list}`, p);
          }
        }
        const bridgeId = this.getSetting("bridge_channel_id", "");
        if (bridgeId) DogeChat.startBridgePolling(bridgeId);
        for (const p of world.getPlayers()) {
          Msg.info("配置已热重载", p);
        }
      }
    } catch (e) {
      console.warn(`[ConfigManager] 热重载信号检查失败: ${(e as Error).message || e}`);
    } finally {
      this._fastPollInFlight = false;
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
      for (const m of modules) {
        const key = m.config_key || m.configKey || m.name;
        if (key) this.cache.modules.set(key, !!m.enabled && m.installed !== false);
      }
      this._clearError("modules");
    } catch (e) {
      this._recordError("modules", e);
    }
  }

  private static async _fetchSettings(): Promise<void> {
    try {
      const body = await HttpDB.get("/api/sfmc/settings");
      if (!body) return;
      const { settings } = JSON.parse(body);
      this.cache.settings.clear();
      for (const s of settings) this.cache.settings.set(s.key, s.value);
      this._clearError("settings");
    } catch (e) {
      this._recordError("settings", e);
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
      this._clearError("areas");
    } catch (e) {
      this._recordError("areas", e);
    }
  }

  private static async _fetchPermissions(): Promise<void> {
    try {
      const body = await HttpDB.get("/api/sfmc/permissions");
      if (!body) return;
      const { permissions } = JSON.parse(body);
      this.cache.permissions = {};
      for (const p of permissions) this.cache.permissions[p.player_name] = p.level;
      this._clearError("permissions");
    } catch (e) {
      this._recordError("permissions", e);
    }
  }

  private static async _fetchBannedItems(): Promise<void> {
    try {
      const body = await HttpDB.get("/api/sfmc/banned_items");
      if (!body) return;
      this.cache.bannedItems = (JSON.parse(body).items || []).map((i: any) => i.item_id);
      this._clearError("banned_items");
    } catch (e) {
      this._recordError("banned_items", e);
    }
  }

  private static async _fetchClean(): Promise<void> {
    try {
      const body = await HttpDB.get("/api/sfmc/clean");
      if (!body) return;
      const { clean } = JSON.parse(body);
      if (clean) this.cache.clean = { itemMax: clean.item_max, pollInterval: clean.poll_interval };
      this._clearError("clean");
    } catch (e) {
      this._recordError("clean", e);
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
      this._clearError("grids");
    } catch (e) {
      this._recordError("grids", e);
    }
  }

  private static async _fetchPeaceFilters(): Promise<void> {
    try {
      const body = await HttpDB.get("/api/sfmc/peace_filters");
      if (!body) return;
      this.cache.peaceFilters = JSON.parse(body).filters || [];
      this._clearError("peace_filters");
    } catch (e) {
      this._recordError("peace_filters", e);
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
      this._clearError("qa");
    } catch (e) {
      this._recordError("qa", e);
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


  private static _recordError(source: string, error: unknown): void {
    const message = (error as Error)?.message || String(error);
    const previous = this._lastErrors.get(source);
    this._lastErrors.set(source, message);
    this._configStale = true;
    if (previous !== message) console.warn(`[ConfigManager] ${source} 配置获取失败: ${message}`);
  }

  private static _clearError(source: string): void {
    this._lastErrors.delete(source);
    this._configStale = this._lastErrors.size > 0;
  }
}
