/**
 * panels/lock.ts — module-lock.json 形状（与 CLI / db-server 同源）
 */

export type ModuleLockEntry = {
  enabled: boolean;
  /** 毫秒时间戳（CLI 写入 number）。 */
  updatedAt?: number;
};

export type ModuleLock = {
  version: 1;
  modules: Record<string, ModuleLockEntry>;
};
