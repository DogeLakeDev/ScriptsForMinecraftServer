/**
 * 脚本沙箱模块夹具 — 作者可见的 configs / 权限 / 假 DB 意图。
 * 由 playground-host fixture.get / fixture.apply 与 createSandbox 共用。
 */

import { ConfigManager } from "@sfmc-bds/sdk/module-loader";
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
