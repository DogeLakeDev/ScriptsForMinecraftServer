/**
 * ui-studio/server.ts — UI Studio 本地服务。
 *
 * 安全约束（设计文档「本地服务安全」）：
 * - 仅监听 127.0.0.1，不暴露到局域网；
 * - 启动时生成随机会话令牌，/api/* 必须携带 Authorization: Bearer；
 * - 携带 Origin 的 API 请求必须通过同源检查；
 * - 文件读取限定在探测到的 ui 工程根内（见 project.ts）；
 * - 不向任何外部服务发送数据。
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import {
  loadUiStudioProject,
  UiStudioProjectError,
  type UiStudioProjectSnapshot,
} from "./project.js";

export interface UiStudioServerOptions {
  /** 模块目录或 ui 目录。 */
  projectDir: string;
  /** 监听端口；0 表示随机。 */
  port?: number;
  /** 前端静态资源目录；默认取构建产物 dist/ui-studio-web。 */
  webRoot?: string;
}

export interface UiStudioServerHandle {
  /** 带会话令牌的完整访问地址。 */
  url: string;
  /** 会话令牌（写操作与后续 API 均需携带）。 */
  token: string;
  port: number;
  /** 工程根（ui 目录）绝对路径。 */
  uiRoot: string;
  close(): Promise<void>;
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

/** 默认静态资源目录：dist/esm/ui-studio/ → dist/ui-studio-web/。 */
function defaultWebRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..", "ui-studio-web");
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(JSON.stringify(body));
}

function isLoopbackOrigin(origin: string | undefined, port: number): boolean {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return (
      (url.hostname === "127.0.0.1" || url.hostname === "localhost") &&
      Number(url.port) === port
    );
  } catch {
    return false;
  }
}

/** 启动 UI Studio 本地服务。 */
export async function startUiStudioServer(
  options: UiStudioServerOptions,
): Promise<UiStudioServerHandle> {
  const projectDir = path.resolve(options.projectDir);
  const webRoot = options.webRoot ?? defaultWebRoot();
  const token = randomBytes(24).toString("base64url");

  // 启动即装载一次，尽早暴露工程目录错误。
  let snapshot: UiStudioProjectSnapshot;
  try {
    snapshot = await loadUiStudioProject(projectDir);
  } catch (error) {
    if (error instanceof UiStudioProjectError) throw error;
    throw new UiStudioProjectError(
      `装载 UI 工程失败：${(error as Error).message}`,
    );
  }

  const server: Server = createServer((req, res) => {
    void handleRequest(req, res).catch((error: unknown) => {
      sendJson(res, 500, { error: `服务内部错误：${(error as Error).message}` });
    });
  });

  const port = await new Promise<number>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 0, "127.0.0.1", () => {
      const address = server.address();
      if (address && typeof address === "object") resolve(address.port);
      else reject(new Error("无法确定监听端口"));
    });
  });

  async function handleRequest(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);

    if (url.pathname.startsWith("/api/")) {
      // 令牌与 Origin 双重检查，覆盖一切 API（含只读）。
      const auth = req.headers.authorization ?? "";
      if (auth !== `Bearer ${token}`) {
        sendJson(res, 401, { error: "缺少或无效的会话令牌" });
        return;
      }
      if (!isLoopbackOrigin(req.headers.origin, port)) {
        sendJson(res, 403, { error: "Origin 检查未通过" });
        return;
      }

      if (url.pathname === "/api/health") {
        sendJson(res, 200, { ok: true });
        return;
      }
      if (url.pathname === "/api/project" && req.method === "GET") {
        // 每次请求重新读取磁盘，外部修改（如用户手动改 JSON）可即时反映。
        try {
          snapshot = await loadUiStudioProject(projectDir);
        } catch (error) {
          if (error instanceof UiStudioProjectError) {
            sendJson(res, 500, { error: error.message });
            return;
          }
          throw error;
        }
        sendJson(res, 200, snapshot);
        return;
      }
      sendJson(res, 404, { error: "未知 API" });
      return;
    }

    await serveStatic(url.pathname, res);
  }

  async function serveStatic(pathname: string, res: ServerResponse): Promise<void> {
    const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const resolved = path.resolve(webRoot, relative);
    // 静态读取同样限定在 webRoot 内。
    const rootWithSep = webRoot.endsWith(path.sep) ? webRoot : webRoot + path.sep;
    if (resolved !== webRoot && !resolved.startsWith(rootWithSep)) {
      sendJson(res, 403, { error: "路径越界" });
      return;
    }
    let file = resolved;
    try {
      const stat = await fs.stat(file);
      if (stat.isDirectory()) file = path.join(file, "index.html");
      await fs.access(file);
    } catch {
      sendJson(res, 404, { error: "资源不存在" });
      return;
    }
    const content = await fs.readFile(file);
    res.writeHead(200, {
      "content-type": MIME_TYPES[path.extname(file)] ?? "application/octet-stream",
      "x-content-type-options": "nosniff",
    });
    res.end(content);
  }

  return {
    url: `http://127.0.0.1:${port}/?token=${token}`,
    token,
    port,
    uiRoot: snapshot.uiRoot,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
