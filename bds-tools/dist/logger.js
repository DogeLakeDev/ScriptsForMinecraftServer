"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeLogger = exports.logger = void 0;
/**
 * logger.ts — 已废弃,统一改用 log.ts
 *
 * 此文件保留仅为向后兼容 (safe-delete 限制无法删除)。
 * 实际日志逻辑在 log.ts,通过 @sfmc/logs 共享包接入。
 *
 * 新代码请直接:import { log } from "./log.js"
 */
var log_js_1 = require("./log.js");
Object.defineProperty(exports, "logger", { enumerable: true, get: function () { return log_js_1.log; } });
Object.defineProperty(exports, "closeLogger", { enumerable: true, get: function () { return log_js_1.closeLog; } });
//# sourceMappingURL=logger.js.map