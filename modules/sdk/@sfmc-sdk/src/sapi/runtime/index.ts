// @sfmc/sdk/sapi/runtime — SAPI 模块直供工具
//
//   - MenuNavigator / FormStatus / Observable*:表单状态机
//   - Msg / registerSystemMsgHandler:玩家频道消息 + 系统频道桥
//   - debug:统一日志门面
//   - Permission / Command:权限注册 + 命令注册 + 模块守卫
//   - HttpDB:db-server HTTP 客户端
//   - Money:本地缓存 + 远程账本协调
//   - 工具函数:pointInArea_2D / getRandomInteger / getLayout /
//     ensureDoubleChest / placeSign / getShanghaiTime /
//     formatTimestamp / generateId / dimensionId /
//     toQueryString / ListFormInfo
//
// 这些是 Stage F 把 scriptsforminecraftserver/scripts/libs/*.ts 原样
// 迁入后的稳定形态。所有原文件都以无副作用的方式 import 与 export,运行时
// 副作用只剩 Command.registerScriptEvent() 在 module load 时挂一次
// scriptEventReceive 监听。
export * from "./menu-navigator.js";
export * from "./msg.js";
export * from "./debug-log.js";
export * from "./tools.js";
export * from "./permission.js";
export * from "./command.js";
export * from "./httpdb.js";
export * from "./economy.js";
export { SFMC_SAPI_RUNTIME_VERSION } from "./version.js";