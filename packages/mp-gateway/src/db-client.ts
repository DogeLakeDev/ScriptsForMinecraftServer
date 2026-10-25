/**
 * db-client.ts — 经本机 db-server 查询与修改微信绑定
 *
 * 使用场景：玩家接口（player-routes.ts）读写绑定；鉴权链（authenticators.ts）与设备授权（device-login.ts）
 * 按 openid 现查绑定玩家与 SFMC 有效等级，判断是否为管理员。
 * 以 PlayerDirectory 接口提供（DIP），上层不依赖 db-server 的 HTTP 细节，单测可替换为内存实现。
 */
import { HttpError } from "./routes.js";

/** 可以进入管理端的 SFMC 等级（Admin） */
export const ADMIN_LEVEL = 3;

/** 微信用户对应的游戏账号视图 */
export interface PlayerAccount {
  bound: boolean;
  /** 以下字段仅在 bound 为 true 时有意义 */
  xuid: string;
  name: string;
  boundAt: number;
  /** SFMC 有效等级（0 访客 / 1 成员 / 2 OP / 3 Admin） */
  level: number;
  /** 账号资料（余额、在线时长文案），结构由 db-server 决定，原样转给小程序 */
  profile: unknown;
}

/** 申请到的绑定短码 */
export interface BindCode {
  code: string;
  expiresAt: number;
  ttlMs: number;
}

/** 微信绑定目录 */
export interface PlayerDirectory {
  account(openid: string): Promise<PlayerAccount>;
  /** 已绑定时抛出 409 HttpError */
  requestBindCode(openid: string): Promise<BindCode>;
  /** 返回是否确实解除了绑定 */
  unbind(openid: string): Promise<boolean>;
}

/** 是否为管理员账号（已绑定且等级达到 Admin） */
export function isAdminAccount(account: PlayerAccount): boolean {
  return account.bound && account.level >= ADMIN_LEVEL;
}

/** db-server 的响应信封 */
type DbResponse = Record<string, unknown> & { success?: boolean; error?: string };

/**
 * 基于 db-server HTTP 的实现。
 *
 * @param baseUrl 例如 http://127.0.0.1:3001
 */
export function createDbPlayerDirectory(baseUrl: string, fetchImpl: typeof fetch = fetch): PlayerDirectory {
  const call = async (path: string, init?: RequestInit): Promise<{ status: number; data: DbResponse }> => {
    try {
      const response = await fetchImpl(`${baseUrl}${path}`, {
        ...init,
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      return { status: response.status, data: (await response.json()) as DbResponse };
    } catch {
      throw new HttpError(503, "游戏服务器数据服务暂不可用，请稍后再试");
    }
  };
  const post = (path: string, body: Record<string, unknown>) => call(path, { method: "POST", body: JSON.stringify(body) });

  return {
    async account(openid) {
      const { data } = await call(`/api/sfmc/wechat/bind/me?openid=${encodeURIComponent(openid)}`);
      if (data.success === false) throw new HttpError(502, "读取绑定信息失败");
      const binding = (data.binding ?? null) as { player_xuid?: unknown; player_name?: unknown; bound_at?: unknown } | null;
      if (!data.bound || !binding) return { bound: false, xuid: "", name: "", boundAt: 0, level: 0, profile: null };
      return {
        bound: true,
        xuid: String(binding.player_xuid ?? ""),
        name: String(binding.player_name ?? ""),
        boundAt: Number(binding.bound_at) || 0,
        level: Number(data.level) || 0,
        profile: data.profile ?? null,
      };
    },
    async requestBindCode(openid) {
      const { status, data } = await post("/api/sfmc/wechat/bind/request", { openid });
      if (data.success && typeof data.code === "string") {
        return { code: data.code, expiresAt: Number(data.expires_at) || 0, ttlMs: Number(data.ttl_ms) || 0 };
      }
      if (data.error === "already_bound") throw new HttpError(409, `已绑定游戏账号 ${String(data.player_name ?? "")}，请先解绑`);
      throw new HttpError(status >= 400 ? status : 502, "申请绑定码失败，请稍后再试");
    },
    async unbind(openid) {
      const { data } = await post("/api/sfmc/wechat/bind/unbind", { openid });
      if (data.success === false) throw new HttpError(502, "解绑失败，请稍后再试");
      return data.unbound === true;
    },
  };
}
