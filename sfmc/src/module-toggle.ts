/**
 * module-toggle.ts — 模块启停：本地 lock 权威 + 通知结果信封
 *
 * CLI 先写 module-lock.json；db 在线时再 best-effort HTTP 热同步。
 * 纯函数与 IO 分离，供单测覆盖 resolve / lock patch / 结果判定。
 */

import type { ModuleLock } from "@sfmc-bds/sdk/node/config";

export type ToggleCandidate = {
  logicalId: string;
  folderId: string;
  configKey?: string;
  canDisable: boolean;
};

export type ToggleNotify =
  | { ok: true }
  | { ok: false; reason: "unreachable" | "http"; detail?: string };

export type ToggleFinalize = { ok: boolean; warnNotify: boolean };

/** 按 folderId / logicalId / configKey 解析启停目标（与 db resolveModuleByKey 对齐）。 */
export function resolveToggleTarget(query: string, candidates: ToggleCandidate[]): ToggleCandidate | null {
  const k = String(query || "").trim();
  if (!k) return null;
  return (
    candidates.find(
      (c) => c.folderId === k || c.logicalId === k || (c.configKey != null && c.configKey === k)
    ) ?? null
  );
}

/** 就地更新 lock 条目（键为 manifest.id / logicalId）。 */
export function applyLockEnabled(lock: ModuleLock, logicalId: string, enabled: boolean): ModuleLock {
  const modules = lock.modules && typeof lock.modules === "object" ? lock.modules : {};
  lock.modules = modules;
  lock.version = typeof lock.version === "number" ? lock.version : 1;
  modules[logicalId] = {
    enabled: !!enabled,
    updatedAt: Date.now(),
  };
  return lock;
}

/**
 * 本地已落盘时，通知失败仍算成功（warnNotify）；本地未写则失败。
 */
export function finalizeToggle(localWritten: boolean, notify: ToggleNotify): ToggleFinalize {
  if (!localWritten) return { ok: false, warnNotify: false };
  if (notify.ok) return { ok: true, warnNotify: false };
  return { ok: true, warnNotify: true };
}
