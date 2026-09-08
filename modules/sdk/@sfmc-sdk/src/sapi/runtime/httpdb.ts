/**
 * HttpDB — SAPI 端数据库 HTTP 客户端
 *
 * 通过 @minecraft/server-net 的 HTTP 客户端连接本地 Node.js SQLite 服务。
 *
 * manifest.json 需添加:
 *   { "module_name": "@minecraft/server-net", "version": "1.0.0-beta" }
 */

import { system } from "@minecraft/server";
import { http, HttpRequest, HttpRequestMethod } from "@minecraft/server-net";
import { isSuccessfulHttpEnvelope } from "./http-envelope.js";

/** 默认连接本地 db-server 服务；可通过 configure 或 InstallOptions.dbServerUrl 覆盖。 */
let baseUrl = "http://127.0.0.1:3001";
const TIMEOUT = 3;

/** 单次 HTTP 请求鉴权选项；模块客户端应按请求传递各自的 token，避免覆盖进程级默认值。 */
export type HttpRequestAuthOpts = { authToken?: string };

/** 跨版本兼容的 HttpRequestMethod（动态桥接 Bedrock 现代 PascalCase 与 npm 历史大写枚举）。 */
export const SafeHttpMethod = {
  get Get(): HttpRequestMethod {
    const native = HttpRequestMethod as unknown as Record<string, HttpRequestMethod>;
    return native.Get ?? native.GET ?? ("Get" as unknown as HttpRequestMethod);
  },
  get Post(): HttpRequestMethod {
    const native = HttpRequestMethod as unknown as Record<string, HttpRequestMethod>;
    return native.Post ?? native.POST ?? ("Post" as unknown as HttpRequestMethod);
  },
  get Put(): HttpRequestMethod {
    const native = HttpRequestMethod as unknown as Record<string, HttpRequestMethod>;
    return native.Put ?? native.PUT ?? ("Put" as unknown as HttpRequestMethod);
  },
  get Delete(): HttpRequestMethod {
    const native = HttpRequestMethod as unknown as Record<string, HttpRequestMethod>;
    return native.Delete ?? native.DELETE ?? ("Delete" as unknown as HttpRequestMethod);
  },
};

/**
 * 规范化 HttpRequestMethod，防止大小写或 undefined 导致原生 HttpRequest.method setter 崩溃。
 * 原生 @minecraft/server-net 使用 PascalCase (Get, Post, Put, Delete, Head, Patch)。
 */
function normalizeMethod(method: unknown): HttpRequestMethod {
  const native = HttpRequestMethod as unknown as Record<string, HttpRequestMethod>;
  if (typeof method === "string") {
    const capitalized = method.charAt(0).toUpperCase() + method.slice(1).toLowerCase();
    return (
      native[capitalized] ??
      native[method] ??
      native[method.toUpperCase()] ??
      (capitalized as unknown as HttpRequestMethod)
    );
  }
  return (method as HttpRequestMethod) ?? native.Get ?? native.GET ?? ("Get" as unknown as HttpRequestMethod);
}

// 垫片：兼容使用大写 HttpRequestMethod.GET / POST / PUT / DELETE 的模块代码
try {
  const m = HttpRequestMethod as unknown as Record<string, unknown>;
  if (m && typeof m === "object") {
    if (!m.GET && m.Get) m.GET = m.Get;
    if (!m.POST && m.Post) m.POST = m.Post;
    if (!m.PUT && m.Put) m.PUT = m.Put;
    if (!m.DELETE && m.Delete) m.DELETE = m.Delete;
    if (!m.HEAD && m.Head) m.HEAD = m.Head;
    if (!m.PATCH && m.Patch) m.PATCH = m.Patch;
  }
} catch {
  /* ignore non-extensible */
}

/**
 * SAPI 端 db-server HTTP 客户端门面（底层基于 `@minecraft/server-net`）。
 * 默认连接本地 3001 端口；各业务模块的 db/config/service 客户端按请求注入各自的私有 token。
 */
