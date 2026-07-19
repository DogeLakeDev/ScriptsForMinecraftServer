/**
 * module.ts — 模块目录 共享数据模型
 */

export interface ModuleEntryPath {
  kind: string;
  path: string;
  init: string;
}

export interface ModuleCatalogEntry {
  id: string;
  configKey: string;
  name: string;
  type: string;
  description: string;
  enabledByDefault: boolean;
  canDisable: boolean;
  requires: string[];
  optional: string[];
  commands: string[];
  entry: ModuleEntryPath;
}

export interface ModuleCatalog {
  version: number;
  modules: ModuleCatalogEntry[];
}

export interface ModuleRuntimeState {
  enabled?: boolean;
  updatedAt?: number;
}

export interface ModuleLock {
  version: number;
  modules: Record<string, ModuleRuntimeState>;
}
