/**
 * HttpDB — SAPI 端数据库 HTTP 客户端
 *
 * 通过 @minecraft/server-net 的 HTTP 客户端连接本地 Node.js SQLite 服务。
 *
 * manifest.json 需添加：
 *   { "module_name": "@minecraft/server-net", "version": "1.0.0-beta" }
 */

import { http, HttpRequest } from "@minecraft/server-net";
import { Config } from "../data/Config";

const BASE_URL = `http://${Config.dbHost}:${Config.dbPort}`;
const TIMEOUT = 3; // HTTP 请求超时（秒）

export class HttpDB {
  private static available = true;

  static isAvailable(): boolean {
    return this.available;
  }

  static async checkHealth(): Promise<boolean> {
    try {
      const res = await http.get(`${BASE_URL}/api/health`);
      this.available = res.status === 200;
      if (this.available) {
        console.info(`[HttpDB] 数据库服务连接成功 (${BASE_URL}/api/health)`);
      } else {
        console.error(`[HttpDB] 数据库服务返回异常状态 ${res.status}`);
      }
    } catch (err) {
      this.available = false;
      console.error(`[HttpDB] 连接失败 (${BASE_URL}): ${err}`);
    }
    return this.available;
  }

  // ---- 通用 HTTP 方法 ----

  static async get(path: string): Promise<string | null> {
    try {
      const res = await http.get(`${BASE_URL}${path}`);
      return res.status === 200 ? res.body : null;
    } catch {
      this.available = false;
      return null;
    }
  }

  static async post(path: string, bodyData: Record<string, unknown>): Promise<boolean> {
    try {
      const req = new HttpRequest(`${BASE_URL}${path}`);
      req.timeout = TIMEOUT;
      (req as any).method = "Post"; // POST
      req.body = JSON.stringify(bodyData);
      req.addHeader("Content-Type", "application/json");
      const res = await http.request(req);
      if (res.status !== 200) {
        console.warn(`[HttpDB] POST ${path} 返回 ${res.status}: ${res.body}`);
      }
      return res.status === 200;
    } catch (err) {
      this.available = false;
      console.warn(`[HttpDB] POST ${path} 失败: ${err}`);
      return false;
    }
  }

  private static async del(path: string): Promise<boolean> {
    try {
      const req = new HttpRequest(`${BASE_URL}${path}`);
      req.timeout = TIMEOUT;
      (req as any).method = "Delete"; // DELETE
      const res = await http.request(req);
      return res.status === 200;
    } catch {
      return false;
    }
  }

  // ---- 消息历史 ----

  static async saveMessage(
    channelId: string,
    message: {
      id: string; fromid: string; fromName: string; type: string;
      content: string; attachment?: string; showTimestamp: boolean; timestamp: number;
    }
  ): Promise<boolean> {
    return this.post("/api/messages/save", { channelId, message });
  }

  static async loadHistory(channelId: string, cutoff: number): Promise<any[] | null> {
    const body = await this.get(`/api/messages/${encodeURIComponent(channelId)}?cutoff=${cutoff}`);
    if (!body) return null;
    try { return JSON.parse(body).messages; }
    catch { return null; }
  }

  static async deleteChannelMessages(channelId: string): Promise<boolean> {
    return this.del(`/api/messages/${encodeURIComponent(channelId)}`);
  }

  static async cleanupExpired(channels: { channelId: string; retention: number }[]): Promise<boolean> {
    return this.post("/api/messages/cleanup", { channels });
  }

  // ---- 红包 ----

  static async saveRedPacket(redpacket: any): Promise<boolean> {
    return this.post("/api/redpackets/save", { redpacket });
  }

  static async updateRedPacket(redpacket: any): Promise<boolean> {
    return this.post("/api/redpackets/update", { redpacket });
  }

  static async getRedPackets(): Promise<any[] | null> {
    const body = await this.get("/api/redpackets");
    if (!body) return null;
    try { return JSON.parse(body).redpackets; }
    catch { return null; }
  }

