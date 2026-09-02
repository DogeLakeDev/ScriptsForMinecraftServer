/**
 * http.ts — 针对大文件与外部上游设计的 HTTP 网络请求工具
 *
 * 核心机制：
 * - 分阶段超时控制：区分连接建立超时（connectTimeout）与全量传输超时（totalTimeout）
 * - 自动重定向处理：安全跟踪 3xx 跳转（最多 5 次）
 * - 流式文件下载：通过 pipeline 管道直接落盘，避免大文件一次性加载至内存
 * - 异常容错清理：下载失败时自动清理残留的临时文件碎片
 */

import http from "node:http";
import https from "node:https";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createWriteStream, statSync } from "node:fs";
import { log } from "./log.js";

interface HttpOptions {
  method?: "GET" | "HEAD" | "POST";
  headers?: Record<string, string>;
  body?: string;
  connectTimeoutMs?: number;
  totalTimeoutMs?: number;
  redirects?: number;
}

const MAX_REDIRECTS = 5;
const DEFAULT_CONNECT_TIMEOUT = 15_000;
const DEFAULT_TOTAL_TIMEOUT = 600_000;

/**
 * 发起底层 HTTP/HTTPS 请求。
 *
 * @param url 目标请求地址。
 * @param opts 请求参数（包含请求方法、请求头、主体、阶段超时时间及重定向次数等）。
 * @returns 包含状态码、响应体 Buffer 及响应头字典的结果对象。
 */
export async function httpRequest(

  url: string,
  opts: HttpOptions = {}
): Promise<{ statusCode: number; body: Buffer; headers: Record<string, string | string[] | undefined> }> {
  const redirects = opts.redirects ?? 0;
  const totalTimeoutMs = opts.totalTimeoutMs ?? DEFAULT_TOTAL_TIMEOUT;
  const connectTimeoutMs = opts.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT;

  const u = new URL(url);
  const isHttps = u.protocol === "https:";
  const mod = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const req = mod.request(
      {
        hostname: u.hostname,
        port: u.port || (isHttps ? 443 : 80),
        path: u.pathname + u.search,
        method: opts.method ?? "GET",
        headers: { "User-Agent": "BDSUpdater/2.0", ...(opts.headers ?? {}) },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const body = Buffer.concat(chunks);
          const status = res.statusCode ?? 0;
          // 3xx → 跟随 Location
          if (status >= 300 && status < 400 && redirects < MAX_REDIRECTS) {
            const loc = res.headers.location;
            if (!loc) return reject(new Error(`HTTP ${status} 但缺少 Location`));
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
      }
    );

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

    if (opts.body) req.write(opts.body);
    req.end();
  });
}

/**
 * 发起 GET 请求并自动将响应体解析为 JSON 数据对象。
 *
 * @template T 预期的 JSON 数据类型。
 * @param url 请求目标 URL。
 * @param opts 请求配置选项。
 * @returns 解析后的 JSON 对象。
 */
export async function httpGetJson<T = unknown>(
  url: string,
  opts: HttpOptions = {}
): Promise<T> {
  const res = await httpRequest(url, opts);
  try {
    return JSON.parse(res.body.toString("utf-8")) as T;
  } catch (e) {
    throw new Error(`JSON 解析失败 ${url}: ${(e as Error).message}`);
  }
}

/**
 * 发起 GET 请求并获取 UTF-8 纯文本响应内容。
 *
 * @param url 请求目标 URL。
 * @param opts 请求配置选项。
 * @returns 响应文本字符串。
 */
export async function httpGetText(url: string, opts: HttpOptions = {}): Promise<string> {
  const res = await httpRequest(url, opts);
  return res.body.toString("utf-8");
}

/**
 * 针对多个备选源并发发起请求，由最先成功返回且合法解析 JSON 的源提供数据（Happy Eyeballs 机制）。
 *
 * @template T 返回的 JSON 数据类型。
 * @param sources 候选 URL 列表。
 * @param timeoutMs 超时时间（毫秒，默认为 15000）。
 * @returns 最先成功响应的数据。
 * @throws 当所有备选源均失败时抛出聚合错误。
 */
