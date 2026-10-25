/**
 * session-token.ts — 玩家会话凭证的签发与校验（HMAC-SHA256）
 *
 * 使用场景：
 * - 微信登录（player-routes.ts）用 code2session 拿到 openid 后签发玩家会话，小程序保存后用作 Bearer；
 * - 玩家接口与 /manage 升级（authenticators.ts）校验会话并取出 openid。
 * 凭证只证明“这是哪个微信用户”，是否为管理员每次都现查 db-server（等级可随时被调整）。
 * 格式：`sfmcp1.<base64url(JSON 载荷)>.<base64url(签名)>`，前缀便于鉴权链快速识别凭证类型。
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** 玩家会话凭证前缀 */
export const PLAYER_TOKEN_PREFIX = "sfmcp1.";
/** 玩家会话有效期：7 天，过期后小程序静默重新 wx.login */
export const PLAYER_SESSION_TTL_MS = 7 * 24 * 3600 * 1000;

/** 会话载荷 */
export interface PlayerSession {
  /** 微信 openid */
  openid: string;
  /** 过期时间（毫秒时间戳） */
  exp: number;
}

function sign(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

/** 签发玩家会话凭证 */
export function signPlayerSession(secret: string, openid: string, now = Date.now()): { token: string; expiresAt: number } {
  const exp = now + PLAYER_SESSION_TTL_MS;
  const body = Buffer.from(JSON.stringify({ openid, exp } satisfies PlayerSession)).toString("base64url");
  return { token: `${PLAYER_TOKEN_PREFIX}${body}.${sign(secret, body)}`, expiresAt: exp };
}

/**
 * 校验玩家会话凭证；签名不符、格式错误或已过期返回 null。
 * 签名用常量时间比较，避免按响应时间逐字节猜测。
 */
export function verifyPlayerSession(secret: string, token: string, now = Date.now()): PlayerSession | null {
  if (!token.startsWith(PLAYER_TOKEN_PREFIX)) return null;
  const [body, signature] = token.slice(PLAYER_TOKEN_PREFIX.length).split(".");
  if (!body || !signature) return null;
  const expected = Buffer.from(sign(secret, body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<PlayerSession>;
    if (typeof payload.openid !== "string" || !payload.openid || typeof payload.exp !== "number" || payload.exp <= now) return null;
    return { openid: payload.openid, exp: payload.exp };
  } catch {
    return null;
  }
}
