/* @sfmc-bds/sdk/module-loader
 * 公开 barrel:
 *   - ModuleRegistry:模块注册/生命周期
 *   - ConfigManager:配置缓存(由 installHostBootstrap 注入 data adapter)
 *
 */

// Manifest v2 / v3 schema 与迁移
export type {
  AnyManifest,
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
export { mergeSemanticV3, migrateV2toV3, validateManifestV2, validateManifestV3 } from "./manifest.js";

// internal
export type { DataAdapter } from "./data-adapter.js";
export { ConfigManager } from "./internal/config-manager.js";
export { ModuleRegistry, announceLoaded, bindModuleAuthHooks } from "./runtime.js";
export type { BdsSystem, ModuleAuthHooks, ModuleDescriptor, ModuleId, ModuleLifecycle } from "./runtime.js";

// @sfmc-bds/sdk/module-loader 子路径 semver 版本号。
export const SFMC_MODULE_LOADER_VERSION = "0.1.0" as const;
