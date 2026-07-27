/**
 * module.ts — 模块目录 共享数据模型
 */

/** 模块 SAPI 入口描述（manifest entry）。 */
export interface ModuleEntryPath {
  /** 入口类型（如 sapi）。 */
  kind: string;
  /** 相对路径。 */
  path: string;
  /** 初始化符号名。 */
  init: string;
}

/** catalog 中单条模块元数据。 */
export interface ModuleCatalogEntry {
  /** 模块 id（catalog/manifest）。 */
  id: string;
  /** 对应 configs 文件名键（不含 .json）。 */
  configKey: string;
  /** 显示名称。 */
  name: string;
  /** 模块类型。 */
  type: string;
  /** 简介。 */
  description: string;
  /** 安装后默认是否启用。 */
  enabledByDefault: boolean;
  /** 是否允许运行时禁用。 */
  canDisable: boolean;
  /** 硬依赖模块 id 列表。 */
  requires: string[];
  /** 可选依赖模块 id 列表。 */
  optional: string[];
  /** 注册的命令名列表。 */
  commands: string[];
  /** SAPI 入口描述。 */
  entry: ModuleEntryPath;
}

/** 本地模块目录（`modules/catalog.json` 投影）。 */
export interface ModuleCatalog {
  /** 目录格式版本。 */
  version: number;
  /** 已安装模块列表。 */
  modules: ModuleCatalogEntry[];
}

/** 单模块运行时启停状态（`module-lock.json` 条目）。 */
export interface ModuleRuntimeState {
  /** 是否启用。 */
  enabled?: boolean;
  /** 最后更新时间戳。 */
  updatedAt?: number;
}

/** 模块启停锁文件（`modules/module-lock.json`）。 */
export interface ModuleLock {
  /** 锁文件格式版本。 */
  version: number;
  /** 模块 id → 运行时状态。 */
  modules: Record<string, ModuleRuntimeState>;
}
