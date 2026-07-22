/**
 * tools/lib/lock.mjs — modules/module-lock.json 读写
 *
 * 服务类条目(service-* 与 tool-*)保留；业务模块按 manifest.id 启停。
 */
import { MODULE_LOCK_PATH } from "./paths.mjs";
import { readJson, writeJson } from "./io.mjs";

/**
 * @typedef {{ enabled: boolean, updatedAt?: number }} LockState
 * @typedef {{ version: number, modules: Record<string, LockState> }} ModuleLock
 */

const SERVICE_PREFIXES = ["service-", "tool-"];

/** @param {string} id */
export function isServiceLockId(id) {
  return SERVICE_PREFIXES.some((p) => id.startsWith(p));
}

/** @returns {ModuleLock} */
export function readLock() {
  const raw = readJson(MODULE_LOCK_PATH, null);
  if (!raw || typeof raw !== "object") return { version: 1, modules: {} };
  return {
    version: typeof raw.version === "number" ? raw.version : 1,
    modules: raw.modules && typeof raw.modules === "object" ? { ...raw.modules } : {},
  };
}

/** @param {ModuleLock} lock */
export function writeLock(lock) {
  writeJson(MODULE_LOCK_PATH, {
    version: lock.version || 1,
    modules: lock.modules || {},
  });
}

/**
 * @param {string} moduleId manifest.id
 * @param {boolean} enabled
 */
export function setModuleLockEnabled(moduleId, enabled) {
  const lock = readLock();
  lock.modules[moduleId] = {
    enabled: !!enabled,
    updatedAt: Date.now(),
  };
  writeLock(lock);
}

/** @param {string} moduleId */
export function removeModuleLock(moduleId) {
  const lock = readLock();
  if (!(moduleId in lock.modules)) return false;
  delete lock.modules[moduleId];
  writeLock(lock);
  return true;
}

/**
 * 清理 lock 中已不在 catalog 的业务模块条目(保留 service/tool)
 * @param {Set<string>} catalogIds
 */
export function pruneOrphanModuleLocks(catalogIds) {
  const lock = readLock();
  let changed = false;
  for (const id of Object.keys(lock.modules)) {
    if (isServiceLockId(id)) continue;
    if (!catalogIds.has(id)) {
      delete lock.modules[id];
      changed = true;
    }
  }
  if (changed) writeLock(lock);
  return changed;
}