  static async getRedPacket(packetId: string): Promise<any | null> {
    const body = await this.get(`/api/redpackets/${encodeURIComponent(packetId)}`);
    if (!body) return null;
    try { return JSON.parse(body).redpacket ?? null; }
    catch { return null; }
  }

  static async cleanupExpiredRedPackets(): Promise<boolean> {
    return this.post("/api/cleanup-expired-rp", {});
  }

  // ---- 计分板同步 ----

  static async syncScoreboards(entries: any[]): Promise<boolean> {
    return this.post("/api/sfmc/scoreboards/sync", { entries });
  }

  static async loadScoreboards(filter?: { objective?: string; name?: string; id?: string }): Promise<any[] | null> {
    const params = new URLSearchParams();
    if (filter?.objective) params.set('objective', filter.objective);
    if (filter?.name) params.set('name', filter.name);
    if (filter?.id) params.set('id', filter.id);
    const qs = params.toString();
    const body = await this.get(`/api/sfmc/scoreboards${qs ? '?' + qs : ''}`);
    if (!body) return null;
    try { return JSON.parse(body).entries; }
    catch { return null; }
  }

  static async getScoreboardObjectives(): Promise<any[] | null> {
    const body = await this.get("/api/sfmc/scoreboards/objectives");
    if (!body) return null;
    try { return JSON.parse(body).objectives; }
    catch { return null; }
  }

  static async clearScoreboards(): Promise<boolean> {
    return this.del("/api/sfmc/scoreboards");
  }

  // ---- 行为日志 ----

  static async batchActivities(entries: any[]): Promise<boolean> {
    return this.post("/api/sfmc/activities/batch", { entries });
  }

  static async queryActivities(filter?: {
    id?: string; event?: string; from?: number; to?: number;
    name?: string; limit?: number; offset?: number;
  }): Promise<any[] | null> {
    const params = new URLSearchParams();
    if (filter?.id) params.set('id', filter.id);
    if (filter?.event) params.set('event', filter.event);
    if (filter?.from) params.set('from', String(filter.from));
    if (filter?.to) params.set('to', String(filter.to));
    if (filter?.name) params.set('name', filter.name);
    if (filter?.limit) params.set('limit', String(filter.limit));
    if (filter?.offset) params.set('offset', String(filter.offset));
    const qs = params.toString();
    const body = await this.get(`/api/sfmc/activities${qs ? '?' + qs : ''}`);
    if (!body) return null;
    try { return JSON.parse(body).entries; }
    catch { return null; }
  }

  static async getActivityStats(filter?: { id?: string; from?: number; to?: number }): Promise<any | null> {
    const params = new URLSearchParams();
    if (filter?.id) params.set('id', filter.id);
    if (filter?.from) params.set('from', String(filter.from));
    if (filter?.to) params.set('to', String(filter.to));
    const qs = params.toString();
    const body = await this.get(`/api/sfmc/activities/stats${qs ? '?' + qs : ''}`);
    if (!body) return null;
    try { return JSON.parse(body); }
    catch { return null; }
  }

  static async cleanupActivities(keepDays: number = 30, keepAdmin: boolean = true): Promise<boolean> {
    return this.post("/api/sfmc/activities/cleanup", { keepDays, keepAdmin }) as unknown as boolean;
  }

  // ---- 通用 KV 存储 ----

  /** 获取全部 KV 键值对（启动加载用） */
  static async getAllKV(): Promise<{ key: string; value: string }[] | null> {
    const body = await this.get("/api/kv");
    if (!body) return null;
    try { return JSON.parse(body).kv; }
    catch { return null; }
  }

  static async getKV(key: string): Promise<any | null> {
    const body = await this.get(`/api/kv/${encodeURIComponent(key)}`);
    if (!body) return null;
    try { return JSON.parse(body).value; }
    catch { return null; }
  }

  static async setKV(key: string, value: string): Promise<boolean> {
    return this.post("/api/kv/save", { key, value });
  }

  static async deleteKV(key: string): Promise<boolean> {
    return this.del(`/api/kv/${encodeURIComponent(key)}`);
  }
}
