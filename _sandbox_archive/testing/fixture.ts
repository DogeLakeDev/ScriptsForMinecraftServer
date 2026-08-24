/**
 * 脚本沙箱模块夹具 — 作者可见的 configs / 权限 / 假 DB 意图。
 * 由 playground-host fixture.get / fixture.apply 与 createSandbox 共用。
 */

import fs from "node:fs";
import path from "node:path";
import {
  ConfigManager,
  mergeSemanticV3,
  migrateV2toV3,
  type ManifestV3,
  type ManifestV3Semantic,
  validateManifestV3,
} from "@sfmc-bds/sdk/module-loader";
import type { MemoryConfigsAll, MemoryDataAdapter } from "./host/memory-data-adapter.js";
import type { FakeDb } from "./fake-db.js";
import type { FakePlayer } from "./engine/overrides/player.js";
import { PlayerPermissionLevel } from "./engine/runtime.js";

/** Permission 常见等级（对齐 sapi/runtime Permission）。 */
export const FIXTURE_PERMISSION_LEVELS = {
  Any: 0,
  Member: 1,
  OP: 2,
  Admin: 3,
} as const;

/** 作者夹具意图（重置场景后宿主可保留并重新应用）。 */
export type SandboxFixtureIntent = {
  /** settings 键值覆盖（合并进内存 configs）。 */
  settings?: Record<string, unknown>;
  /**
   * 权限表覆盖（整表替换）。
   * 与 treatPlayersAsOp 同时给出时，先写本表再为场景玩家补 OP。
   */
  permissions?: Array<{ player_name: string; level: number }>;
  /** 场景中已有玩家一律视为 OP（ConfigManager 覆盖 + FakePlayer.permissionLevel）。 */
  treatPlayersAsOp?: boolean;
  /** 模块 enabled；写入 modules[] 对应项。缺省不改。 */
  enabled?: boolean;
  /** 应用时清空假 DB 调用日志（无完整种子 API）。 */
  clearDb?: boolean;
  /**
   * 模块 manifest v3 语义字段（仅补强，不覆盖模块自身的 semantic）。
   * 留空表示「不注入」；模块 manifest 是 v2 时由 sandbox 自动 migrate 到 v3。
   */
  semantic?: ManifestV3Semantic;
};

/** fixture.get 返回的可读快照。 */
export type SandboxFixtureSnapshot = {
  module: { id: string; root?: string } | null;
  moduleRoot: string | null;
  enabled: boolean | null;
  configs: MemoryConfigsAll;
  intent: SandboxFixtureIntent;
  /** 假 DB 最近 call 条数（无完整种子；高级请用测试代码 stubServices）。 */
  dbCallCount: number;
  note: string;
};

export type ApplyFixtureContext = {
  adapter: MemoryDataAdapter;
  db: FakeDb;
  moduleId: string | null;
  getPlayers: () => FakePlayer[];
};

function mergePermissions(
  base: Array<{ player_name: string; level: number }>,
  intent: SandboxFixtureIntent,
  players: FakePlayer[]
): Array<{ player_name: string; level: number }> {
  const map = new Map<string, number>();
  for (const p of base) {
    if (p?.player_name) map.set(p.player_name, Number(p.level));
  }
  if (intent.permissions) {
    map.clear();
    for (const p of intent.permissions) {
      if (p?.player_name) map.set(p.player_name, Number(p.level));
    }
  }
  if (intent.treatPlayersAsOp) {
    for (const pl of players) {
      map.set(pl.name, FIXTURE_PERMISSION_LEVELS.OP);
    }
  }
  return [...map.entries()].map(([player_name, level]) => ({ player_name, level }));
}

function setModuleEnabled(configs: MemoryConfigsAll, moduleId: string, enabled: boolean): void {
  const modules = configs.modules ?? [];
  let hit = false;
  for (const m of modules) {
    const id = String(m.id || m.module_id || "").trim();
    if (id === moduleId) {
      m.enabled = enabled;
      hit = true;
    }
  }
  if (!hit && moduleId) {
    const configKey = moduleId.includes("-")
      ? moduleId.slice(moduleId.indexOf("-") + 1).replace(/-/g, "_")
      : moduleId;
    modules.push({ id: moduleId, configKey, enabled, installed: true });
  }
  configs.modules = modules;
}

/**
 * 将夹具意图写入内存适配器并刷新 ConfigManager。
 * enabled 变更只刷新启停缓存（不重新 boot）；完整重装请 reset 场景。
 */