export class HttpDB {
  private static available = true;
  private static _lastErrorLog = 0;
  /** 进程级默认通道 token（仅供 ConfigManager / DataAdapter 等全局流程使用）。 */
  private static authToken = "";

  /**
   * 注入 db-server 服务基准地址（例如 `http://127.0.0.1:4000`），会自动去除末尾斜杠。
   *
   * @param opts 配置选项。
   */
  static configure(opts: { baseUrl?: string }): void {
    if (opts.baseUrl) {
      baseUrl = opts.baseUrl.replace(/\/+$/, "");
    }
  }

  /** 返回当前使用的 db-server 服务基准地址。 */
  static getBaseUrl(): string {
    return baseUrl;
  }

  /**
   * 设置进程级默认 Bearer token（供平台 ConfigManager / DataAdapter 内部使用）。
   *
   * @param token 平台级鉴权 token。
   */
  static setAuthToken(token: string): void {
    this.authToken = token.trim();
  }

  /**
   * 解析本次请求生效的 Bearer 鉴权 token。
   * 优先使用请求级传入的非空 token；若为空串或未指定则回退使用进程级默认 token。
   *
   * @param opts 请求级鉴权选项。
   * @returns 有效的 Bearer token 字符串。
   */
  static resolveAuthToken(opts?: HttpRequestAuthOpts): string {
    const fromOpts = typeof opts?.authToken === "string" ? opts.authToken.trim() : "";
    return fromOpts || this.authToken.trim();
  }

  /**
   * 为目标 URL 路径附加 `?moduleId=` 或 `&moduleId=` 查询参数（db/config/service 客户端共享）。
   * 服务端鉴权中间件通过 URL 查询参数校验模块身份。
   *
   * @param path 原始请求相对路径。
   * @param moduleId 模块唯一标识符。
   * @returns 附加了模块参数后的完整请求路径。
   */
  static withModuleId(path: string, moduleId: string): string {
    if (!moduleId) return path;
    const sep = path.includes("?") ? "&" : "?";
    return `${path}${sep}moduleId=${encodeURIComponent(moduleId)}`;
  }


  /** 最近一次健康检查是否成功。 */
  static isAvailable(): boolean {
    return this.available;
  }

  private static _shouldLogError(): boolean {
    const now = Date.now();
    if (now - this._lastErrorLog >= 5000) {
      this._lastErrorLog = now;
      return true;
    }
    return false;
  }

  /** 探测 `/api/health`，最多重试 5 次（间隔 2s）。 */
  static async checkHealth(): Promise<boolean> {
    for (let i = 0; i < 5; i++) {
      try {
        const res = await http.get(`${baseUrl}/api/health`);
        this.available = res.status === 200;
        if (this.available) {
          console.info(`[HttpDB] 数据库服务连接成功 (${baseUrl}/api/health)`);
          return true;
        }
        console.error(`[HttpDB] 数据库服务返回异常状态 ${res.status}`);
      } catch (err) {
        this.available = false;
        if (i < 4) {
          console.info(`[HttpDB] 连接失败，2s 后重试 (${i + 1}/5)...`);
          await system.waitTicks(40);
        } else {
          console.error(`[HttpDB] 连接失败 (${baseUrl}): ${err}`);
        }
      }
    }
    return this.available;
  }

  /** GET 并解析 JSON 中指定 key 的字段。 */
  static async fetchJSON<T>(basePath: string, id: string, key: string): Promise<T | null> {
    const body = await HttpDB.get(`${basePath}/${encodeURIComponent(id)}`);
    if (!body) return null;
    try {
      const parsed = JSON.parse(body);
      return parsed[key] ?? null;
    } catch (e) {
      console.warn("[HttpDB] error:", e);
      return null;
    }
  }

