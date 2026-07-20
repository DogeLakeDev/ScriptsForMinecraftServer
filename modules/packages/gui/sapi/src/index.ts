/**
 * @sfmc/module-gui — SAPI 侧入口
 *
 * 暴露给 scriptsforminecraftserver 行为包启动期:
 *   - AdminGUI.show(player):管理面板入口(模块开关)
 *   - MainMenu.registerMenuCommand / show:!menu 主菜单
 *   - MoneyGUI.registerCommand:!money 货币管理
 *
 * gui/ChatGUI.ts (452 LOC) / gui/CoopGUI.ts (710) / gui/LandGUI.ts (692)
 * 按本批计划留在 scriptsforminecraftserver/scripts/gui/ 下,直到 stage H
 * 把它们各自搬走(MainMenu 内的 import 通过 5-up 相对路径暂时指过去)。
 *
 * AdminGUI 直接读 CreativeArea.enable / Peace.getInstance().enable —— 这些
 * 模块已经在 stage E1/E5 落到对应 package,这里改成 `@sfmc/module-creative`
 * 和 `@sfmc/module-peace` 命名空间引用,与 entry.ts 的 switch 对齐。
 */

export { AdminGUI } from "./AdminGUI.js";
export { MainMenu } from "./MainMenu.js";
export { MoneyGUI } from "./MoneyGUI.js";