export async function applyFixtureIntent(
  ctx: ApplyFixtureContext,
  intent: SandboxFixtureIntent
): Promise<SandboxFixtureIntent> {
  const snap = ctx.adapter.getSnapshot();
  const players = ctx.getPlayers();

  if (intent.settings !== undefined) {
    snap.settings = { ...(snap.settings ?? {}), ...structuredClone(intent.settings) };
  }

  if (intent.enabled !== undefined && ctx.moduleId) {
    setModuleEnabled(snap, ctx.moduleId, intent.enabled);
  }

  snap.permissions = mergePermissions(snap.permissions ?? [], intent, players);

  ctx.adapter.replace(snap);
  await ConfigManager.loadAll();
  if (intent.enabled !== undefined) {
    await ConfigManager.refreshModules();
  }

  if (intent.treatPlayersAsOp) {
    for (const pl of players) {
      pl.playerPermissionLevel = PlayerPermissionLevel.Operator;
    }
  }

  if (intent.clearDb) {
    ctx.db.reset();
  }

  const out: SandboxFixtureIntent = {};
  if (intent.settings) out.settings = structuredClone(intent.settings);
  if (intent.permissions) out.permissions = structuredClone(intent.permissions);
  if (intent.treatPlayersAsOp !== undefined) out.treatPlayersAsOp = intent.treatPlayersAsOp;
  if (intent.enabled !== undefined) out.enabled = intent.enabled;
  if (intent.clearDb !== undefined) out.clearDb = intent.clearDb;
  /* semantic 不参与 ConfigManager；只透传以便 snapshot 用。 */
  if (intent.semantic !== undefined) out.semantic = structuredClone(intent.semantic);
  return out;
}

/** 从 createSandbox 初始 opts 合成 configs（夹具 settings/permissions/enabled）。 */
export function configsFromFixtureIntent(
  base: MemoryConfigsAll,
  intent: SandboxFixtureIntent | undefined,
  moduleId: string | undefined
): MemoryConfigsAll {
  const out = structuredClone(base);
  if (!intent) return out;
  if (intent.settings) {
    out.settings = { ...(out.settings ?? {}), ...structuredClone(intent.settings) };
  }
  if (intent.permissions) {
    out.permissions = structuredClone(intent.permissions);
  }
  if (intent.enabled !== undefined && moduleId) {
    setModuleEnabled(out, moduleId, intent.enabled);
  }
  return out;
}

/**
 * 从 moduleRoot 读 sapi/manifest.json 并解析为 v3 manifest。
 *   - 文件缺失 / 解析失败 → 返回 null（沙箱可继续，但 moduleManifest 为 null）；
 *   - schemaVersion ∈ {2, 3}；
 *   - v2 → 自动 migrate 到 v3；
 *   - v3 → 走 validateManifestV3；校验失败时剥掉 semantic 但保留 v3 顶层字段。
 *   - fixture.semantic 非空时合并进 v3.semantic（patch 不覆盖 base）。
 */
export function resolveModuleManifest(
  moduleRoot: string | undefined,
  fixtureSemantic: ManifestV3Semantic | undefined
): ManifestV3 | null {
  if (!moduleRoot) return null;
  const manifestPath = path.join(moduleRoot, "sapi", "manifest.json");
  let raw: unknown;
  try {
    const text = fs.readFileSync(manifestPath, "utf8");
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  let v3: ManifestV3;
  if (raw && typeof raw === "object" && (raw as { schemaVersion?: unknown }).schemaVersion === 3) {
    const validated = validateManifestV3(raw);
    v3 = validated.ok
      ? validated.manifest
      : /* 校验失败：保留必需字段，去掉 semantic，避免把坏数据塞进沙箱。 */
        stripUnsafeSemantic(raw);
  } else if (raw && typeof raw === "object" && (raw as { schemaVersion?: unknown }).schemaVersion === 2) {
    v3 = migrateV2toV3(raw as never);
  } else {
    return null;
  }
  if (!fixtureSemantic) return v3;
  const mergedSemantic = mergeSemanticV3(v3.semantic, fixtureSemantic);
  return mergedSemantic ? { ...v3, semantic: mergedSemantic } : v3;
}

/** v3 校验失败时，剥掉 semantic 但保留 v3 顶层字段，避免沙箱读到坏数据。 */
function stripUnsafeSemantic(raw: unknown): ManifestV3 {
  const r = raw as Record<string, unknown>;
  const out: ManifestV3 = {
    schemaVersion: 3,
    id: typeof r.id === "string" ? r.id : "",
    name: typeof r.name === "string" ? r.name : "",
    type: r.type === "core" || r.type === "feature" ? r.type : "feature",
    configKey: typeof r.configKey === "string" ? r.configKey : "",
    requires: Array.isArray(r.requires) ? r.requires.filter((s): s is string => typeof s === "string") : [],
    permissions: Array.isArray(r.permissions)
      ? r.permissions.filter((s): s is string => typeof s === "string")
      : [],
    ...(r.services && typeof r.services === "object"
      ? { services: r.services as ManifestV3["services"] }
      : {}),
  };
  return out;
}

export function buildFixtureSnapshot(opts: {
  module: { id: string; root?: string } | null;
  moduleRoot: string | null;
  enabled: boolean | null;
  adapter: MemoryDataAdapter;
  intent: SandboxFixtureIntent;
  db: FakeDb;
}): SandboxFixtureSnapshot {
  return {
    module: opts.module,
    moduleRoot: opts.moduleRoot,
    enabled: opts.enabled,
    configs: opts.adapter.getSnapshot(),
    intent: structuredClone(opts.intent),
    dbCallCount: opts.db.calls.length,
    note: "假 DB 仅支持清空调用日志；服务种子请用 createSandbox({ db: { provides } }) 或测试代码 stubServices",
  };
}
