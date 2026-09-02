/**
 * @sfmc-bds/sdk/sapi/runtime — SAPI 模块运行时直供工具门面
 *
 * 核心导出能力：
 * - `MenuNavigator` / `FormStatus` / `Observable*`：响应式表单状态机与页面导航
 * - `Msg` / `registerSystemMsgHandler`：玩家频道规范消息与系统频道消息桥
 * - `debug`：统一日志分发门面
 * - `Permission` / `Command`：权限声明与命令注册路由
 * - `HttpDB`：本地 db-server HTTP 客户端
 * - `Money`：经济余额本地缓存与远程账本协调
 * - 几何空间与通用工具函数：`pointInArea_2D`、`getLayout`、`formatTimestamp` 等
 */

export * from "./menu-navigator.js";

export * from "./msg.js";
export * from "./debug-log.js";
export * from "./tools.js";
export * from "./permission.js";
export * from "./command.js";
export * from "./httpdb.js";
export * from "./economy.js";
export { SFMC_SAPI_RUNTIME_VERSION } from "./version.js";