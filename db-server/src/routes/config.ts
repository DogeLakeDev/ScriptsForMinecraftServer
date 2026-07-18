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

import { readFileSync } from "node:fs";
import { join } from "node:path";

interface Deps {
  json: (res: import("http").ServerResponse, data: Record<string, unknown>, status?: number) => void;
  projectRoot: string;
}

function readJsonFile(filePath: string, fallback: unknown): unknown {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function isMetaKey(k: string): boolean {
  return String(k).startsWith("_comment") || k === "_comment";
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

function createConfigRoutes({ json, projectRoot }: Deps) {
  const cfgDir = (): string => join(projectRoot, "configs");
  const readCfg = (name: string): unknown => readJsonFile(join(cfgDir(), name), null);

  function getAllConfigs(): Record<string, unknown> {
    return {
      modules: [],
      settings: stripMeta(readCfg("settings.json") as Record<string, unknown> | null),
      areas: (arrayOrEmpty(readCfg("areas.json")) as Array<Record<string, unknown>>)
        .filter((r) => r && r.module && r.dimension != null)
        .map((r) => stripMetaDeep(r)),
      permissions: (arrayOrEmpty(readCfg("permissions.json")) as Array<Record<string, unknown>>)
        .filter((r) => r && r.player_name)
        .map((r) => stripMetaDeep(r)),
      banned_items: (arrayOrEmpty(readCfg("banned_items.json")) as Array<string>)
        .filter((i) => typeof i === "string" && i && !i.startsWith("_"))
        .map((id) => ({ item_id: id })),
      clean: stripMetaDeep(readCfg("clean.json") ?? {}),
      grids: (arrayOrEmpty(readCfg("grids.json")) as Array<Record<string, unknown>>)
        .filter((r) => r && r.name)
        .map((r) => stripMetaDeep(r)),
      peace_filters: (arrayOrEmpty(readCfg("peace_filters.json")) as Array<Record<string, unknown>>)
        .filter((r) => r && r.family)
        .map((r) => stripMetaDeep(r)),
      questions: (arrayOrEmpty(readCfg("questions.json")) as Array<Record<string, unknown>>)
        .filter((r) => r && r.question)
        .map((r, idx: number) => {
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
        }),
    };
  }

  function getSettingsFlat(): Array<{ key: string; value: string }> {
    const obj = stripMeta(readCfg("settings.json") as Record<string, unknown> | null);
    return Object.entries(obj).map(([key, value]) => ({ key, value: jsonValue(value) }));
  }

  function getSettingByKey(key: string): { value: unknown; source?: string } {
    const settings = (readCfg("settings.json") as Record<string, unknown> | null) ?? {};
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

  function getBannedItems(): Array<{ item_id: string }> {
    return (arrayOrEmpty(readCfg("banned_items.json")) as Array<string>)
      .filter((i) => typeof i === "string" && i && !i.startsWith("_"))
      .map((id) => ({ item_id: id }));
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
        json(res, { items: getBannedItems().map((x) => x.item_id) });
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
