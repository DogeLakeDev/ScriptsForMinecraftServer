/**
 * player-routes.ts — 小程序玩家端接口：微信登录与账号绑定
 *
 *   POST …/auth/wx-login       { code }  → { token, expiresAt }          wx.login 的 code 换玩家会话
 *   GET  …/player/me                     → 绑定、等级、是否管理员、账号资料
 *   POST …/player/bind/request           → { code, expiresAt, ttlMs }   申请 6 位绑定码，玩家在游戏内 /c:bind 后发送
 *   POST …/player/unbind                 → { unbound }
 *
 * 后续玩家功能（服务器状态、排行榜等）新建同样的路由工厂并在 server.ts 注册即可（OCP）。
 */
import type { AuthThrottle } from "./auth.js";
import { isAdminAccount } from "./db-client.js";
import { requirePlayer, type PlayerAuthDeps } from "./player-auth.js";
import { HttpError, readJsonBody, stringField, type Route } from "./routes.js";
import { signPlayerSession } from "./session-token.js";
import { sendJson } from "./upload.js";
import type { WechatIdentity } from "./wechat.js";

/** 玩家路由依赖 */
export interface PlayerRouteDeps extends PlayerAuthDeps {
  /** 未配置微信登录时为 null，相关接口回 503 */
  wechat: WechatIdentity | null;
  /** 登录失败限流（与管理鉴权分开计数） */
  loginThrottle: AuthThrottle;
  log: (message: string) => void;
}

/** 未启用微信登录时的统一错误 */
export const WECHAT_DISABLED = new HttpError(503, "服务器未启用微信登录");

/**
 * 创建玩家端路由。
 * 使用场景：server.ts 拼入路由表。
 */
export function createPlayerRoutes(deps: PlayerRouteDeps): Route[] {
  const enabled = () => {
    if (!deps.wechat) throw WECHAT_DISABLED;
    return deps.wechat;
  };
  return [
    {
      method: "POST",
      suffix: "/auth/wx-login",
      async handle(context) {
        const wechat = enabled();
        if (deps.loginThrottle.blocked(context.address)) throw new HttpError(429, "登录尝试过多，请稍后再试");
        const code = stringField(await readJsonBody(context.request), "code");
        let openid: string;
        try {
          openid = await wechat.openidFromCode(code);
        } catch (error) {
          deps.loginThrottle.fail(context.address);
          throw error;
        }
        deps.loginThrottle.succeed(context.address);
        sendJson(context.response, 200, signPlayerSession(deps.sessionSecret, openid));
      },
    },
    {
      method: "GET",
      suffix: "/player/me",
      async handle(context) {
        enabled();
        const { openid } = requirePlayer(deps, context);
        const account = await deps.directory.account(openid);
        sendJson(context.response, 200, {
          bound: account.bound,
          player: account.bound ? { name: account.name, xuid: account.xuid, boundAt: account.boundAt } : null,
          level: account.bound ? account.level : 0,
          isAdmin: isAdminAccount(account),
          profile: account.profile,
        });
      },
    },
    {
      method: "POST",
      suffix: "/player/bind/request",
      async handle(context) {
        enabled();
        const { openid } = requirePlayer(deps, context);
        sendJson(context.response, 200, await deps.directory.requestBindCode(openid));
      },
    },
    {
      method: "POST",
      suffix: "/player/unbind",
      async handle(context) {
        enabled();
        const { openid } = requirePlayer(deps, context);
        const unbound = await deps.directory.unbind(openid);
        if (unbound) deps.log(`微信用户解除绑定 (${context.address})`);
        sendJson(context.response, 200, { unbound });
      },
    },
  ];
}