export async function fetchJsonWithFallback<T = unknown>(
  sources: string[],
  timeoutMs = 15_000
): Promise<T> {
  const tasks = sources.map(async (url) => {
    const res = await httpGetJson<T>(url, { totalTimeoutMs: timeoutMs });
    return { url, value: res };
  });
  const settled = await Promise.allSettled(tasks);
  for (const r of settled) {
    if (r.status === "fulfilled") return r.value.value;
  }
  const errors = settled
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map((r) => r.reason?.message ?? "unknown")
    .join("; ");
  throw new Error(`所有源均不可用: ${errors}`);
}

/** 下载配置选项。 */
export interface DownloadOptions extends HttpOptions {
  /** 下载进度变化回调函数。 */
  onProgress?: (downloaded: number, total: number) => void;
}

/**
 * 流式下载网络资源至本地指定路径。
 * - 传输失败时自动删除残留的临时文件碎片
 * - 支持节流的进度通知回调
 * - 支持连接建立与全量传输双阶段独立超时
 *
 * @param url 下载目标地址。
 * @param destPath 本地落盘目标绝对路径。
 * @param opts 下载参数选项。
 * @returns 成功下载的总字节数。
 */


export async function httpDownload(
  url: string,
  destPath: string,
  opts: DownloadOptions = {}
): Promise<number> {
  const totalTimeoutMs = opts.totalTimeoutMs ?? DEFAULT_TOTAL_TIMEOUT;
  const connectTimeoutMs = opts.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT;

  const u = new URL(url);
  const isHttps = u.protocol === "https:";
  const mod = isHttps ? https : http;
  let redirects = opts.redirects ?? 0;

  return new Promise((resolve, reject) => {
    const req = mod.request(
      {
        hostname: u.hostname,
        port: u.port || (isHttps ? 443 : 80),
        path: u.pathname + u.search,
        method: "GET",
        headers: { "User-Agent": "BDSUpdater/2.0", ...(opts.headers ?? {}) },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && redirects < MAX_REDIRECTS) {
          const loc = res.headers.location;
          if (!loc) return reject(new Error(`HTTP ${status} 缺少 Location`));
          redirects++;
          const next = loc.startsWith("http") ? loc : new URL(loc, url).href;
          res.resume();
          httpDownload(next, destPath, { ...opts, redirects })
            .then(resolve)
            .catch(reject);
          return;
        }
        if (status >= 400) return reject(new Error(`HTTP ${status} for ${url}`));

        const total = parseInt(String(res.headers["content-length"] ?? 0), 10) || 0;
        const file = createWriteStream(destPath);
        let downloaded = 0;
        let failed = false;
        // 节流进度回调:每个 tick 最多 10 次/秒(100ms 间隔),
        // 避免 cli-progress 频繁重绘拖慢下载
        let lastProgressAt = 0;
        const PROGRESS_INTERVAL_MS = 100;

        const handleError = (e: Error): void => {
          if (failed) return;
          failed = true;
          file.close();
          // 清理 partial 文件
          import("node:fs").then((fs) => {
            try { fs.unlinkSync(destPath); } catch {}
          });
          reject(e);
        };

        const stream: Readable = res;
        stream.on("data", (chunk: Buffer) => {
          downloaded += chunk.length;
          if (opts.onProgress) {
            const now = Date.now();
            if (now - lastProgressAt >= PROGRESS_INTERVAL_MS) {
              lastProgressAt = now;
              /* total=0（无 Content-Length）时仍回调，调用方可用已下载字节更新 UI */
              opts.onProgress(downloaded, total);
            }
          }
        });
        stream.on("error", (e) => handleError(e as Error));

        file.on("error", (e) => handleError(e as Error));

        pipeline(stream, file).catch((e) => {
          if (!failed) handleError(e as Error);
        });

        // 不能直接监听 file 'finish' 因为我们在错误时手动 handleError
        file.on("finish", () => {
          if (failed) return;
          try {
            const finalBytes = statSync(destPath).size;
            // 收尾:确保最后一次回调让进度条走到 100%(即便最近
            // 一个 tick 的节流没触发,也补一次)。
            // 无 Content-Length（total=0）时用 finalBytes 作总量，与中途「仍回调」契约一致（LSP）。
            if (opts.onProgress) {
              opts.onProgress(finalBytes, total > 0 ? total : finalBytes);
            }
            resolve(finalBytes);
          } catch (e) {
            reject(e as Error);
          }
        });
      }
    );

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
      log.warn(`HTTP 错误 ${url}: ${(e as Error).message}`);
      reject(e);
    });
    req.end();
  });
}
