// @sfmc/sdk/module-loader — host 装配层(被行为包构建管线消费)
// 公开:
//   - installHostBootstrap():SAPI 启动入口
//   - ModuleRegistry:模块注册/启动/停止/重启实例
//   - ConfigManager:配置缓存(由 installHostBootstrap 注入 data adapter)
//   - onModuleEnabledChange:模块订阅开关变化
//
// 内部 internal/* 不从 SDK 外部 import。
export { ConfigManager } from "./internal/config-manager.js";
export { Modules } from "./internal/module-keys.js";
export type { ModuleKey, ModuleId } from "./internal/module-keys.js";
export { ModuleRegistry } from "./runtime.js";
export type { ModuleLifecycle, ModuleDescriptor } from "./runtime.js";
export { guardEvent, announceLoaded } from "./runtime.js";
export { installHostBootstrap } from "./install.js";
export type { InstallOptions, HostBackend, ModuleSurface } from "./install.js";
export const SFMC_MODULE_LOADER_VERSION = "0.1.0" as const;
