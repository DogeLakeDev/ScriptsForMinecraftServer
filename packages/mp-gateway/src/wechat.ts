/**
 * wechat.ts — 微信小程序登录：用 wx.login 的 code 换 openid
 *
 * 使用场景：player-routes.ts 的 POST …/auth/wx-login。AppSecret 只在网关进程内使用，不下发到小程序。
 * 以接口形式提供（DIP），单测可替换为假实现，不访问微信服务器。
 */
import { HttpError } from "./routes.js";
import type { WechatConfig } from "./config.js";

/** 微信身份解析器 */
export interface WechatIdentity {
  /** code → openid；code 无效或微信接口异常时抛出 HttpError */
  openidFromCode(code: string): Promise<string>;
}

/** code2session 接口地址 */
const CODE2SESSION_URL = "https://api.weixin.qq.com/sns/jscode2session";

/** code2session 返回结构（只取用到的字段） */
interface Code2SessionResponse {
  openid?: string;
  errcode?: number;
  errmsg?: string;
}

/**
 * 基于微信 code2session 的实现。
 * session_key 不保存、不下发：网关只需要 openid 作为身份。
 */
export function createWechatIdentity(config: WechatConfig, fetchImpl: typeof fetch = fetch): WechatIdentity {
  return {
    async openidFromCode(code) {
      if (!/^[\w-]{1,128}$/.test(code)) throw new HttpError(400, "登录凭证格式不正确");
      const url = new URL(CODE2SESSION_URL);
      url.searchParams.set("appid", config.appId);
      url.searchParams.set("secret", config.appSecret);
      url.searchParams.set("js_code", code);
      url.searchParams.set("grant_type", "authorization_code");
      let result: Code2SessionResponse;
      try {
        const response = await fetchImpl(url, { signal: AbortSignal.timeout(10_000) });
        result = (await response.json()) as Code2SessionResponse;
      } catch {
        throw new HttpError(502, "无法连接微信服务器，请稍后再试");
      }
      if (!result.openid) {
        // 40029 code 无效 / 40163 code 已被使用 / 45011 频率限制：都让小程序重新登录
        throw new HttpError(result.errcode === 45011 ? 429 : 401, `微信登录失败（${result.errcode ?? "未知错误"}）`);
      }
      return result.openid;
    },
  };
}
