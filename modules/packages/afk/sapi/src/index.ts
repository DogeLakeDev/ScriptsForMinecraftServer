/**
 * @sfmc/module-afk — SAPI 侧入口
 *
 * 暴露给行为包启动期 (ModuleRegistry.register 调用点):
 *   registerPermissions / registerEvents / init / stop / registerCommand / reset / setAFK
 */
export * from "./AFK.js";
