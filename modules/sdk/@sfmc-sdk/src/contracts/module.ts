/**
 * module.ts — 模块目录与启停状态共享契约数据模型
 */

/** 模块 SAPI 入口描述（manifest entry）。 */
export interface ModuleEntryPath {
  /** 入口类型（例如 "sapi"）。 */
  kind: string;
  /** 入口文件相对路径。 */
  path: string;
  /** 模块初始化导出的符号函数名。 */
  init: string;
}

/** 模块目录（catalog）中单条模块元数据。 */
export interface ModuleCatalogEntry {
  /** 模块唯一标识符（对应 catalog 与 manifest 中的 id）。 */
  id: string;
  /** 对应 `configs/` 目录下的配置文件基名（不含 `.json` 后缀）。 */
  configKey: string;
  /** 模块显示名称。 */
  name: string;
  /** 模块类型类别。 */
  type: string;
  /** 模块功能简要描述。 */
  description: string;
  /** 安装后是否默认处于启用状态。 */
  enabledByDefault: boolean;
  /** 是否允许在运行时动态禁用该模块。 */
  canDisable: boolean;
  /** 硬依赖的模块 id 列表。 */
  requires: string[];
  /** 可选依赖的模块 id 列表。 */
  optional: string[];
  /** 模块注册的指令名列表。 */
  commands: string[];
  /** SAPI 入口定义。 */
  entry: ModuleEntryPath;
}

/** 本地已安装模块目录快照（映射 `modules/catalog.json` 文件结构）。 */
export interface ModuleCatalog {
  /** 目录契约格式版本号。 */
  version: number;
  /** 已安装模块元数据列表。 */
  modules: ModuleCatalogEntry[];
}

/** 单个模块的运行时启停状态（`module-lock.json` 单项）。 */
export interface ModuleRuntimeState {
  /** 当前是否启用。 */
  enabled?: boolean;
  /** 状态最后更新的 Unix 毫秒时间戳。 */
  updatedAt?: number;
}

/** 模块启停锁文件数据结构（映射 `modules/module-lock.json`）。 */
export interface ModuleLock {
  /** 锁文件契约格式版本号。 */
  version: number;
  /** 模块 id 到运行时状态的映射字典。 */
  modules: Record<string, ModuleRuntimeState>;
}

