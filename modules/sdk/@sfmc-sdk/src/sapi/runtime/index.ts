// @sfmc/sdk/sapi/runtime — SAPI 模块直供工具
//   - MenuNavigator:表单状态机(从 scriptsforminecraftserver/scripts/libs/MenuNavigator.ts 迁入)
//   - 后续 commit 引入 SapiCommand / SapiPermission / SapiHttpDB / SapiMoney / Msg / debug / 几何工具
export * from "./menu-navigator.js";
export { Msg } from "./msg.js";
export { SFMC_SAPI_RUNTIME_VERSION } from "./version.js";
