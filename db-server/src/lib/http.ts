/**
 * lib/http.ts — HTTP 工具（JSON 响应 + body 解析）
 *
 * 所有 db-server 路由统一走这里的 json / body / parseBody。
 * 路由上下文 ({ path, method, params, req, res }) 在 routes/_shared.ts 定义。
 */

import type { IncomingMessage, ServerResponse } from "node:http";

export type Method = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

/** 写 JSON 响应并结束。 */
export function json(res: ServerResponse, data: Record<string, unknown>, status: number = 200): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

/** 解析请求 body 字符串为对象（解析失败返回空对象）。 */
export function parseBody(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * 异步读取请求 body，结果会缓存到 req._bodyPromise 上以避免重复读取。
 * Buffer 累积 + 异步拼接，正确处理 binary 字节流。
 */
export function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  const cached = (req as IncomingMessage & { _bodyPromise?: Promise<Record<string, unknown>> })._bodyPromise;
  if (cached) return cached;
  const promise = new Promise<Record<string, unknown>>((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer | string) => {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf-8");
      resolve(parseBody(raw));
    });
    req.on("error", () => resolve({}));
  });
  (req as IncomingMessage & { _bodyPromise?: Promise<Record<string, unknown>> })._bodyPromise = promise;
  return promise;
}
