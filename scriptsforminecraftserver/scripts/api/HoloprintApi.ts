/**
 * HoloprintApi — SAPI 端 Holoprint-SFMC 投影系统 HTTP 接口
 *
 * 通过 @minecraft/server-net 的 HTTP 客户端连接本地 db-server 的 Holoprint 端点。
 *
 * manifest.json 需添加：
 *   { "module_name": "@minecraft/server-net", "version": "1.0.0-beta" }
 */

import { http, HttpRequest } from "@minecraft/server-net";
import { ConfigManager } from "../libs/ConfigManager";

const BASE_URL = `http://${ConfigManager.getSetting("db_host", "localhost")}:${ConfigManager.getSetting("db_port", "3000")}`;
const TIMEOUT = 3; // HTTP 请求超时（秒）

export class HoloprintApi {
  private static async request(
    method: string,
    path: string,
    bodyData?: Record<string, unknown>
  ): Promise<{ status: number; body: string }> {
    try {
      const req = new HttpRequest(`${BASE_URL}${path}`);
      req.timeout = TIMEOUT;
      (req as any).method = method;

      if (bodyData) {
        req.body = JSON.stringify(bodyData);
        req.addHeader("Content-Type", "application/json");
      }

      const res = await http.request(req);
      return { status: res.status, body: res.body };
    } catch (err) {
      console.warn(`[HoloprintApi] ${method} ${path} 失败: ${err}`);
      return { status: 0, body: "" };
    }
  }

  // ---- Holoprint 投影 ----

  /**
   *
   *
   * @static
   * @param {*} projectionData
   * @param {string} structureBase64
   * @return {*}  {Promise<boolean>}
   * @memberof HoloprintApi
   */
  static async uploadHoloStructure(projectionData: any, structureBase64: string): Promise<boolean> {
    const { status } = await this.request("Post", "/api/hpbe/upload", {
      projection: projectionData,
      structure: structureBase64,
    });
    return status === 200;
  }

  /**
   *
   *
   * @static
   * @param {string} [ownerId]
   * @param {string} [visibility]
   * @return {*}  {(Promise<any[] | null>)}
   * @memberof HoloprintApi
   */
  static async getHoloProjections(ownerId?: string, visibility?: string): Promise<any[] | null> {
    const qs = [];
    if (ownerId) qs.push(`owner_id=${encodeURIComponent(ownerId)}`);
    if (visibility) qs.push(`visibility=${encodeURIComponent(visibility)}`);
    const query = qs.length > 0 ? "?" + qs.join("&") : "";
    const { status, body } = await this.request("Get", `/api/hpbe/projections${query}`);
    if (status !== 200 || !body) return null;
    try {
      const parsed = JSON.parse(body);
      return parsed.projections ?? null;
    } catch {
      return null;
    }
  }

  /**
   *
   *
   * @static
   * @param {string} id
   * @return {*}  {(Promise<any | null>)}
   * @memberof HoloprintApi
   */
  static async getHoloProjection(id: string): Promise<any | null> {
    const { status, body } = await this.request("Get", `/api/hpbe/projections/${encodeURIComponent(id)}`);
    if (status !== 200 || !body) return null;
    try {
      const parsed = JSON.parse(body);
      return parsed.projection ?? null;
    } catch {
      return null;
    }
  }

  /**
   *
   *
   * @static
   * @param {string} id
   * @param {*} settings
   * @return {*}  {Promise<boolean>}
   * @memberof HoloprintApi
   */
  static async updateHoloProjection(id: string, settings: any): Promise<boolean> {
    const { status } = await this.request("Put", `/api/hpbe/projections/${encodeURIComponent(id)}`, { settings });
    return status === 200;
  }

  /**
   *
   *
   * @static
   * @param {string} id
   * @return {*}  {Promise<boolean>}
   * @memberof HoloprintApi
   */
  static async deleteHoloProjection(id: string): Promise<boolean> {
    const { status } = await this.request("Delete", `/api/hpbe/projections/${encodeURIComponent(id)}`);
    return status === 200;
  }

  /**
   *
   *
   * @static
   * @return {*}  {(Promise<number | null>)}
   * @memberof HoloprintApi
   */
  static async getHoloPackVersion(): Promise<number | null> {
    const { status, body } = await this.request("Get", "/api/hpbe/pack-version");
    if (status !== 200 || !body) return null;
    try {
      const parsed = JSON.parse(body);
      return parsed.version ?? null;
    } catch {
      return null;
    }
  }

  static async getHoloMaterials(projectionId: string): Promise<any[] | null> {
    const { status, body } = await this.request("Get", `/api/hpbe/materials/${encodeURIComponent(projectionId)}`);
    if (status !== 200 || !body) return null;
    try {
      const parsed = JSON.parse(body);
      return parsed.materials ?? null;
    } catch {
      return null;
    }
  }
}
