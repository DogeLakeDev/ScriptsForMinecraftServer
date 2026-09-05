/**
 * @sfmc-bds/sdk/module-loader — 模块装载器与契约校验核心导出
 *
 * 公开能力：
 * - 模块生命周期与注册：ModuleRegistry、announceLoaded、bindModuleAuthHooks
 * - 配置运行时管理：ConfigManager
 * - Manifest 契约校验与问题目录（权威基准）：
 *   - validateManifest / validateManifestV2 / validateManifestV3：模块 manifest 形状校验的唯一权威入口
 *   - ManifestIssue / ManifestIssueKind / ValidationResult：机器可读的结构化校验问题类型
 *   - formatManifestIssue / ManifestExpected：manifest 域适配（内核见 `@sfmc-bds/sdk/validation`）
 *   - migrateV2toV3 / mergeSemanticV3：v2 与 v3 契约平滑迁移与语义块合并
 */

// Manifest v2 / v3 权威 schema、校验器与问题目录导出
export { ManifestExpected, formatManifestIssue } from "./manifest-issues.js";
export type { ManifestExpectedLabel } from "./manifest-issues.js";
export type {
  AnyManifest,
  ManifestIssue,
  ManifestIssueKind,
  ManifestV2,
  ManifestV3,
  ManifestV3DbTable,
  ManifestV3Events,
  ManifestV3PublicApi,
  ManifestV3Semantic,
  ServiceEntry,
  ServiceIO,
  ValidationResult,
} from "./manifest-schema.js";
export {
  mergeSemanticV3,
  migrateV2toV3,
  validateManifest,
  validateManifestV2,
  validateManifestV3,
} from "./manifest.js";

// internal
export type { DataAdapter } from "./data-adapter.js";
export { ConfigManager } from "./internal/config-manager.js";
export { ModuleRegistry, announceLoaded, bindModuleAuthHooks } from "./runtime.js";
export type {
  BdsSystem,
  ModuleAuthHooks,
  ModuleDescriptor,
  ModuleId,
  ModuleLifecycle,
  ModuleServices,
} from "./runtime.js";

// @sfmc-bds/sdk/module-loader 子路径 semver 版本号。
export const SFMC_MODULE_LOADER_VERSION = "0.1.0" as const;
