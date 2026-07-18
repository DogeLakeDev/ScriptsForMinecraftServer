"use strict";
/**
 * version.ts — 版本号工具 / 版本缓存
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toVer3 = toVer3;
exports.toVer4 = toVer4;
exports.compareVersions = compareVersions;
exports.isValidVersion = isValidVersion;
exports.saveVersionCache = saveVersionCache;
exports.getCurrentVersionAsync = getCurrentVersionAsync;
exports.getCurrentVersionSync = getCurrentVersionSync;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const paths_js_1 = require("./paths.js");
const fsx_js_1 = require("./fsx.js");
const logger_js_1 = require("./logger.js");
/** 4段 → 3段 (去尾) */
function toVer3(v) {
    return v.split(".").slice(0, 3).join(".");
}
/** 3段 → 4段 (补 0) */
function toVer4(v) {
    const p = v.split(".");
    while (p.length < 4)
        p.push("0");
    return p.join(".");
}
/** 版本比较 (按 4 段数字排序) */
function compareVersions(a, b) {
    const sa = a.replace(/-preview$/, "");
    const sb = b.replace(/-preview$/, "");
    const pa = sa.split(".").map(Number);
    const pb = sb.split(".").map(Number);
    for (let i = 0; i < 4; i++) {
        const ai = pa[i] ?? 0;
        const bi = pb[i] ?? 0;
        if (ai !== bi)
            return ai - bi;
    }
    // preview 低于不带 -preview 的同一数字
    if (a.endsWith("-preview") && !b.endsWith("-preview"))
        return -1;
    if (!a.endsWith("-preview") && b.endsWith("-preview"))
        return 1;
    return 0;
}
/** 简单的真值校验 (按版本号外形) */
function isValidVersion(v) {
    return /^\d+\.\d+\.\d+(\.\d+)?(-preview)?$/.test(v);
}
function readCache() {
    try {
        return JSON.parse(node_fs_1.default.readFileSync(paths_js_1.VERSION_CACHE, "utf-8"));
    }
    catch {
        return {};
    }
}
/** 仅保留最近 3 条版本缓存 (避免无限增长) */
function trimCache(cache) {
    const keys = Object.keys(cache).sort(compareVersions).slice(-3);
    const trimmed = {};
    for (const k of keys)
        trimmed[k] = cache[k];
    return trimmed;
}
function saveVersionCache(version, sha256) {
    const cache = readCache();
    cache[version] = { sha256, verified_at: Date.now() };
    try {
        const trimmed = trimCache(cache);
        node_fs_1.default.mkdirSync(node_path_1.default.dirname(paths_js_1.VERSION_CACHE), { recursive: true });
        node_fs_1.default.writeFileSync(paths_js_1.VERSION_CACHE, JSON.stringify(trimmed, null, 2));
    }
    catch {
        /* ignore */
    }
}
/**
 * 异步识别当前 BDS 版本
 * 优先通过 SHA256 反查缓存，失败则回退 `current_version.txt`（如果存在）
 */
async function getCurrentVersionAsync(exePath) {
    if (!node_fs_1.default.existsSync(exePath))
        return "0.0.0.0";
    const actual = await (0, fsx_js_1.hashFileAsync)(exePath, "sha256");
    if (!actual)
        return "0.0.0.0";
    const cache = readCache();
    for (const [ver, entry] of Object.entries(cache)) {
        if (entry.sha256 === actual)
            return ver;
    }
    logger_js_1.logger.warn("[BDSUpdater] bedrock_server.exe 哈希未匹配缓存，疑似被改动或首次启动");
    return "0.0.0.0";
}
/** 同步版本 (兼容旧流程) */
function getCurrentVersionSync(exePath) {
    if (!node_fs_1.default.existsSync(exePath))
        return "0.0.0.0";
    const actual = (0, fsx_js_1.hashFileSync)(exePath, "sha256");
    if (!actual)
        return "0.0.0.0";
    const cache = readCache();
    for (const [ver, entry] of Object.entries(cache)) {
        if (entry.sha256 === actual)
            return ver;
    }
    logger_js_1.logger.warn("[BDSUpdater] bedrock_server.exe 哈希未匹配缓存");
    return "0.0.0.0";
}
//# sourceMappingURL=version.js.map