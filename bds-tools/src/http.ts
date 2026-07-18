/**
 * http.ts — 稳定 HTTP 工具 (分阶段超时 + 自动重定向 + 流式下载)
 *
 * 改进:
 *  - connect timeout vs total timeout 分开
 *  - 下载通过流管道，避免大文件加载到内存
 *  - 失败后已写入的临时文件可被清理
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

export async function httpGetText(url: string, opts: HttpOptions = {}): Promise<string> {
  const res = await httpRequest(url, opts);
  return res.body.toString("utf-8");
}

/** 多个源并发请求，谁先成功返回（每个源都用 JSON 解析，解析失败也失败） */
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

/**
 * 流式下载到指定路径，返回字节数。
 * - 失败时自动清理 partial 文件
 * - 支持 progress 回调
 * - 支持 connect/total 阶段超时
 */
export interface DownloadOptions extends HttpOptions {
  onProgress?: (downloaded: number, total: number) => void;
}

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
          if (opts.onProgress && total) {
            const now = Date.now();
            if (now - lastProgressAt >= PROGRESS_INTERVAL_MS) {
              lastProgressAt = now;
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
            // 一个 tick 的节流没触发,也补一次)
            if (opts.onProgress && total) opts.onProgress(finalBytes, total);
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
