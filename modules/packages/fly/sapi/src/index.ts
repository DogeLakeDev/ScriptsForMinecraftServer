/**
 * @sfmc/module-fly — SAPI 侧入口
 *
 * 暴露给 scriptsforminecraftserver 行为包启动期:
 *   - Fly.registerPermissions / registerEvents / boot / stop
 *
 * entry.ts 通过 `import * as Fly from "@sfmc/module-fly"` 命名空间形式消费,
 * 与原 `import * as Fly from "./area/Fly.js"` 完全等价(都靠 ES 模块命名空间
 * 把若干具名导出折叠到一个对象上)。
 */

export { registerPermissions, registerEvents, init, boot, stop, playerJoinEvent } from "./Fly.js";