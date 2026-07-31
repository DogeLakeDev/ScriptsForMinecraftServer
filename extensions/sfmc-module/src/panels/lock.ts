/**
 * panels/lock.ts — 模块启停 lock 纯函数（与 sfmc/src/module-toggle.ts#applyLockEnabled 对齐）
 *
 * 文档语义：`modules/module-lock.json` 是启停唯一权威源（db-server / sfmc CLI / 扩展共用）。
 * 扩展必须写 `${sfmcRoot}/modules/module-lock.json`，entry 必须含 `enabled` + `updatedAt`。
 */

export interface ModuleRuntimeState {
  enabled: boolean;
  updatedAt: number;
}

export interface ModuleLock {
  version: number;
  modules: Record<string, ModuleRuntimeState>;
}

/** 就地更新 lock 条目（key = manifest.id / logicalId）。 */
export function applyLockEnabled(
  lock: ModuleLock,
  logicalId: string,
  enabled: boolean,
  now = Date.now()
): ModuleLock {
  lock.version = typeof lock.version === "number" ? lock.version : 1;
  lock.modules ??= {};
  lock.modules[logicalId] = { enabled, updatedAt: now };
  return lock;
}