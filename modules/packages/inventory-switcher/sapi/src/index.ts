/**
 * @sfmc/module-inventory-switcher — SAPI 侧入口
 *
 * 暴露给行为包启动期 (ModuleRegistry.register 调用点):
 *   - InventorySwitcher.getInstance():注册事件、生命周期
 */

export { InventorySwitcher } from "./InventorySwitcher.js";