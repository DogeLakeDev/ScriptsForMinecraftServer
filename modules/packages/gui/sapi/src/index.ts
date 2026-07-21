/**
 * @sfmc/module-gui — SAPI 侧入口
 *
 * 暴露给行为包启动期 (ModuleRegistry.register 调用点):
 *   - AdminGUI.show(player):管理面板入口(模块开关)
 *   - MainMenu.registerMenuCommand / show:!menu 主菜单
 *   - MoneyGUI.registerCommand:!money 货币管理
 *
 * gui/ChatGUI / CoopGUI / LandGUI 由对应 @sfmc/module-*-gui 包导出,
 * MainMenu 等通过包名空间 import 过去。
 *
 * AdminGUI 直接读 CreativeArea.enable / Peace.getInstance().enable —— 这些
 * 模块已经在 stage E1/E5 落到对应 package,这里改成 `@sfmc/module-creative`
 * 和 `@sfmc/module-peace` 命名空间引用,与 entry.ts 的 switch 对齐。
 */

export { AdminGUI } from "./AdminGUI.js";
export { MainMenu } from "./MainMenu.js";
export { MoneyGUI } from "./MoneyGUI.js";