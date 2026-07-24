/**
 * pack-update 配置加载
 */
import fs from "node:fs";
import path from "node:path";
import { ROOT, resolveDefaultsDir } from "../runtime.js";
import type { PackUpdateConfig } from "./types.js";

const DEFAULTS: PackUpdateConfig = {
  enabled: true,
  checkOnBdsStart: true,
  applyOnBdsStart: true,
  askConfirmOnBind: true,
  probeSourceAfterInstall: true,
  providers: {
    curseforge: {
      enabled: true,
      apiKey: "",
      baseUrl: "https://api.curseforge.com",
      gameId: 459,
      classId: null,
      pageSize: 10,
      preferredReleaseTypes: ["release", "beta", "alpha"],
      match: {
        byUuidInArchive: true,
        byName: true,
        nameMinScore: 0.6,
        stripFolderTags: true,
      },
    },
  },
  versionPolicy: {
    authority: "behavior_pack",
    onUpdateOverwriteBoth: true,
    rpBumpWhenSameMajor: true,
    rpBumpComponent: "patch",
    majorHigherSkipRpBump: true,
  },
  startup: {
    sequential: true,
    delayMsBetweenPacks: 0,
    skipDisabledBindings: true,
    failMode: "continue",
  },
};

function deepMerge<T extends Record<string, unknown>>(base: T, over: Partial<T>): T {
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    if (v && typeof v === "object" && !Array.isArray(v) && typeof (base as Record<string, unknown>)[k] === "object") {
      (out as Record<string, unknown>)[k] = deepMerge(
        (base as Record<string, unknown>)[k] as Record<string, unknown>,
        v as Record<string, unknown>
      );
    } else if (v !== undefined) {
      (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}

export function packUpdateConfigPath(): string {
  return path.join(ROOT, "configs", "pack-update.json");
}

export function loadPackUpdateConfig(): PackUpdateConfig {
  const cfgPath = packUpdateConfigPath();
  let raw: Partial<PackUpdateConfig> = {};
  if (fs.existsSync(cfgPath)) {
    try {
      raw = JSON.parse(fs.readFileSync(cfgPath, "utf8")) as Partial<PackUpdateConfig>;
    } catch {
      raw = {};
    }
  } else {
    const defaultsDir = resolveDefaultsDir();
    const bundled = defaultsDir ? path.join(defaultsDir, "pack-update.json") : "";
    if (bundled && fs.existsSync(bundled)) {
      try {
        raw = JSON.parse(fs.readFileSync(bundled, "utf8")) as Partial<PackUpdateConfig>;
      } catch {
        raw = {};
      }
    }
  }

  const merged = deepMerge(DEFAULTS as unknown as Record<string, unknown>, raw as Record<string, unknown>) as unknown as PackUpdateConfig;

  const envKey = process.env.CURSEFORGE_API_KEY?.trim();
  if (envKey) {
    merged.providers.curseforge.apiKey = envKey;
  }

  return merged;
}

/** 确保 configs/pack-update.json 存在（从 defaults 复制） */
export function ensurePackUpdateConfigFile(): string {
  const dest = packUpdateConfigPath();
  if (fs.existsSync(dest)) return dest;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const defaultsDir = resolveDefaultsDir();
  const src = defaultsDir ? path.join(defaultsDir, "pack-update.json") : "";
  if (src && fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  } else {
    fs.writeFileSync(dest, `${JSON.stringify(DEFAULTS, null, 2)}\n`, "utf8");
  }
  return dest;
}
