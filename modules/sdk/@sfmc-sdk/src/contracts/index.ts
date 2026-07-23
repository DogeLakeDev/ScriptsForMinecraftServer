/**
 * contracts/index.ts — 平台级共享类型
 *
 * 仅保留模块目录 / lock 协议。业务域类型由各模块在 sfmc-modules 内维护。
 */
export type { ModuleCatalog, ModuleCatalogEntry, ModuleEntryPath, ModuleLock, ModuleRuntimeState } from "./module.js";
