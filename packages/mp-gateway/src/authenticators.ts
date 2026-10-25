/**
 * authenticators.ts — 管理通道（/manage 与世界包上传）的鉴权链
 *
 * 使用场景：server.ts 对管理入口依次尝试三种凭证，任一通过即获得完全相同的管理权限（LSP）：
 *   1. 静态访问令牌（原有方式，桌面端/小程序手填）；
 *   2. 玩家会话（小程序微信登录）：现查绑定玩家等级，必须为 Admin；
 *   3. 设备凭证（桌面端扫码/短码登录）：现查授权人等级，必须仍为 Admin。
 * 新增凭证类型只需实现 Authenticator 并加入链（OCP）；server.ts 只依赖接口（DIP）。
 */
import { tokenMatches } from "./auth.js";
import { isAdminAccount, type PlayerDirectory } from "./db-client.js";
import type { DeviceLogin } from "./device-login.js";
import { verifyPlayerSession } from "./session-token.js";

/** 鉴权结果。401 = 凭证无效（计入失败限流）；403 = 凭证有效但没有管理权限 */
export type AuthOutcome = { ok: true; principal: string } | { ok: false; status: 401 | 403; message: string };

/** 一种凭证的鉴权器 */
export interface Authenticator {
  /** 识别并校验凭证；不是本类型的凭证返回 null，交给链上的下一个 */
  authenticate(token: string): Promise<AuthOutcome | null>;
}

/** 无管理权限时的统一提示 */
const NOT_ADMIN = "当前微信绑定的游戏账号没有管理权限（需要 SFMC 等级 3）";

/** 静态访问令牌 */
export function staticTokenAuthenticator(expected: string): Authenticator {
  return {
    async authenticate(token) {
      return tokenMatches(expected, token) ? { ok: true, principal: "token" } : null;
    },
  };
}

/** 小程序玩家会话：签名有效后现查是否为管理员 */
export function playerSessionAuthenticator(secret: string, directory: PlayerDirectory): Authenticator {
  return {
    async authenticate(token) {
      const session = verifyPlayerSession(secret, token);
      if (!session) return null;
      const account = await directory.account(session.openid);
      return isAdminAccount(account) ? { ok: true, principal: `wechat:${account.name}` } : { ok: false, status: 403, message: NOT_ADMIN };
    },
  };
}

/** 桌面端设备凭证：凭证有效后现查授权人是否仍为管理员 */
export function deviceAuthenticator(devices: DeviceLogin, directory: PlayerDirectory): Authenticator {
  return {
    async authenticate(token) {
      const grant = devices.verify(token);
      if (!grant) return null;
      const account = await directory.account(grant.approvedBy);
      return isAdminAccount(account)
        ? { ok: true, principal: `device:${grant.name}(${account.name})` }
        : { ok: false, status: 403, message: "授权此设备的管理员已失去管理权限，请重新登录" };
    },
  };
}

/** 依次尝试鉴权链；都不认识该凭证时返回 401 */
export async function authenticateChain(chain: readonly Authenticator[], token: string): Promise<AuthOutcome> {
  if (token) {
    for (const authenticator of chain) {
      const outcome = await authenticator.authenticate(token);
      if (outcome) return outcome;
    }
  }
  return { ok: false, status: 401, message: "访问令牌无效" };
}
