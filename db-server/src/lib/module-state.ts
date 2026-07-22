import { readJson, writeJson } from "@sfmc-bds/sdk/node/config";

interface ModuleLock {
  version: number;
  modules: Record<string, { enabled?: boolean; updatedAt?: number }>;
}

type ModuleState = ModuleLock["modules"][string];

export function loadModuleLock(filePath: string): ModuleLock {
  const data = readJson<ModuleLock>(filePath);
  const modules = data?.modules && typeof data.modules === "object" ? data.modules : {};
  return { version: 1, modules };
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