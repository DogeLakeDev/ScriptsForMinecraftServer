/**
 * activity-client.ts — 经本机 db-server 读取微信玩家自己的行为记录
 *
 * 使用场景：player-activity-routes.ts 的 GET …/player/activity（小程序「我的行为记录」页）。
 * 以 PlayerActivitySource 接口提供（DIP），路由不依赖 db-server 的 HTTP 细节，单测可替换为内存实现。
 * 执行者由 db-server 按 openid 的绑定强制限定，这里不转发 actorId / actorName。
 */
import type { ActivityQueryResult } from "@sfmc-bds/management";
import { HttpError } from "./routes.js";

/** 玩家视角的一页行为记录；bound 为 false 表示该微信尚未绑定游戏账号 */
export interface PlayerActivityPage extends ActivityQueryResult {
  bound: boolean;
}

/** 玩家行为记录数据源 */
export interface PlayerActivitySource {
  /** 按小程序传来的查询参数读取 openid 绑定账号的记录 */
  page(openid: string, params: URLSearchParams): Promise<PlayerActivityPage>;
}

/** 允许从小程序转发给 db-server 的查询参数 */
const FORWARDED_PARAMS = ["eventType", "eventTypePrefix", "targetId", "dimension", "level", "from", "to", "keyword", "limit", "offset"] as const;

/**
 * 基于 db-server HTTP 的实现。
 *
 * @param baseUrl 例如 http://127.0.0.1:3001
 */
export function createDbActivitySource(baseUrl: string, fetchImpl: typeof fetch = fetch): PlayerActivitySource {
  return {
    async page(openid, params) {
      const search = new URLSearchParams({ openid });
      for (const key of FORWARDED_PARAMS) {
        const value = params.get(key);
        if (value) search.set(key, value);
      }
      let status: number;
      let data: Record<string, unknown>;
      try {
        const response = await fetchImpl(`${baseUrl}/api/sfmc/wechat/activity?${search.toString()}`, { signal: AbortSignal.timeout(10_000) });
        status = response.status;
        data = (await response.json()) as Record<string, unknown>;
      } catch {
        throw new HttpError(503, "游戏服务器数据服务暂不可用，请稍后再试");
      }
      if (data.success !== true) {
        throw new HttpError(status === 400 ? 400 : 502, typeof data.message === "string" ? data.message : "读取行为记录失败");
      }
      return {
        bound: data.bound === true,
        installed: data.installed === true,
        records: Array.isArray(data.records) ? (data.records as ActivityQueryResult["records"]) : [],
        total: Number(data.total) || 0,
        limit: Number(data.limit) || 0,
        offset: Number(data.offset) || 0,
      };
    },
  };
}
