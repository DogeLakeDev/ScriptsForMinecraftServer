/**
 * @sfmc/module-creative — SAPI 侧入口
 *
 * 暴露给行为包启动期 (ModuleRegistry.register 调用点):
 *   - CreativeArea.getInstance():注册命令/权限、订阅事件、生命周期
 *
 * 跨包依赖的相对路径保留 — 仓内 BP 暂未拆出,Stage D-G 把 gui/libs/api 等
 * 迁到各自模块后再修。
 */

export { CreativeArea } from "./CreativeArea.js";