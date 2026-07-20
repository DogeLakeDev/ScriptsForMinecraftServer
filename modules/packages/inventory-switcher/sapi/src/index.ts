/**
 * @sfmc/module-inventory-switcher — SAPI 侧入口
 *
 * 暴露给 scriptsforminecraftserver 行为包启动期:
 *   - InventorySwitcher.getInstance():注册事件、生命周期
 */

export { InventorySwitcher } from "./InventorySwitcher.js";