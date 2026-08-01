// @sfmc-bds/sdk/module-loader — 模块注册与配置缓存（无 @minecraft/* 顶层依赖）
// 公开:
//   - ModuleRegistry:模块注册/启动/停止/重启实例
//   - ConfigManager:配置缓存(由 installHostBootstrap 注入 data adapter)
//   - onModuleEnabledChange:模块订阅开关变化
//
// BDS 启动入口 installHostBootstrap 在 `@sfmc-bds/sdk/module-loader/install`
//（含 HttpDB / @minecraft/server），勿从此 barrel re-export，以免 node --test 被拉进 SAPI host。
//
// Manifest v2 / v3 schema 与迁移（沙箱读模块语义镜像的基础）。
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
export {
  mergeSemanticV3,
  migrateV2toV3,
  validateManifestV2,
  validateManifestV3,
} from "./manifest.js";

// 内部 internal/*
export type { DataAdapter } from "./data-adapter.js";
export { ConfigManager } from "./internal/config-manager.js";
export {
  ModuleRegistry,
  announceLoaded,
  bindModuleAuthHooks,
  guardEvent,
} from "./runtime.js";
export type {
  BdsSystem,
  CleanUpFn,
  ModuleAuthHooks,
  ModuleDescriptor,
  ModuleId,
  ModuleLifecycle,
} from "./runtime.js";
/** `@sfmc-bds/sdk/module-loader` 子路径 semver 版本号。 */
export const SFMC_MODULE_LOADER_VERSION = "0.1.0" as const;
