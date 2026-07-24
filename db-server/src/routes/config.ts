/**
 * routes/config.ts — 配置路由（直接读取 configs/*.json）
 *
 * 路由列表：
 *   GET /api/sfmc/configs/all          — SAPI 启动时一次性拉取所有配置
 *   GET /api/sfmc/settings             — 平铺 settings.json
 *   GET /api/sfmc/settings/:key        — 含 land:* / bridge_channel_id 等 fallback 查询
 *   GET /api/sfmc/areas                — areas.json
 *   GET /api/sfmc/permissions          — permissions.json
 *   GET /api/sfmc/banned_items         — banned_items.json
 *   GET /api/sfmc/clean                — clean.json
 *   GET /api/sfmc/grids                — grids.json
 *   GET /api/sfmc/peace_filters        — peace_filters.json
 *   GET /api/sfmc/qa                   — questions.json
 */

import { configPath, readJson, type ConfigName } from "@sfmc-bds/sdk/node/config";

interface Deps {
  json: (res: import("http").ServerResponse, data: Record<string, unknown>, status?: number) => void;
  projectRoot: string;
  /**
   * 注入模块列表(与 GET /api/sfmc/modules 同源 — DRY)。
   * 勿在本路由再读 catalog/lock(DIP:高层装配,路由只消费抽象)。
   */
  listModules?: () => Array<Record<string, unknown>>;
  /**
   * 注入模块 HMAC token 表(仅 loopback 可达;供 SAPI host-bootstrap 注入
   * set*ModuleContext,因 SAPI 不能读 data/module-tokens.json)。
   */
  getModuleTokens?: () => Record<string, string>;
}

function isMetaKey(k: string): boolean {
  return k === "$schema" || String(k).startsWith("_");
}

function stripMetaDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stripMetaDeep);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (!isMetaKey(k)) out[k] = stripMetaDeep(val);
    }
    return out;
  }
  return v;
}

function stripMeta(obj: Record<string, unknown> | null): Record<string, unknown> {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!isMetaKey(k)) out[k] = v;
  }
  return out;
}

function jsonValue(v: unknown): string {
  return v !== null && typeof v === "object" ? JSON.stringify(v) : String(v ?? "");
}

