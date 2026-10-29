/**
 * player-api.ts — mp-gateway 的玩家端与设备授权接口
 *
 * 使用场景：「我的」页读取绑定信息、申请绑定码、解绑、批准桌面端登录；「我的行为记录」页读取本人记录；
 * 首页读取服务器状态 / 公告；排行榜；「我的领地」「交易记录」；管理端「已授权设备」页列出与撤销设备。
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

/** 服务器运行状态（GET /server/status；joinAddress 仅已绑定且网关配置了地址时非空） */
export interface ServerStatus {
  running: boolean;
  onlineCount: number;
  /** TPS；读不到时为 null */
  tps: number | null;
  uptimeSec: number | null;
  uptimeText: string;
  version: string;
  onlineNames: string[];
  /** 加入地址；未绑定或未配置时为空串 */
  joinAddress: string;
}

/** 入服公告（GET /server/notice） */
export interface ServerNotice {
  enabled: boolean;
  title: string;
  content: string;
}

/** 排行榜一行（网关 RankRow） */
export interface RankRow {
  rank: number;
  playerId: string;
  playerName: string;
  value: number;
  display: string;
}

/** 在线时长 / 财富 / 计分项排行页 */
export interface RankPage {
  rows: RankRow[];
  myRank: RankRow | null;
  unit: string;
  available: boolean;
  fresh: boolean;
  note?: string;
  metric?: string;
  objectiveId?: string;
}

/** 公开计分项（排行榜「计分板」分段的目录） */
export interface ScoreboardObjective {
  id: string;
  displayName: string;
}

/** 公开计分项目录（GET /rank/scoreboard 无 objectiveId） */
export interface ScoreboardCatalog {
  objectives: ScoreboardObjective[];
  available: boolean;
  fresh: boolean;
  note?: string;
}

/** 在线时长排行的度量维度 */
export type OnlineRankMetric = "today" | "month" | "total";

/** 玩家领地摘要（GET /player/lands） */
export interface PlayerLand {
  id: string;
  name: string;
  status: string;
  level: number;
  chunks: number;
  nextUpkeepAt: number;
  upkeepDue: number;
  ownerName: string;
  relation: string;
}

/** 我的领地列表 */
export interface PlayerLandsResult {
  bound: boolean;
  lands: PlayerLand[];
}

/** 交易流水一行（GET /player/transactions） */
export interface PlayerTransaction {
  id: string;
  type: string;
  actorId: string;
  sourceAccountId: string;
  targetAccountId: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  reason: string;
  referenceType: string;
  referenceId: string;
  createdAt: number;
}

/** 交易记录分页 */
export interface PlayerTransactionsResult {
  bound: boolean;
  records: PlayerTransaction[];
  total: number;
  limit: number;
  offset: number;
}

/** 交易记录查询参数 */
export interface TransactionQueryParams {
  limit?: number;
  offset?: number;
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
  /** 首页：服务器运行状态与在线名单 */
  serverStatus(): Promise<ServerStatus>;
  /** 首页：入服公告 */
  serverNotice(): Promise<ServerNotice>;
  /** 在线时长排行；metric 为 today / month / total */
  onlineRank(metric: OnlineRankMetric, limit?: number): Promise<RankPage>;
  /** 财富排行 */
  wealthRank(limit?: number): Promise<RankPage>;
  /** 公开计分项目录（先选 objective 再调 scoreboardRank） */
  scoreboardCatalog(): Promise<ScoreboardCatalog>;
  /** 某一公开计分项的排行 */
  scoreboardRank(objectiveId: string, limit?: number): Promise<RankPage>;
  /** 当前绑定账号的领地列表 */
  lands(): Promise<PlayerLandsResult>;
  /** 当前绑定账号的交易流水 */
  transactions(params?: TransactionQueryParams): Promise<PlayerTransactionsResult>;
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

/** 把可选查询参数编成 GET data；去掉 undefined，避免序列化成 "undefined" */
function queryData(params: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(params)) as Record<string, unknown>;
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
    activity: (params) => call<PlayerActivityPage>("GET", "/player/activity", queryData(params as Record<string, unknown>)),
    requestBind: () => call<BindCode>("POST", "/player/bind/request", {}),
    unbind: async () => (await call<{ unbound: boolean }>("POST", "/player/unbind", {})).unbound,
    describeDevice: (ref) => call<PendingDevice>("POST", "/auth/device/describe", ref),
    approveDevice: (ref) => call<PendingDevice>("POST", "/auth/device/approve", ref),
    denyDevice: async (ref) => {
      await call<{ denied: boolean }>("POST", "/auth/device/deny", ref);
    },
    devices: async () => (await call<{ devices: DeviceGrant[] }>("GET", "/auth/devices")).devices,
    revokeDevice: async (id) => (await call<{ revoked: boolean }>("POST", "/auth/devices/revoke", { id })).revoked,
    serverStatus: () => call<ServerStatus>("GET", "/server/status"),
    serverNotice: () => call<ServerNotice>("GET", "/server/notice"),
    onlineRank: (metric, limit) => call<RankPage>("GET", "/rank/online", queryData({ metric, limit })),
    wealthRank: (limit) => call<RankPage>("GET", "/rank/wealth", queryData({ limit })),
    scoreboardCatalog: async () => {
      const page = await call<RankPage & { objectives?: ScoreboardObjective[] }>("GET", "/rank/scoreboard");
      return {
        objectives: page.objectives ?? [],
        available: page.available,
        fresh: page.fresh,
        ...(page.note ? { note: page.note } : {}),
      };
    },
    scoreboardRank: (objectiveId, limit) => call<RankPage>("GET", "/rank/scoreboard", queryData({ objectiveId, limit })),
    lands: () => call<PlayerLandsResult>("GET", "/player/lands"),
    transactions: (params = {}) => call<PlayerTransactionsResult>("GET", "/player/transactions", queryData(params as Record<string, unknown>)),
  };
}

/** 玩家端服务器（东方犬明湖）的接口；未配置地址时抛出可读错误 */
export function homePlayerApi(): PlayerApi {
  return createPlayerApi(homeEndpoint());
}
