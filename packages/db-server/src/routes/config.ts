/**
 * routes/config.ts — 配置路由
 *
 * 路由列表：
 *   GET /api/sfmc/configs/all          — SAPI ConfigManager 启动快照（仅平台域）
 *   GET /api/sfmc/settings             — 平铺 settings.json（legacy）
 *   GET /api/sfmc/settings/:key        — 含 land:* / bridge_channel_id 等 fallback
 *   GET /api/sfmc/areas|permissions|…  — legacy 只读 JSON（文件名对 db-server 为黑箱）
 *
 * DIP：模块/legacy JSON 不进 SDK ConfigName；本路由用 configDir + 文件名拼接路径。
 * 模块私有配置的读写权威入口是 module-config-routes（configs/:configKey）。
 */

import { join } from "node:path";
import { configDir, configPath, readJson, type ConfigName } from "@sfmc-bds/sdk/node/config";

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
   * set*ModuleContext,因 SAPI 不能直接读与 DB 同目录的 module-tokens.json)。
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
  /** 平台 ConfigName（qq_config 等） */
  const readPlatform = (name: ConfigName): unknown => readJson(configPath(projectRoot, name));
  /** 黑箱 JSON：任意 configs/<file>，不进 ConfigName */
  const readOpaque = (fileName: string): unknown => readJson(join(configDir(projectRoot), fileName));

  /**
   * SAPI ConfigManager 契约：只缓存 modules / settings / permissions。
   * 勿再往 all 塞 areas 等 legacy 域（那些走专用 GET 或模块 configKey）。
   */
  function getAllConfigs(): Record<string, unknown> {
    const modules = typeof listModules === "function" ? listModules() : [];
    const module_tokens = typeof getModuleTokens === "function" ? getModuleTokens() : {};
    return {
      modules,
      module_tokens,
      settings: stripMeta(readOpaque("settings.json") as Record<string, unknown> | null),
      permissions: getPermissions(),
    };
  }

  function getSettingsFlat(): Array<{ key: string; value: string }> {
    const obj = stripMeta(readOpaque("settings.json") as Record<string, unknown> | null);
    return Object.entries(obj).map(([key, value]) => ({ key, value: jsonValue(value) }));
  }

  function getSettingByKey(key: string): { value: unknown; source?: string } {
    const settings = (readOpaque("settings.json") as Record<string, unknown> | null) ?? {};
    if (Object.prototype.hasOwnProperty.call(settings, key) && !isMetaKey(key)) {
      return { value: settings[key], source: "settings.json" };
    }
    if (key === "bridge_channel_id") {
      const qq = (readPlatform("qq_config.json") as Record<string, unknown> | null) ?? {};
      if (qq.bridge_channel_id) return { value: qq.bridge_channel_id, source: "qq_config.json" };
    }
    if (key.startsWith("land:")) {
      const land = (readOpaque("land.json") as Record<string, unknown> | null) ?? {};
      if (Object.prototype.hasOwnProperty.call(land, key) && !isMetaKey(key)) {
        return { value: land[key], source: "land.json" };
      }
    }
    return { value: null };
  }

  function getAreas(): unknown[] {
    return (arrayOrEmpty(readOpaque("areas.json")) as Array<Record<string, unknown>>)
      .filter((r) => r && r.module && r.dimension != null)
      .map((r) => stripMetaDeep(r));
  }

  function getPermissions(): unknown[] {
    return (arrayOrEmpty(readPlatform("permissions.json")) as Array<Record<string, unknown>>)
      .filter((r) => r && r.player_name)
      .map((r) => stripMetaDeep(r));
  }

  function getBannedItems(): string[] {
    return (arrayOrEmpty(readOpaque("banned_items.json")) as Array<string>).filter(
      (i) => typeof i === "string" && i && !i.startsWith("_")
    );
  }

  function getClean(): { item_max: number; poll_interval: number } {
    const c = stripMetaDeep(readOpaque("clean.json") ?? {}) as Record<string, unknown>;
    return { item_max: (c.item_max as number) ?? 192, poll_interval: (c.poll_interval as number) ?? 60 };
  }

  function getGrids(): unknown[] {
    return (arrayOrEmpty(readOpaque("grids.json")) as Array<Record<string, unknown>>)
      .filter((r) => r && r.name)
      .map((r) => stripMetaDeep(r));
  }

  function getPeaceFilters(): unknown[] {
    return (arrayOrEmpty(readOpaque("peace_filters.json")) as Array<Record<string, unknown>>)
      .filter((r) => r && r.family)
      .map((r) => stripMetaDeep(r));
  }

  function getQA(): Array<Record<string, unknown>> {
    return (arrayOrEmpty(readOpaque("questions.json")) as Array<Record<string, unknown>>)
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
