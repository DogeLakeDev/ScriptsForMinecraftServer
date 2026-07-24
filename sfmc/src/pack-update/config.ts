/**
 * pack-update 配置加载
 */
import {
  configPath,
  ensureSchemaConfig,
  readJson,
  stripConfigMeta,
} from "@sfmc-bds/sdk/node/config";
import { ROOT } from "../runtime.js";
import type { CurseForgeProviderConfig, PackUpdateConfig, PackUpdateMatchConfig } from "./types.js";

const DEFAULT_MATCH: PackUpdateMatchConfig = {
  nameMinScore: 0.6,
  stripFolderTags: true,
};

const DEFAULTS: PackUpdateConfig = {
  enabled: true,
  checkOnBdsStart: true,
  applyOnBdsStart: true,
  askConfirmOnBind: true,
  probeSourceAfterInstall: true,
  /* 探测绑定默认关闭，避免误更新；可在 pack-update.json 改为 true */
  defaultBindingEnabled: false,
  match: { ...DEFAULT_MATCH },
  providers: {
    curseforge: {
      enabled: true,
      apiKey: "",
      baseUrl: "https://api.curseforge.com",
      searchBaseUrl: "https://api.curse.tools/v1/cf",
      gameId: 78022,
      classId: 4984,
      pageSize: 10,
      preferredReleaseTypes: ["release", "beta", "alpha"],
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

/** 解析 pack-update.json 路径（DIP：接受 root，勿写死模块级 ROOT） */
export function packUpdateConfigPath(root: string = ROOT): string {
  return configPath(root, "pack-update.json");
}

/**
 * 将旧版挂在 providers.curseforge.match 的字段提升到顶层 match（兼容一版）。
 * 顶层显式配置优先于嵌套遗留。
 */
function hoistLegacyMatch(raw: Record<string, unknown>): PackUpdateMatchConfig | undefined {
  const top = raw.match;
  const providers = raw.providers as Record<string, unknown> | undefined;
  const cf = providers?.curseforge as Record<string, unknown> | undefined;
  const nested = cf?.match;
  const pick =
    top && typeof top === "object" && !Array.isArray(top)
      ? (top as Partial<PackUpdateMatchConfig>)
      : nested && typeof nested === "object" && !Array.isArray(nested)
        ? (nested as Partial<PackUpdateMatchConfig>)
        : undefined;
  if (!pick) return undefined;
  return deepMerge(
    DEFAULT_MATCH as unknown as Record<string, unknown>,
    pick as Record<string, unknown>
  ) as unknown as PackUpdateMatchConfig;
}

export function loadPackUpdateConfig(root: string = ROOT): PackUpdateConfig {
  const cfgPath = packUpdateConfigPath(root);
  /* 与平台其它配置一致：经 stripConfigMeta 剥 $schema/_comment（DRY/LSP），勿手写 delete */
  const raw = stripConfigMeta(readJson<Record<string, unknown>>(cfgPath, {}) ?? {});

  const legacyMatch = hoistLegacyMatch(raw);
  const merged = deepMerge(
    DEFAULTS as unknown as Record<string, unknown>,
    raw as Record<string, unknown>
  ) as unknown as PackUpdateConfig;

  if (legacyMatch) {
    merged.match = legacyMatch;
  }

  const envKey = process.env.CURSEFORGE_API_KEY?.trim();
  if (envKey) {
    merged.providers.curseforge.apiKey = envKey;
  }

  /* 剥离曾挂在 CF 下的 match / 未接线死字段，避免脏配置渗入 Provider（Demeter/契约） */
  const cf = merged.providers.curseforge as CurseForgeProviderConfig & Record<string, unknown>;
  delete cf.match;
  const match = merged.match as PackUpdateMatchConfig & Record<string, unknown>;
  delete match.byUuidInArchive;
  delete match.byName;

  return merged;
}

/** 匹配策略访问器：编排层只读顶层 match，勿挖 providers.*（Demeter） */
export function getPackMatchConfig(cfg: PackUpdateConfig): PackUpdateMatchConfig {
  return cfg.match;
}

/**
 * 确保 configs/pack-update.json 存在；缺失则写入内置 DEFAULTS + $schema。
 * 走 SDK ensureSchemaConfig（DRY）；root 可注入（DIP，供 wizard 任意 rootDir）。
 */
export function ensurePackUpdateConfigFile(root: string = ROOT): string {
  ensureSchemaConfig(
    root,
    "pack-update.json",
    "pack_update",
    { ...DEFAULTS } as Record<string, unknown>
  );
  return packUpdateConfigPath(root);
}
