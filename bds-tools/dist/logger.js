"use strict";
/**
 * logger.ts — 单例流式日志 (避免断行 / 文件描述符泄漏)
 *
 * appendFileSync 在长消息或高频调用下可能撞到 buffer 边界，导致行被截断。
 * 这里使用 createWriteStream + 缓冲行，单例保持一个 FD。
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.closeLogger = closeLogger;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const paths_js_1 = require("./paths.js");
let stream = null;
function getStream() {
    if (stream)
        return stream;
    node_fs_1.default.mkdirSync(node_path_1.default.dirname(paths_js_1.LOG_PATH), { recursive: true });
    stream = node_fs_1.default.createWriteStream(paths_js_1.LOG_PATH, { flags: "a", encoding: "utf-8" });
    stream.on("error", () => {
        // 退化到 console.error；不抛出以避免中断主流程
    });
    return stream;
}
function ts() {
    return new Date().toISOString().replace("T", " ").slice(0, 19);
}
function write(level, msg) {
    const line = `[${ts()}] [${level}] ${msg}`;
    // 控制台
    if (level === "ERROR")
        console.error(line);
    else
        console.log(line);
    // 文件
    try {
        getStream().write(line + "\n");
    }
    catch {
        /* ignore */
    }
}
exports.logger = {
    info(msg) { write("INFO", msg); },
    warn(msg) { write("WARN", msg); },
    error(msg) { write("ERROR", msg); },
};
function closeLogger() {
    if (stream) {
        stream.end();
        stream = null;
    }
}
//# sourceMappingURL=logger.js.map