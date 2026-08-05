import { readJson, writeJson } from "@sfmc-bds/sdk/node/config";

interface ModuleLock {
  version: number;
  modules: Record<string, { enabled?: boolean; updatedAt?: number }>;
}

type ModuleState = ModuleLock["modules"][string];

export function loadModuleLock(filePath: string): ModuleLock {
  const data = readJson<ModuleLock>(filePath);
  const modules = data?.modules && typeof data.modules === "object" ? data.modules : {};
  const lock: ModuleLock = { version: 1, modules };
  // 缺文件时落盘空骨架，便于后续 enable/disable（与 configs 同属本地状态）
  if (!data) {
    saveModuleLock(filePath, lock);
  }
  return lock;
}

export function saveModuleLock(filePath: string, lock: ModuleLock): void {
  writeJson(filePath, lock);
}

export function getModuleState(lock: ModuleLock, id: string, defaults: ModuleState = {}): ModuleState {
  const state = lock.modules[id];
  return state && typeof state === "object" ? state : defaults;
}

export function isEnabled(lock: ModuleLock, id: string, defaultValue: boolean = false): boolean {
  return getModuleState(lock, id).enabled ?? defaultValue;
}

export function updateModuleState(
  lock: ModuleLock,
  id: string,
  patch: Partial<Omit<ModuleState, "updatedAt">>
): ModuleState {
  const now = Date.now();
  const previous = getModuleState(lock, id);
  lock.modules[id] = {
    ...previous,
    ...patch,
    updatedAt: now,
  };
  return lock.modules[id];
}