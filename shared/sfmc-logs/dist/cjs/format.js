"use strict";
/**
 * format.ts — 日志格式化纯函数
 *
 * 两种格式:
 *   - formatLogLine: 子进程 stdout / 文件落盘用,完整带 ISO 时间戳 + [source] + [LEVEL]
 *   - formatLog:     sfmc 主进程展示用,本地时间 + 对齐 source + 紧凑 level tag,text 原样
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.inferLevel = inferLevel;
exports.padSource = padSource;
exports.levelTag = levelTag;
exports.levelTagFull = levelTagFull;
exports.highlightText = highlightText;
exports.formatLogLine = formatLogLine;
exports.formatLog = formatLog;
const ansi_js_1 = require("./ansi.js");
/** 从原始文本推断日志级别 (关键词匹配,兼容子进程各种前缀风格) */
function inferLevel(text) {
    const t = text.toUpperCase();
    if (t.includes("[FATAL]") || t.includes("[ERROR]") || t.includes("[X]"))
        return "error";
    if (t.includes("[WARN") || t.includes("[WARNING]") || t.includes("[!]"))
        return "warn";
    if (t.includes("[SUCCESS]") || t.includes("[OK]") || t.includes("[√]"))
        return "success";
    if (t.includes("[DEBUG]") || t.includes("[DBG]"))
        return "debug";
    return "info";
}
/** source 字段右侧填充到指定宽度 */
function padSource(s, n = 7) {
    const v = (0, ansi_js_1.visibleLen)(s);
    return v >= n ? s : s + " ".repeat(n - v);
}
/** 紧凑级别标签: [INF] [WRN] [ERR] [OK] [DBG] */
function levelTag(lvl, color = true) {
    switch (lvl) {
        case "error":
            return color ? (0, ansi_js_1.wrap)("red", "[ERR]") : "[ERR]";
        case "warn":
            return color ? (0, ansi_js_1.wrap)("yellow", "[WRN]") : "[WRN]";
        case "success":
            return color ? `${ansi_js_1.ansi.bold}${(0, ansi_js_1.wrap)("green", "[OK]")}` : "[OK]";
        case "debug":
            return color ? `${ansi_js_1.ansi.dim}[DBG]${ansi_js_1.ansi.reset}` : "[DBG]";
        default:
            return color ? (0, ansi_js_1.wrap)("blue", "[INF]") : "[INF]";
    }
}
/** 完整级别标签: [INFO] [WARN] [ERROR] [OK] [DEBUG] */
function levelTagFull(lvl, color = true) {
    switch (lvl) {
        case "error":
            return color ? (0, ansi_js_1.wrap)("red", "[ERROR]") : "[ERROR]";
        case "warn":
            return color ? (0, ansi_js_1.wrap)("yellow", "[WARN]") : "[WARN]";
        case "success":
            return color ? `${ansi_js_1.ansi.bold}${(0, ansi_js_1.wrap)("green", "[OK]")}` : "[OK]";
        case "debug":
            return color ? `${ansi_js_1.ansi.dim}[DEBUG]${ansi_js_1.ansi.reset}` : "[DEBUG]";
        default:
            return color ? (0, ansi_js_1.wrap)("blue", "[INFO]") : "[INFO]";
    }
}
/** 高亮文本中的关键词 (IP / TPS / [LEVEL] 标签等),并 strip Minecraft § 颜色码 */
function highlightText(raw, color = true) {
    let s = raw;
    // strip Minecraft § color codes
    s = s.replace(/§[0-9a-fklmnor]/g, "");
    if (!color)
        return s;
    // [LEVEL] tags
    s = s.replace(/\[ERROR\]/g, (m) => (0, ansi_js_1.wrap)("red", m));
    s = s.replace(/\[FATAL\]/g, (m) => `${ansi_js_1.ansi.bold}${(0, ansi_js_1.wrap)("red", m)}`);
    s = s.replace(/\[WARN(ING)?\]/g, (m) => (0, ansi_js_1.wrap)("yellow", m));
    s = s.replace(/\[SUCCESS\]/g, (m) => `${ansi_js_1.ansi.bold}${(0, ansi_js_1.wrap)("green", m)}`);
    s = s.replace(/\[INFO\]/g, (m) => (0, ansi_js_1.wrap)("blue", m));
    s = s.replace(/\[DEBUG\]/g, (m) => `${ansi_js_1.ansi.dim}${m}${ansi_js_1.ansi.reset}`);
    // IPs
    s = s.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?\b/g, (m) => (0, ansi_js_1.wrap)("cyan", m));
    // keywords
    s = s.replace(/\b(TPS|MSPT|tick|loaded|saved)\b/gi, (m) => (0, ansi_js_1.wrap)("cyan", m));
    return s;
}
/**
 * formatLogLine — 子进程 stdout / 文件落盘用
 * 格式: <ISO时间> [source] [LEVEL] text
 */
function formatLogLine(entry, color = true) {
    const ts = entry.time.toISOString().replace("T", " ").slice(0, 19);
    const tsStr = color ? `${ansi_js_1.ansi.dim}${ts}${ansi_js_1.ansi.reset}` : ts;
    const srcStr = color ? `${ansi_js_1.ansi.bold}${entry.source}${ansi_js_1.ansi.reset}` : entry.source;
    const lvlStr = levelTagFull(entry.level, color);
    return `${tsStr} [${srcStr}] ${lvlStr} ${highlightText(entry.text, color)}`;
}
/**
 * formatLog — sfmc 主进程展示用 (兼容原 sfmc/src/logs.ts 的 formatLog)
 * 格式: <localTime> <paddedSource> <levelTag> <text>
 * text 原样保留 (子进程 stdout 整行,内含其时间戳/source 由 highlightText 美化)
 */
function formatLog(entry, opts = {}) {
    const color = opts.color ?? true;
    const padW = opts.padSourceWidth ?? 7;
    const ts = color
        ? `${ansi_js_1.ansi.dim}${entry.time.toLocaleTimeString()}${ansi_js_1.ansi.reset}`
        : entry.time.toLocaleTimeString();
    const src = color
        ? `${ansi_js_1.ansi.bold}${padSource(entry.source, padW)}${ansi_js_1.ansi.reset}`
        : padSource(entry.source, padW);
    const lvl = levelTag(entry.level, color);
    const txt = highlightText(entry.text, color);
    return `${ts} ${src} ${lvl} ${txt}`;
}
//# sourceMappingURL=format.js.map