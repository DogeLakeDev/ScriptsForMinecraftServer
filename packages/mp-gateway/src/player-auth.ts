/**
 * player-auth.ts — 玩家接口与设备授权接口共用的会话校验
 *
 * 使用场景：player-routes.ts（需要登录）与 device-routes.ts（批准/撤销设备需要管理员）复用同一套取凭证与判定逻辑（DRY）。
 */
import { bearerToken } from "./auth.js";
import { isAdminAccount, type PlayerAccount, type PlayerDirectory } from "./db-client.js";
import { HttpError, type RouteContext } from "./routes.js";
import { verifyPlayerSession } from "./session-token.js";

/** 已登录的微信用户 */
export interface PlayerPrincipal {
  openid: string;
}

/** 已登录且为管理员的微信用户 */
export interface AdminPrincipal extends PlayerPrincipal {
  account: PlayerAccount;
}

/** 会话校验所需依赖 */
export interface PlayerAuthDeps {
  sessionSecret: string;
  directory: PlayerDirectory;
}

/** 要求请求带有效玩家会话；否则抛 401（小程序据此重新 wx.login） */
export function requirePlayer(deps: PlayerAuthDeps, context: RouteContext): PlayerPrincipal {
  const session = verifyPlayerSession(deps.sessionSecret, bearerToken(context.request));
  if (!session) throw new HttpError(401, "登录已过期，请重新登录");
  return { openid: session.openid };
}

/** 要求请求来自管理员（绑定玩家 SFMC 等级为 3）；否则抛 401 / 403 */
export async function requireAdmin(deps: PlayerAuthDeps, context: RouteContext): Promise<AdminPrincipal> {
  const player = requirePlayer(deps, context);
  const account = await deps.directory.account(player.openid);
  if (!isAdminAccount(account)) throw new HttpError(403, "当前微信绑定的游戏账号没有管理权限（需要 SFMC 等级 3）");
  return { ...player, account };
}
