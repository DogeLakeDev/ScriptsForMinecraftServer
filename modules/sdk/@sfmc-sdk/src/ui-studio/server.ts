/**
 * ui-studio/server.ts — UI Studio 本地静态托管服务。
 *
 * 项目化改造后，Studio 是纯浏览器应用：工程数据存放在浏览器 IndexedDB，
 * 通过 zip 导入导出，不再读写磁盘上的真实模块目录。
 * 本服务因此只负责把构建产物（dist/ui-studio-web）托管到回环地址：
 * - 仅监听 127.0.0.1，不暴露到局域网；
 * - 无任何 API 与写操作，不需要会话令牌；
 * - 静态读取限定在 webRoot 内；
 * - 不向任何外部服务发送数据。
 *
 * 早期的受限文件 API（project.ts / save.ts）保留为库函数，
 * 供将来「挂载本地目录」模式复用。
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface UiStudioServerOptions {
  /** 监听端口；0 表示随机。 */
  port?: number;
  /** 前端静态资源目录；默认取构建产物 dist/ui-studio-web。 */
  webRoot?: string;
}

export interface UiStudioServerHandle {
  /** 访问地址。 */
  url: string;
  port: number;
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

/** 启动 UI Studio 本地静态服务。 */
export async function startUiStudioServer(
  options: UiStudioServerOptions = {},
): Promise<UiStudioServerHandle> {
  const webRoot = options.webRoot ?? defaultWebRoot();

  const server: Server = createServer((req, res) => {
    void serveStatic(req, res).catch((error: unknown) => {
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

  async function serveStatic(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    const pathname = url.pathname;
    const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const resolved = path.resolve(webRoot, relative);
    // 静态读取限定在 webRoot 内。
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
      // hash 路由下所有未知路径回退到 index.html（纯前端路由）。
      if (!path.extname(relative)) {
        file = path.join(webRoot, "index.html");
      } else {
        sendJson(res, 404, { error: "资源不存在" });
        return;
      }
    }
    const content = await fs.readFile(file);
    res.writeHead(200, {
      "content-type": MIME_TYPES[path.extname(file)] ?? "application/octet-stream",
      "x-content-type-options": "nosniff",
    });
    res.end(content);
  }

  return {
    url: `http://127.0.0.1:${port}/`,
    port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
