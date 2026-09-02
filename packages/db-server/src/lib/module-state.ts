import { readJson, writeJson } from "@sfmc-bds/sdk/node/config";

interface ModuleLock {
  version: number;
  modules: Record<string, { enabled?: boolean; updatedAt?: number }>;
}

type ModuleState = ModuleLock["modules"][string];

/**
 * 读取 `module-lock.json` 模块启停锁文件；若文件不存在则初始化空骨架文件并自动落盘。
 *
 * @param filePath 锁文件绝对路径。
 * @returns 模块锁数据结构。
 */
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

/**
 * 持久化写入 `module-lock.json` 模块锁文件。
 *
 * @param filePath 目标文件绝对路径。
 * @param lock 待持久化的模块锁数据。
 */
export function saveModuleLock(filePath: string, lock: ModuleLock): void {
  writeJson(filePath, lock);
}

/**
 * 获取指定模块的启停状态信息。
 *
 * @param lock 模块锁数据。
 * @param id 模块唯一标识符。
 * @param defaults 回退默认状态。
 * @returns 模块状态对象。
 */
export function getModuleState(lock: ModuleLock, id: string, defaults: ModuleState = {}): ModuleState {
  const state = lock.modules[id];
  return state && typeof state === "object" ? state : defaults;
}

/**
 * 判断指定模块当前是否处于启用状态。
 *
 * @param lock 模块锁数据。
 * @param id 模块唯一标识符。
 * @param defaultValue 缺省默认启用值（默认为 `false`）。
 * @returns 是否启用。
 */
export function isEnabled(lock: ModuleLock, id: string, defaultValue: boolean = false): boolean {
  return getModuleState(lock, id).enabled ?? defaultValue;
}

/**
 * 更新指定模块的状态信息并刷新修改时间戳（`updatedAt`）。
 *
 * @param lock 模块锁数据对象。
 * @param id 模块唯一标识符。
 * @param patch 状态增量补丁。
 * @returns 更新后的模块状态对象。
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