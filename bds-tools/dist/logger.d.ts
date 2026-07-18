/**
 * logger.ts — 已废弃,统一改用 log.ts
 *
 * 此文件保留仅为向后兼容 (safe-delete 限制无法删除)。
 * 实际日志逻辑在 log.ts,通过 @sfmc/logs 共享包接入。
 *
 * 新代码请直接:import { log } from "./log.js"
 */
export { log as logger, closeLog as closeLogger } from "./log.js";
//# sourceMappingURL=logger.d.ts.map