function arrayOrEmpty(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function createConfigRoutes({ json, projectRoot, listModules, getModuleTokens }: Deps) {
  /** 仓顶服务 config 读取统一走 SDK;闭包捕获 projectRoot。 */
  const readCfg = (name: ConfigName): unknown => readJson(configPath(projectRoot, name));

  function getAllConfigs(): Record<string, unknown> {
    const modules = typeof listModules === "function" ? listModules() : [];
    const module_tokens = typeof getModuleTokens === "function" ? getModuleTokens() : {};
    /**
     * SAPI ConfigManager 契约:banned_items 为 string[](与 GET /banned_items 同源)。
     * 勿再映射成 {item_id} — 否则 filter(typeof s === "string") 会得到空缓存(LSP)。
     * 其余资源复用单资源 helpers,避免 getAllConfigs 与专用路由双写(DRY)。
     */
    return {
      // 与 /api/sfmc/modules 同源;ConfigManager.init 一次拉齐启停态(DRY)
      modules,
      // loopback-only 下发;SAPI 无 fs,靠此注入模块身份(DIP)
      module_tokens,
      settings: stripMeta(readCfg("settings.json") as Record<string, unknown> | null),
      areas: getAreas(),
      permissions: getPermissions(),
      banned_items: getBannedItems(),
      clean: getClean(),
      grids: getGrids(),
      peace_filters: getPeaceFilters(),
      questions: getQA(),
    };
  }

  function getSettingsFlat(): Array<{ key: string; value: string }> {
    const obj = stripMeta(readJson(configPath(projectRoot, "settings.json")) as Record<string, unknown> | null);
    return Object.entries(obj).map(([key, value]) => ({ key, value: jsonValue(value) }));
  }

  function getSettingByKey(key: string): { value: unknown; source?: string } {
    const settings = (readJson(configPath(projectRoot, "settings.json")) as Record<string, unknown> | null) ?? {};
    if (Object.prototype.hasOwnProperty.call(settings, key) && !isMetaKey(key)) {
      return { value: settings[key], source: "settings.json" };
    }
    if (key === "bridge_channel_id") {
      const qq = (readCfg("qq_config.json") as Record<string, unknown> | null) ?? {};
      if (qq.bridge_channel_id) return { value: qq.bridge_channel_id, source: "qq_config.json" };
    }
    if (key.startsWith("land:")) {
      const land = (readCfg("land.json") as Record<string, unknown> | null) ?? {};
      if (Object.prototype.hasOwnProperty.call(land, key) && !isMetaKey(key)) {
        return { value: land[key], source: "land.json" };
      }
    }
    return { value: null };
  }

  function getAreas(): unknown[] {
    return (arrayOrEmpty(readCfg("areas.json")) as Array<Record<string, unknown>>)
      .filter((r) => r && r.module && r.dimension != null)
      .map((r) => stripMetaDeep(r));
  }

  function getPermissions(): unknown[] {
    return (arrayOrEmpty(readCfg("permissions.json")) as Array<Record<string, unknown>>)
      .filter((r) => r && r.player_name)
      .map((r) => stripMetaDeep(r));
  }

  function getBannedItems(): string[] {
    return (arrayOrEmpty(readCfg("banned_items.json")) as Array<string>).filter(
      (i) => typeof i === "string" && i && !i.startsWith("_")
    );
  }

  function getClean(): { item_max: number; poll_interval: number } {
    const c = stripMetaDeep(readCfg("clean.json") ?? {}) as Record<string, unknown>;
    return { item_max: (c.item_max as number) ?? 192, poll_interval: (c.poll_interval as number) ?? 60 };
  }

  function getGrids(): unknown[] {
    return (arrayOrEmpty(readCfg("grids.json")) as Array<Record<string, unknown>>)
      .filter((r) => r && r.name)
      .map((r) => stripMetaDeep(r));
  }

  function getPeaceFilters(): unknown[] {
    return (arrayOrEmpty(readCfg("peace_filters.json")) as Array<Record<string, unknown>>)
      .filter((r) => r && r.family)
      .map((r) => stripMetaDeep(r));
  }

  function getQA(): Array<Record<string, unknown>> {
    return (arrayOrEmpty(readCfg("questions.json")) as Array<Record<string, unknown>>)
      .filter((r) => r && r.question)
      .map((r, idx) => {
        const clean = stripMetaDeep(r) as Record<string, unknown>;
        return {
          id: idx + 1,
          weight: clean.weight ?? 1,
          question: clean.question,
          answers: clean.answers ?? [],
          msg_right: clean.msg_right ?? "",
          msg_wrong: clean.msg_wrong ?? "",
          explanation: clean.explanation ?? "",
          min_rank: clean.min_rank ?? null,
          max_rank: clean.max_rank ?? null,
          rewards: clean.rewards ?? [],
          punishments: clean.punishments ?? [],
        };
      });
  }

  return async function handleConfigRoute({
    path: requestPath,
    method,
    params,
    res,
  }: {
    path: string;
    method: string;
    params: URLSearchParams;
    res: import("http").ServerResponse;
  }): Promise<boolean> {
    void params;
    if (requestPath === "/api/sfmc/configs/all") {
      if (method !== "GET") {
        json(res, { success: false, error: "not_found" }, 404);
        return true;
      }
      json(res, getAllConfigs());
      return true;
    }
    if (requestPath === "/api/sfmc/settings") {
      if (method === "GET") {
        json(res, { settings: getSettingsFlat() });
        return true;
      }
      json(res, { success: false, error: "not_found" }, 404);
      return true;
    }
    if (requestPath.startsWith("/api/sfmc/settings/")) {
      const key = decodeURIComponent(requestPath.slice("/api/sfmc/settings/".length));
      if (method === "GET") {
        json(res, getSettingByKey(key));
        return true;
      }
      json(res, { success: false, error: "method_not_allowed" }, 405);
      return true;
    }
    if (requestPath === "/api/sfmc/areas") {
      if (method === "GET") {
        json(res, { areas: getAreas() });
        return true;
      }
    }
    if (requestPath === "/api/sfmc/permissions") {
      if (method === "GET") {
        json(res, { permissions: getPermissions() });
        return true;
      }
    }
    if (requestPath === "/api/sfmc/banned_items") {
      if (method === "GET") {
        json(res, { items: getBannedItems() });
        return true;
      }
    }
    if (requestPath === "/api/sfmc/clean") {
      if (method === "GET") {
        json(res, { clean: getClean() });
        return true;
      }
    }
    if (requestPath === "/api/sfmc/grids") {
      if (method === "GET") {
        json(res, { grids: getGrids() });
        return true;
      }
    }
    if (requestPath === "/api/sfmc/peace_filters") {
      if (method === "GET") {
        json(res, { filters: getPeaceFilters() });
        return true;
      }
    }
    if (requestPath === "/api/sfmc/qa") {
      if (method === "GET") {
        json(res, { questions: getQA() });
        return true;
      }
    }
    return false;
  };
}

export { createConfigRoutes };
