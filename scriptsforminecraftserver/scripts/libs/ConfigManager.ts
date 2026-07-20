// 临时 shim — Commit 13 删除。
// 历史 scriptsforminecraftserver/scripts/libs/ConfigManager.ts 内部曾用
// `import { CreativeArea } from "../area/CreativeArea.js"` + `_syncRuntimeFlags()`
// 直接推 CreativeArea.enable / Peace.enable。本批迁到 @sfmc/sdk/module-loader 后,
// 这两个反向耦合已被切断(改用 onModuleEnabledChange 事件订阅)。
// 旧调用方继续走 ConfigManager.isEnabled() / getSetting() / getAreas() 等无副作用接口,
// 行为等价。
export { ConfigManager } from "@sfmc/sdk/module-loader";
export type { DataAdapter } from "@sfmc/sdk/module-loader";
