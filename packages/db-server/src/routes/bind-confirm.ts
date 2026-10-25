/**
 * routes/bind-confirm.ts — 游戏内 /c:bind 的统一确认入口（平台 HTTP，仅本机）
 *
 *   POST /api/sfmc/bind/confirm  { code, xuid, name }
 *     → 成功 { success: true, provider: "qq" | "wechat", binding }
 *     → 失败 { success: false, error, hint? }（错误码与 QQ 原接口一致，新增 wechat_already_bound / player_already_bound_wechat）
 *
 * 按注册的绑定提供方查找持有该短码的渠道并确认（OCP：新增渠道不改本路由）。
 * 旧接口 POST /api/sfmc/qq/bind/confirm 保留，供旧版游戏侧脚本使用。
 */

import type http from "node:http";
import { confirmWithProviders, type BindProvider } from "../domain/bind-providers.js";

interface Deps {
  body: (req: http.IncomingMessage) => Promise<Record<string, unknown>>;
  json: (res: http.ServerResponse, data: Record<string, unknown>, status?: number) => void;
  /** 已注册的绑定提供方（按顺序询问） */
  providers: () => readonly BindProvider[];
}

/**
 * 创建统一确认路由。
 * 使用场景：index.ts 装配到平台路由链。
 */
function createBindConfirmRoutes({ body, json, providers }: Deps) {
  return async function handle({
    path,
    method,
    req,
    res,
  }: {
    path: string;
    method: string;
    req: http.IncomingMessage;
    res: http.ServerResponse;
  }): Promise<boolean> {
    if (path !== "/api/sfmc/bind/confirm" || method !== "POST") return false;
    const data = await body(req);
    const code = String(data.code ?? "").trim();
    const xuid = String(data.xuid ?? data.player_xuid ?? "").trim();
    const name = String(data.name ?? data.player_name ?? "").trim();
    if (!code || !xuid) {
      json(res, { success: false, error: "code_and_xuid_required" }, 400);
      return true;
    }
    const result = confirmWithProviders(providers(), { code, xuid, name, now: Date.now() });
    if (result.ok) json(res, { success: true, provider: result.provider, binding: result.binding });
    else json(res, { success: false, error: result.error, ...(result.hint ? { hint: result.hint } : {}) }, result.status);
    return true;
  };
}

export { createBindConfirmRoutes };