  private static async request(
    method: HttpRequestMethod,
    path: string,
    bodyData?: Record<string, unknown>,
    opts?: HttpRequestAuthOpts
  ): Promise<{ status: number; body: string }> {
    const safeMethod = normalizeMethod(method);
    try {
      const req = new HttpRequest(`${baseUrl}${path}`);
      req.timeout = TIMEOUT;
      req.method = safeMethod;

      if (bodyData) {
        req.body = JSON.stringify(bodyData);
        req.addHeader("Content-Type", "application/json");
      }
      // 请求级非空 token 优先;空串视为未传,回落 DataAdapter 默认(DIP)
      const token = HttpDB.resolveAuthToken(opts);
      if (token) req.addHeader("Authorization", `Bearer ${token}`);

      const res = await http.request(req);
      this.available = true;
      return { status: res.status, body: res.body };
    } catch (err) {
      this.available = false;
      if (this._shouldLogError()) {
        console.error(`[HttpDB] ${safeMethod} ${path} 网络错误: ${err}`);
      }
      return { status: 0, body: "" };
    }
  }

  /** 发起 HTTP 请求并返回原始 status/body。 */
  static async requestJSON(
    method: HttpRequestMethod,
    path: string,
    bodyData?: Record<string, unknown>,
    opts?: HttpRequestAuthOpts
  ): Promise<{ status: number; body: string }> {
    return this.request(method, path, bodyData, opts);
  }

  /** 发起 HTTP 请求并解析 `{ ok, data, error }` 信封。 */
  static async typedRequest<T = any>(
    method: HttpRequestMethod,
    path: string,
    bodyData?: Record<string, unknown>,
    opts?: HttpRequestAuthOpts
  ): Promise<{ ok: boolean; data?: T; error?: string; status: number }> {
    const { status, body } = await this.request(method, path, bodyData, opts);
    if (!body) return { ok: false, error: "network_error", status };
    try {
      const parsed = JSON.parse(body);
      // LSP: 同时认 ok / success 方言 — 仅看 ok!==false 会把 HTTP 200+{success:false} 当成功
      if (isSuccessfulHttpEnvelope(status, parsed)) {
        return { ok: true, data: parsed as T, status };
      }
      return { ok: false, error: parsed.error || "request_failed", status, data: parsed as T };
    } catch {
      return { ok: false, error: "invalid_response", status };
    }
  }

  /** GET 请求；非 200 返回 null。 */
  static async get(path: string, opts?: HttpRequestAuthOpts): Promise<string | null> {
    const { status, body } = await this.request(SafeHttpMethod.Get, path, undefined, opts);
    if (status !== 200) console.info(`[HttpDB] GET ${path} → ${status}`);
    return status === 200 ? body : null;
  }

  /** POST 请求；返回是否 HTTP 200。 */
  static async post(
    path: string,
    bodyData: Record<string, unknown>,
    opts?: HttpRequestAuthOpts
  ): Promise<boolean> {
    const { status } = await this.request(SafeHttpMethod.Post, path, bodyData, opts);
    if (status !== 200) console.info(`[HttpDB] POST ${path} → ${status}`);
    return status === 200;
  }

  /** PUT 请求；返回是否 HTTP 200。 */
  static async put(
    path: string,
    bodyData: Record<string, unknown>,
    opts?: HttpRequestAuthOpts
  ): Promise<boolean> {
    const { status } = await this.request(SafeHttpMethod.Put, path, bodyData, opts);
    if (status !== 200) console.info(`[HttpDB] PUT ${path} → ${status}`);
    return status === 200;
  }

  /** DELETE 请求；返回是否 HTTP 200。 */
  static async del(path: string, opts?: HttpRequestAuthOpts): Promise<boolean> {
    const { status } = await this.request(SafeHttpMethod.Delete, path, undefined, opts);
    if (status !== 200) console.info(`[HttpDB] DELETE ${path} → ${status}`);
    return status === 200;
  }
}
