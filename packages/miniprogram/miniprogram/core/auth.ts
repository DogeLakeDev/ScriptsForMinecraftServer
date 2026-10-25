/**
 * auth.ts — 微信登录得到的玩家会话，以及实例档案的连接凭证
 *
 * 使用场景：
 * - 玩家端接口（core/player-api.ts）调用 ensurePlayerToken 取会话令牌；令牌由 wx.login 的 code
 *   经网关 /auth/wx-login 换得（AppSecret 只在服务器），按网关地址分别缓存在本机。
 * - 会话层连接管理通道、上传世界包时调用 resolveCredential：令牌档案用填写的访问令牌，
 *   微信身份档案用玩家会话令牌（网关现查该微信绑定的账号是否为 3 级管理员）。
 */
import { requestJson } from "./http";
import { isWechatProfile } from "./profiles";
import type { InstanceProfile } from "./types";

/** 本机缓存玩家会话的存储键：{ [endpoint]: StoredSession } */
const SESSION_KEY = "sfmc.playerSession";
/** 距离过期不足这么久时提前重新登录，避免请求途中过期 */
const RENEW_BEFORE_MS = 60 * 60 * 1000;

/** 缓存的一份玩家会话 */
interface StoredSession {
  token: string;
  expiresAt: number;
}

/** 正在进行的登录（同一网关并发调用时共用一次 wx.login） */
const inflight = new Map<string, Promise<string>>();

function readAll(): Record<string, StoredSession> {
  const value = wx.getStorageSync(SESSION_KEY) as unknown;
  return value && typeof value === "object" ? (value as Record<string, StoredSession>) : {};
}

function writeAll(sessions: Record<string, StoredSession>): void {
  wx.setStorageSync(SESSION_KEY, sessions);
}

/** wx.login 取一次性 code */
function wxLoginCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    wx.login({
      success: ({ code }) => (code ? resolve(code) : reject(new Error("微信登录失败，请重试"))),
      fail: (error) => reject(new Error(error.errMsg || "微信登录失败，请重试")),
    });
  });
}

/**
 * 取得某个网关的玩家会话令牌：本机缓存仍有效则直接返回，否则 wx.login 后向网关换取。
 * @param endpoint 规整后的网关地址
 */
export function ensurePlayerToken(endpoint: string): Promise<string> {
  const cached = readAll()[endpoint];
  if (cached && cached.token && cached.expiresAt - Date.now() > RENEW_BEFORE_MS) return Promise.resolve(cached.token);
  const running = inflight.get(endpoint);
  if (running) return running;
  const task = (async () => {
    const code = await wxLoginCode();
    const result = await requestJson<{ token: string; expiresAt: number }>({ url: `${endpoint}/auth/wx-login`, method: "POST", data: { code } });
    const sessions = readAll();
    sessions[endpoint] = { token: result.token, expiresAt: result.expiresAt };
    writeAll(sessions);
    return result.token;
  })();
  inflight.set(endpoint, task);
  const clear = () => inflight.delete(endpoint);
  task.then(clear, clear);
  return task;
}

/**
 * 丢弃某个网关的玩家会话（网关回 401 时调用，下次请求重新登录）。
 * 使用场景：player-api 的 401 重试；会话层以微信身份连接被 4401 拒绝时。
 */
export function clearPlayerToken(endpoint: string): void {
  const sessions = readAll();
  if (!(endpoint in sessions)) return;
  delete sessions[endpoint];
  writeAll(sessions);
}

/** 实例档案的连接凭证（Authorization: Bearer 的值） */
export function resolveCredential(profile: InstanceProfile): Promise<string> {
  return isWechatProfile(profile) ? ensurePlayerToken(profile.endpoint) : Promise.resolve(profile.token);
}
