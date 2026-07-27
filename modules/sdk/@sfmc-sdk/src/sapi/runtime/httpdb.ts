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

/** 默认连本机 db-server;可通过 configure / InstallOptions.dbServerUrl 覆盖(DIP)。 */
let baseUrl = "http://127.0.0.1:3001";
const TIMEOUT = 3;

/** 单次请求可选覆盖;模块客户端应传自己的 token,勿抢进程级默认值(DIP)。 */
export type HttpRequestAuthOpts = { authToken?: string };

/**
 * SAPI 端 db-server HTTP 客户端（经 `@minecraft/server-net`）。
 * 默认连本机 3001；模块 db/config/service 客户端按请求注入 token。
 */
export class HttpDB {
  private static available = true;
  private static _lastErrorLog = 0;
  /** 仅 ConfigManager / DataAdapter 默认通道;模块 db/config/service 走 per-request。 */
  private static authToken = "";

  /** 注入 db-server 基址(如 http://127.0.0.1:4000),去掉末尾 /。 */
  static configure(opts: { baseUrl?: string }): void {
    if (opts.baseUrl) {
      baseUrl = opts.baseUrl.replace(/\/+$/, "");
    }
  }

  /** 返回当前 db-server 基址。 */
  static getBaseUrl(): string {
    return baseUrl;
  }

  /** 设置进程级默认 Bearer token（ConfigManager / DataAdapter 用）。 */
  static setAuthToken(token: string): void {
    this.authToken = token.trim();
  }

  /**
   * 解析本次请求 Bearer:请求级非空 token 优先;空串视为未传,回落进程默认(DIP)。
   * 勿用 `opts?.authToken ?? default` — `""` 会挡住回落。
   */
  static resolveAuthToken(opts?: HttpRequestAuthOpts): string {
    const fromOpts = typeof opts?.authToken === "string" ? opts.authToken.trim() : "";
    return fromOpts || this.authToken.trim();
  }

  /**
   * 给路径附上 ?moduleId= / &moduleId=(db/config/service 客户端共用,DRY)。
   * verifyModuleAuth 只认 query 上的 moduleId。
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
    try {
      const req = new HttpRequest(`${baseUrl}${path}`);
      req.timeout = TIMEOUT;
      req.method = method;

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
        console.error(`[HttpDB] ${method} ${path} 网络错误: ${err}`);
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
    const { status, body } = await this.request(HttpRequestMethod.GET, path, undefined, opts);
    if (status !== 200) console.info(`[HttpDB] GET ${path} → ${status}`);
    return status === 200 ? body : null;
  }

  /** POST 请求；返回是否 HTTP 200。 */
  static async post(
    path: string,
    bodyData: Record<string, unknown>,
    opts?: HttpRequestAuthOpts
  ): Promise<boolean> {
    const { status } = await this.request(HttpRequestMethod.POST, path, bodyData, opts);
    if (status !== 200) console.info(`[HttpDB] POST ${path} → ${status}`);
    return status === 200;
  }

  /** PUT 请求；返回是否 HTTP 200。 */
  static async put(
    path: string,
    bodyData: Record<string, unknown>,
    opts?: HttpRequestAuthOpts
  ): Promise<boolean> {
    const { status } = await this.request(HttpRequestMethod.PUT, path, bodyData, opts);
    if (status !== 200) console.info(`[HttpDB] PUT ${path} → ${status}`);
    return status === 200;
  }

  /** DELETE 请求；返回是否 HTTP 200。 */
  static async del(path: string, opts?: HttpRequestAuthOpts): Promise<boolean> {
    const { status } = await this.request(HttpRequestMethod.DELETE, path, undefined, opts);
    if (status !== 200) console.info(`[HttpDB] DELETE ${path} → ${status}`);
    return status === 200;
  }
}
