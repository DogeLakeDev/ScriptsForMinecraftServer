/**
 * format.ts — 日志格式化纯函数
 *
 * 两种格式:
 *   - formatLogLine: 子进程 stdout / 文件落盘用,完整带 ISO 时间戳 + [source] + [LEVEL]
 *   - formatLog:     sfmc 主进程展示用,本地时间 + 对齐 source + 紧凑 level tag,text 原样
 */
import { ansi, visibleLen, wrap } from "./ansi.js";
/** 从原始文本推断日志级别 (关键词匹配,兼容子进程各种前缀风格) */
export function inferLevel(text) {
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
export function padSource(s, n = 7) {
    const v = visibleLen(s);
    return v >= n ? s : s + " ".repeat(n - v);
}
/** 紧凑级别标签: [INF] [WRN] [ERR] [OK] [DBG] */
export function levelTag(lvl, color = true) {
    switch (lvl) {
        case "error":
            return color ? wrap("red", "[ERR]") : "[ERR]";
        case "warn":
            return color ? wrap("yellow", "[WRN]") : "[WRN]";
        case "success":
            return color ? `${ansi.bold}${wrap("green", "[OK]")}` : "[OK]";
        case "debug":
            return color ? `${ansi.dim}[DBG]${ansi.reset}` : "[DBG]";
        default:
            return color ? wrap("blue", "[INF]") : "[INF]";
    }
}
/** 完整级别标签: [INFO] [WARN] [ERROR] [OK] [DEBUG] */
export function levelTagFull(lvl, color = true) {
    switch (lvl) {
        case "error":
            return color ? wrap("red", "[ERROR]") : "[ERROR]";
        case "warn":
            return color ? wrap("yellow", "[WARN]") : "[WARN]";
        case "success":
            return color ? `${ansi.bold}${wrap("green", "[OK]")}` : "[OK]";
        case "debug":
            return color ? `${ansi.dim}[DEBUG]${ansi.reset}` : "[DEBUG]";
        default:
            return color ? wrap("blue", "[INFO]") : "[INFO]";
    }
}
/** 高亮文本中的关键词 (IP / TPS / [LEVEL] 标签等),并 strip Minecraft § 颜色码 */
export function highlightText(raw, color = true) {
    let s = raw;
    // strip Minecraft § color codes
    s = s.replace(/§[0-9a-fklmnor]/g, "");
    if (!color)
        return s;
    // [LEVEL] tags
    s = s.replace(/\[ERROR\]/g, (m) => wrap("red", m));
    s = s.replace(/\[FATAL\]/g, (m) => `${ansi.bold}${wrap("red", m)}`);
    s = s.replace(/\[WARN(ING)?\]/g, (m) => wrap("yellow", m));
    s = s.replace(/\[SUCCESS\]/g, (m) => `${ansi.bold}${wrap("green", m)}`);
    s = s.replace(/\[INFO\]/g, (m) => wrap("blue", m));
    s = s.replace(/\[DEBUG\]/g, (m) => `${ansi.dim}${m}${ansi.reset}`);
    // IPs
    s = s.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?\b/g, (m) => wrap("cyan", m));
    // keywords
    s = s.replace(/\b(TPS|MSPT|tick|loaded|saved)\b/gi, (m) => wrap("cyan", m));
    return s;
}
/**
 * formatLogLine — 子进程 stdout / 文件落盘用
 * 格式: <ISO时间> [source] [LEVEL] text
 */
export function formatLogLine(entry, color = true) {
    const ts = entry.time.toISOString().replace("T", " ").slice(0, 19);
    const tsStr = color ? `${ansi.dim}${ts}${ansi.reset}` : ts;
    const srcStr = color ? `${ansi.bold}${entry.source}${ansi.reset}` : entry.source;
    const lvlStr = levelTagFull(entry.level, color);
    return `${tsStr} [${srcStr}] ${lvlStr} ${highlightText(entry.text, color)}`;
}
/**
 * formatLog — sfmc 主进程展示用 (兼容原 sfmc/src/logs.ts 的 formatLog)
 * 格式: <localTime> <paddedSource> <levelTag> <text>
 * text 原样保留 (子进程 stdout 整行,内含其时间戳/source 由 highlightText 美化)
 */
export function formatLog(entry, opts = {}) {
    const color = opts.color ?? true;
    const padW = opts.padSourceWidth ?? 7;
    const ts = color
        ? `${ansi.dim}${entry.time.toLocaleTimeString()}${ansi.reset}`
        : entry.time.toLocaleTimeString();
    const src = color
        ? `${ansi.bold}${padSource(entry.source, padW)}${ansi.reset}`
        : padSource(entry.source, padW);
    const lvl = levelTag(entry.level, color);
    const txt = highlightText(entry.text, color);
    return `${ts} ${src} ${lvl} ${txt}`;
}
//# sourceMappingURL=format.js.map