"use strict";
/**
 * qqutil.ts — QQ 通知工具 (基于 LLBot HTTP OneBot 11)
 *
 * 改进:
 *  - sendTimeout 提供总超时，避免通知发送挂死主流程
 *  - 静默模式 (失败不抛出)，保证主流程不被通知干扰
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isQqBridgeEnabled = isQqBridgeEnabled;
exports.sendText = sendText;
exports.sendMixed = sendMixed;
exports.sendWithImage = sendWithImage;
const node_http_1 = __importDefault(require("node:http"));
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const paths_js_1 = require("./paths.js");
const logger_js_1 = require("./logger.js");
let cachedCfg = null;
function getConfig() {
    if (cachedCfg)
        return cachedCfg;
    const cfgPath = node_path_1.default.join(paths_js_1.SCRIPT_DIR, "..", "configs", "qq_config.json");
    try {
        cachedCfg = JSON.parse(node_fs_1.default.readFileSync(cfgPath, "utf-8"));
    }
    catch {
        cachedCfg = {};
    }
    return cachedCfg;
}
/** 检查 qq-bridge 模块是否启用 */
function isQqBridgeEnabled() {
    try {
        const catalog = JSON.parse(node_fs_1.default.readFileSync(node_path_1.default.join(paths_js_1.SCRIPT_DIR, "..", "modules", "catalog.json"), "utf-8"));
        const lock = JSON.parse(node_fs_1.default.readFileSync(node_path_1.default.join(paths_js_1.SCRIPT_DIR, "..", "modules", "module-lock.json"), "utf-8"));
        const mod = catalog.modules?.find((m) => m.id === "qq-bridge" || m.configKey === "qq_bridge");
        return mod ? lock.modules?.[mod.id ?? ""]?.enabled === true : false;
    }
    catch {
        return true; // 默认开启: 模块目录缺失则保守视为可用
    }
}
function sendToLLBot(payload, timeoutMs = 5_000) {
    const cfg = getConfig();
    const url = new URL(cfg.llbot_http || "http://127.0.0.1:3000");
    const data = JSON.stringify(payload);
    return new Promise((resolve, reject) => {
        const req = node_http_1.default.request({
            hostname: url.hostname,
            port: url.port || 3000,
            path: "/send_group_msg",
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(data),
            },
            timeout: timeoutMs,
        }, (res) => {
            let body = "";
            res.on("data", (c) => (body += c));
            res.on("end", () => {
                if (res.statusCode === 200)
                    resolve();
                else
                    reject(new Error(`LLBot HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
            });
        });
        req.on("timeout", () => {
            req.destroy(new Error(`LLBot 超时 ${timeoutMs}ms`));
        });
        req.on("error", reject);
        req.write(data);
        req.end();
    });
}
async function safeSend(label, fn) {
    try {
        await fn();
    }
    catch (e) {
        logger_js_1.logger.warn(`[QQ] ${label} 失败: ${e.message}`);
    }
}
async function sendText(text) {
    const cfg = getConfig();
    if (!isQqBridgeEnabled() || !cfg.qq_group_id) {
        logger_js_1.logger.warn("[QQ] qq-bridge 未启用或 qq_group_id 缺失");
        return;
    }
    await safeSend("sendText", () => sendToLLBot({
        group_id: parseInt(cfg.qq_group_id ?? "0", 10),
        message: [{ type: "text", data: { text } }],
    }));
}
async function sendMixed(segments) {
    const cfg = getConfig();
    if (!isQqBridgeEnabled() || !cfg.qq_group_id) {
        logger_js_1.logger.warn("[QQ] qq-bridge 未启用或 qq_group_id 缺失");
        return;
    }
    await safeSend("sendMixed", () => sendToLLBot({
        group_id: parseInt(cfg.qq_group_id ?? "0", 10),
        message: segments,
    }));
}
async function sendWithImage(text, base64Img) {
    const segments = [];
    if (text)
        segments.push({ type: "text", data: { text } });
    if (base64Img)
        segments.push({ type: "image", data: { file: `base64://${base64Img}` } });
    if (segments.length === 0)
        return;
    await sendMixed(segments);
}
//# sourceMappingURL=qqutil.js.map