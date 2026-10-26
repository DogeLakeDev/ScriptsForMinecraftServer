/**
 * player-api.ts — mp-gateway 的玩家端与设备授权接口
 *
 * 使用场景：「我的」页读取绑定信息、申请绑定码、解绑、批准桌面端登录；「我的行为记录」页读取本人记录；
 * 管理端「已授权设备」页列出与撤销设备。
 * 页面只依赖 PlayerApi 接口，不接触 URL 与令牌细节（DIP）。会话令牌失效（401）时自动重新登录并重试一次。
 */
import { clearPlayerToken, ensurePlayerToken } from "./auth";
import { requestJson, type HttpRequestError } from "./http";
import { homeEndpoint } from "./server";
import type { ActivityQueryParams, ActivityQueryResult } from "./types";

/** 账号资料（db-server 的 QQ/微信「我的账号」同一份数据） */
export interface PlayerProfile {
  /** 经济单位名称 */
  unit: string;
  /** 余额；读取失败时为 null */
  balance: number | null;
  today_text: string;
  month_text: string;
  total_text: string;
}

/** 当前微信用户的账号视图（GET /player/me） */
export interface PlayerMe {
  bound: boolean;
  player: { name: string; xuid: string; boundAt: number } | null;
  /** SFMC 有效等级（0 访客 / 1 成员 / 2 OP / 3 Admin） */
  level: number;
  isAdmin: boolean;
  profile: PlayerProfile | null;
}

/** 申请到的绑定码 */
export interface BindCode {
  code: string;
  expiresAt: number;
  ttlMs: number;
}

/** 定位一个桌面端登录请求：扫码得到 deviceId，手动输入 6 位 userCode */
export type DeviceRef = { deviceId: string } | { userCode: string };

/** 等待授权的桌面端登录请求 */
export interface PendingDevice {
  deviceId: string;
  name: string;
  expiresAt: number;
}

/** 已授权的桌面设备 */
export interface DeviceGrant {
  id: string;
  name: string;
  approvedByName: string;
  createdAt: number;
  expiresAt: number;
  /** 最近一次连接时间，0 表示尚未使用 */
  lastUsedAt: number;
}

/** 当前微信绑定账号的一页行为记录（GET /player/activity）；bound 为 false 表示尚未绑定 */
export interface PlayerActivityPage extends ActivityQueryResult {
  bound: boolean;
}

/** 玩家端接口 */
export interface PlayerApi {
  readonly endpoint: string;
  me(): Promise<PlayerMe>;
  /** 读取本人的行为记录；执行者由网关按绑定关系限定，传 actorId 无效 */
  activity(params: ActivityQueryParams): Promise<PlayerActivityPage>;
  requestBind(): Promise<BindCode>;
  unbind(): Promise<boolean>;
  describeDevice(ref: DeviceRef): Promise<PendingDevice>;
  approveDevice(ref: DeviceRef): Promise<PendingDevice>;
  denyDevice(ref: DeviceRef): Promise<void>;
  devices(): Promise<DeviceGrant[]>;
  revokeDevice(id: string): Promise<boolean>;
}

/** 携带玩家会话调用网关接口的函数 */
export type SessionCall = <T>(method: "GET" | "POST", path: string, data?: Record<string, unknown>) => Promise<T>;

/**
 * 创建携带玩家会话的网关调用：会话令牌失效（401）时清掉令牌、重新登录并重试一次。
 * 使用场景：本文件的玩家端接口与 core/map-api.ts 的地图接口共用（DRY）。
 */
export function createSessionCall(endpoint: string): SessionCall {
  return async <T>(method: "GET" | "POST", path: string, data?: Record<string, unknown>): Promise<T> => {
    const send = async () => requestJson<T>({ url: `${endpoint}${path}`, method, data, token: await ensurePlayerToken(endpoint) });
    try {
      return await send();
    } catch (error) {
      if ((error as HttpRequestError).status !== 401) throw error;
      clearPlayerToken(endpoint);
      return send();
    }
  };
}

/**
 * 创建某个网关的玩家端接口。
 * 使用场景：玩家端用 homePlayerApi()；管理端设备页按当前实例档案的地址创建。
 */
export function createPlayerApi(endpoint: string): PlayerApi {
  const call = createSessionCall(endpoint);
  return {
    endpoint,
    me: () => call<PlayerMe>("GET", "/player/me"),
    // GET 的 data 由 wx.request 拼成查询串；去掉未设置的字段，免得序列化成 "undefined"
    activity: (params) => call<PlayerActivityPage>("GET", "/player/activity", JSON.parse(JSON.stringify(params)) as Record<string, unknown>),
    requestBind: () => call<BindCode>("POST", "/player/bind/request", {}),
    unbind: async () => (await call<{ unbound: boolean }>("POST", "/player/unbind", {})).unbound,
    describeDevice: (ref) => call<PendingDevice>("POST", "/auth/device/describe", ref),
    approveDevice: (ref) => call<PendingDevice>("POST", "/auth/device/approve", ref),
    denyDevice: async (ref) => {
      await call<{ denied: boolean }>("POST", "/auth/device/deny", ref);
    },
    devices: async () => (await call<{ devices: DeviceGrant[] }>("GET", "/auth/devices")).devices,
    revokeDevice: async (id) => (await call<{ revoked: boolean }>("POST", "/auth/devices/revoke", { id })).revoked,
  };
}

/** 玩家端服务器（东方犬明湖）的接口；未配置地址时抛出可读错误 */
export function homePlayerApi(): PlayerApi {
  return createPlayerApi(homeEndpoint());
}
