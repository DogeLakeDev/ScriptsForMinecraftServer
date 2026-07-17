import { readJsonFile, writeJsonFile } from "./json.js";

interface ModuleLock {
  version: number;
  modules: Record<string, { enabled?: boolean; updatedAt?: number }>;
}

type ModuleState = ModuleLock["modules"][string];

/**
 *
 *
 * @export
 * @param {string} filePath
 * @return {*}  {ModuleLock}
 */
export function loadModuleLock(filePath: string): ModuleLock {
  try {
    const data = readJsonFile<ModuleLock>(filePath);
    const modules = data?.modules && typeof data.modules === "object" ? data.modules : {};
    return { version: 1, modules };
  } catch {
    return { version: 1, modules: {} };
  }
}

/**
 *
 *
 * @export
 * @param {string} filePath
 * @param {ModuleLock} lock
 */
export function saveModuleLock(filePath: string, lock: ModuleLock): void {
  writeJsonFile<ModuleLock>(filePath, lock);
}

/**
 *
 *
 * @export
 * @param {ModuleLock} lock
 * @param {string} id
 * @param {ModuleState} [defaults={}]
 * @return {*}  {ModuleState}
 */
export function getModuleState(lock: ModuleLock, id: string, defaults: ModuleState = {}): ModuleState {
  const state = lock.modules[id];
  return state && typeof state === "object" ? state : defaults;
}

/**
 *
 *
 * @export
 * @param {ModuleLock} lock
 * @param {string} id
 * @param {boolean} [defaultValue=false]
 * @return {*}
 */
export function isEnabled(lock: ModuleLock, id: string, defaultValue: boolean = false): boolean {
  return getModuleState(lock, id).enabled ?? defaultValue;
}

/**
 *
 *
 * @export
 * @param {ModuleLock} lock
 * @param {string} id
 * @param {Partial<Omit<ModuleState, "updatedAt">>} patch
 * @return {*}  {ModuleState}
 */
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
