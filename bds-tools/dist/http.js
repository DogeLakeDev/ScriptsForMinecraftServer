"use strict";
/**
 * http.ts — 稳定 HTTP 工具 (分阶段超时 + 自动重定向 + 流式下载)
 *
 * 改进:
 *  - connect timeout vs total timeout 分开
 *  - 下载通过流管道，避免大文件加载到内存
 *  - 失败后已写入的临时文件可被清理
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpRequest = httpRequest;
exports.httpGetJson = httpGetJson;
exports.httpGetText = httpGetText;
exports.fetchJsonWithFallback = fetchJsonWithFallback;
exports.httpDownload = httpDownload;
const node_http_1 = __importDefault(require("node:http"));
const node_https_1 = __importDefault(require("node:https"));
const promises_1 = require("node:stream/promises");
const node_fs_1 = require("node:fs");
const logger_js_1 = require("./logger.js");
const MAX_REDIRECTS = 5;
const DEFAULT_CONNECT_TIMEOUT = 15_000;
const DEFAULT_TOTAL_TIMEOUT = 600_000;
async function httpRequest(url, opts = {}) {
    const redirects = opts.redirects ?? 0;
    const totalTimeoutMs = opts.totalTimeoutMs ?? DEFAULT_TOTAL_TIMEOUT;
    const connectTimeoutMs = opts.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT;
    const u = new URL(url);
    const isHttps = u.protocol === "https:";
    const mod = isHttps ? node_https_1.default : node_http_1.default;
    return new Promise((resolve, reject) => {
        const req = mod.request({
            hostname: u.hostname,
            port: u.port || (isHttps ? 443 : 80),
            path: u.pathname + u.search,
            method: opts.method ?? "GET",
            headers: { "User-Agent": "BDSUpdater/2.0", ...(opts.headers ?? {}) },
        }, (res) => {
            const chunks = [];
            res.on("data", (c) => chunks.push(c));
            res.on("end", () => {
                const body = Buffer.concat(chunks);
                const status = res.statusCode ?? 0;
                // 3xx → 跟随 Location
                if (status >= 300 && status < 400 && redirects < MAX_REDIRECTS) {
                    const loc = res.headers.location;
                    if (!loc)
                        return reject(new Error(`HTTP ${status} 但缺少 Location`));
                    const next = loc.startsWith("http") ? loc : new URL(loc, url).href;
                    httpRequest(next, { ...opts, redirects: redirects + 1 })
                        .then(resolve)
                        .catch(reject);
                    return;
                }
                if (status >= 400) {
                    return reject(new Error(`HTTP ${status} for ${url}`));
                }
                resolve({ statusCode: status, body, headers: res.headers });
            });
        });
        const totalTimer = setTimeout(() => {
            req.destroy(new Error(`HTTP 总超时 ${totalTimeoutMs}ms: ${url}`));
        }, totalTimeoutMs);
        const connectTimer = setTimeout(() => {
            req.destroy(new Error(`HTTP 连接超时 ${connectTimeoutMs}ms: ${url}`));
        }, connectTimeoutMs);
        req.on("socket", () => clearTimeout(connectTimer));
        req.on("error", (err) => {
            clearTimeout(totalTimer);
            clearTimeout(connectTimer);
            reject(err);
        });
        if (opts.body)
            req.write(opts.body);
        req.end();
    });
}
async function httpGetJson(url, opts = {}) {
    const res = await httpRequest(url, opts);
    try {
        return JSON.parse(res.body.toString("utf-8"));
    }
    catch (e) {
        throw new Error(`JSON 解析失败 ${url}: ${e.message}`);
    }
}
async function httpGetText(url, opts = {}) {
    const res = await httpRequest(url, opts);
    return res.body.toString("utf-8");
}
/** 多个源并发请求，谁先成功返回（每个源都用 JSON 解析，解析失败也失败） */
async function fetchJsonWithFallback(sources, timeoutMs = 15_000) {
    const tasks = sources.map(async (url) => {
        const res = await httpGetJson(url, { totalTimeoutMs: timeoutMs });
        return { url, value: res };
    });
    const settled = await Promise.allSettled(tasks);
    for (const r of settled) {
        if (r.status === "fulfilled")
            return r.value.value;
    }
    const errors = settled
        .filter((r) => r.status === "rejected")
        .map((r) => r.reason?.message ?? "unknown")
        .join("; ");
    throw new Error(`所有源均不可用: ${errors}`);
}
async function httpDownload(url, destPath, opts = {}) {
    const totalTimeoutMs = opts.totalTimeoutMs ?? DEFAULT_TOTAL_TIMEOUT;
    const connectTimeoutMs = opts.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT;
    const u = new URL(url);
    const isHttps = u.protocol === "https:";
    const mod = isHttps ? node_https_1.default : node_http_1.default;
    let redirects = opts.redirects ?? 0;
    return new Promise((resolve, reject) => {
        const req = mod.request({
            hostname: u.hostname,
            port: u.port || (isHttps ? 443 : 80),
            path: u.pathname + u.search,
            method: "GET",
            headers: { "User-Agent": "BDSUpdater/2.0", ...(opts.headers ?? {}) },
        }, (res) => {
            const status = res.statusCode ?? 0;
            if (status >= 300 && status < 400 && redirects < MAX_REDIRECTS) {
                const loc = res.headers.location;
                if (!loc)
                    return reject(new Error(`HTTP ${status} 缺少 Location`));
                redirects++;
                const next = loc.startsWith("http") ? loc : new URL(loc, url).href;
                res.resume();
                httpDownload(next, destPath, { ...opts, redirects })
                    .then(resolve)
                    .catch(reject);
                return;
            }
            if (status >= 400)
                return reject(new Error(`HTTP ${status} for ${url}`));
            const total = parseInt(String(res.headers["content-length"] ?? 0), 10) || 0;
            const file = (0, node_fs_1.createWriteStream)(destPath);
            let downloaded = 0;
            let failed = false;
            const handleError = (e) => {
                if (failed)
                    return;
                failed = true;
                file.close();
                // 清理 partial 文件
                import("node:fs").then((fs) => {
                    try {
                        fs.unlinkSync(destPath);
                    }
                    catch { }
                });
                reject(e);
            };
            const stream = res;
            stream.on("data", (chunk) => {
                downloaded += chunk.length;
            });
            stream.on("error", (e) => handleError(e));
            file.on("error", (e) => handleError(e));
            (0, promises_1.pipeline)(stream, file).catch((e) => {
                if (!failed)
                    handleError(e);
            });
            // 不能直接监听 file 'finish' 因为我们在错误时手动 handleError
            file.on("finish", () => {
                if (failed)
                    return;
                try {
                    const finalBytes = (0, node_fs_1.statSync)(destPath).size;
                    if (opts.onProgress && total)
                        opts.onProgress(finalBytes, total);
                    resolve(finalBytes);
                }
                catch (e) {
                    reject(e);
                }
            });
        });
        const totalTimer = setTimeout(() => {
            req.destroy(new Error(`下载总超时 ${totalTimeoutMs}ms: ${url}`));
        }, totalTimeoutMs);
        const connectTimer = setTimeout(() => {
            req.destroy(new Error(`下载连接超时 ${connectTimeoutMs}ms: ${url}`));
        }, connectTimeoutMs);
        req.on("socket", () => clearTimeout(connectTimer));
        req.on("error", (e) => {
            clearTimeout(totalTimer);
            clearTimeout(connectTimer);
            logger_js_1.logger.warn(`HTTP 错误 ${url}: ${e.message}`);
            reject(e);
        });
        req.end();
    });
}
//# sourceMappingURL=http.js.map