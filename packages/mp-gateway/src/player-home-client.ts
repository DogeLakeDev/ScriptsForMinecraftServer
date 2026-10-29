/**
 * player-home-client.ts — 经本机 db-server 读取玩家端首页 / 排行 / 领地 / 流水
 *
 * 使用场景：server-routes、rank-routes、player 资产路由与 map-routes 的领地数据。
 * 以接口提供（DIP），单测可替换；网关不解析 SQL、不碰模块表布局。
 */
import fs from "node:fs";
import path from "node:path";
import { HttpError } from "./routes.js";

/** db-server 连不上时的统一错误 */
const DB_UNAVAILABLE = () => new HttpError(503, "游戏服务器数据服务暂不可用，请稍后再试");

/** GET JSON；非 2xx 或 success:false 时抛错 */
async function getJson(
  baseUrl: string,
  pathWithQuery: string,
  fetchImpl: typeof fetch
): Promise<{ status: number; data: Record<string, unknown> }> {
  try {
    const response = await fetchImpl(`${baseUrl}${pathWithQuery}`, { signal: AbortSignal.timeout(10_000) });
    const data = (await response.json()) as Record<string, unknown>;
    return { status: response.status, data };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw DB_UNAVAILABLE();
  }
}

function requireSuccess(status: number, data: Record<string, unknown>, fallback: string): void {
  if (data.success === true) return;
  throw new HttpError(status >= 400 && status < 500 ? status : 502, typeof data.message === "string" ? data.message : fallback);
}

/** 服务器运行状态（首页） */
export interface ServerStatusView {
  running: boolean;
  onlineCount: number;
  /** TPS；读不到时为 null */
  tps: number | null;
  /** BDS 已运行秒数；未知时为 null */
  uptimeSec: number | null;
  uptimeText: string;
  /** 游戏版本；未知时为空串 */
  version: string;
  /** 在线玩家名（最多取前若干名供首页头像条） */
  onlineNames: string[];
}

/** 入服公告 */
export interface ServerNoticeView {
  enabled: boolean;
  title: string;
  content: string;
}

/** 排行榜一行 */
export interface RankRowView {
  rank: number;
  playerId: string;
  playerName: string;
  value: number;
  display: string;
}

/** 排行页 */
export interface RankPageView {
  rows: RankRowView[];
  myRank: RankRowView | null;
  unit: string;
  available: boolean;
  fresh: boolean;
  note?: string;
  metric?: string;
  objectiveId?: string;
  objectives?: Array<{ id: string; displayName: string }>;
}

/** 玩家领地摘要 */
export interface PlayerLandView {
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

/** 流水一行 */
export interface PlayerTxView {
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

/** 地图领地（与 map-client MapLand 同形） */
export interface MapLandView {
  id: string;
  name: string;
  ownerName: string;
  status: string;
  level: number;
  claims: Array<{ dimensionId: string; chunks: Array<[number, number]> }>;
  areas: Array<{ id: string; name: string; dimensionId: string; minX: number; minZ: number; maxX: number; maxZ: number }>;
}

/** 玩家端只读数据源 */
export interface PlayerHomeSource {
  status(): Promise<ServerStatusView>;
  onlineRank(metric: string, limit: number, openid: string): Promise<RankPageView>;
  wealthRank(limit: number, openid: string): Promise<RankPageView>;
  scoreboardCatalog(openid: string): Promise<RankPageView>;
  scoreboardRank(objectiveId: string, limit: number, openid: string): Promise<RankPageView>;
  lands(openid: string): Promise<{ bound: boolean; lands: PlayerLandView[] }>;
  transactions(openid: string, limit: number, offset: number): Promise<{ bound: boolean; records: PlayerTxView[]; total: number; limit: number; offset: number }>;
  mapLands(): Promise<MapLandView[]>;
}

function asRankRow(raw: unknown): RankRowView | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  return {
    rank: Number(row.rank) || 0,
    playerId: String(row.playerId ?? ""),
    playerName: String(row.playerName ?? ""),
    value: Number(row.value) || 0,
    display: String(row.display ?? ""),
  };
}

function asRankPage(data: Record<string, unknown>): RankPageView {
  const rows = Array.isArray(data.rows) ? data.rows.map(asRankRow).filter((row): row is RankRowView => row !== null) : [];
  const myRank = asRankRow(data.myRank);
  const page: RankPageView = {
    rows,
    myRank,
    unit: String(data.unit ?? ""),
    available: data.available === true,
    fresh: data.fresh === true,
  };
  if (typeof data.note === "string") page.note = data.note;
  if (typeof data.metric === "string") page.metric = data.metric;
  if (typeof data.objectiveId === "string") page.objectiveId = data.objectiveId;
  if (Array.isArray(data.objectives)) {
    page.objectives = data.objectives
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .map((item) => ({ id: String(item.id ?? ""), displayName: String(item.displayName ?? item.id ?? "") }));
  }
  return page;
}

function asLand(raw: unknown): PlayerLandView | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    status: String(row.status ?? ""),
    level: Number(row.level) || 0,
    chunks: Number(row.chunks) || 0,
    nextUpkeepAt: Number(row.nextUpkeepAt) || 0,
    upkeepDue: Number(row.upkeepDue) || 0,
    ownerName: String(row.ownerName ?? ""),
    relation: String(row.relation ?? ""),
  };
}

function asTx(raw: unknown): PlayerTxView | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  return {
    id: String(row.id ?? ""),
    type: String(row.type ?? ""),
    actorId: String(row.actorId ?? ""),
    sourceAccountId: String(row.sourceAccountId ?? ""),
    targetAccountId: String(row.targetAccountId ?? ""),
    amount: Number(row.amount) || 0,
    balanceBefore: Number(row.balanceBefore) || 0,
    balanceAfter: Number(row.balanceAfter) || 0,
    reason: String(row.reason ?? ""),
    referenceType: String(row.referenceType ?? ""),
    referenceId: String(row.referenceId ?? ""),
    createdAt: Number(row.createdAt) || 0,
  };
}

function asMapLand(raw: unknown): MapLandView | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const claims: MapLandView["claims"] = [];
  for (const group of Array.isArray(row.claims) ? row.claims : []) {
    if (!group || typeof group !== "object") continue;
    const g = group as Record<string, unknown>;
    if (typeof g.dimensionId !== "string" || !Array.isArray(g.chunks)) continue;
    claims.push({
      dimensionId: g.dimensionId,
      chunks: g.chunks.filter((c): c is [number, number] => Array.isArray(c) && c.length === 2 && Number.isFinite(c[0]) && Number.isFinite(c[1])).map((c) => [Number(c[0]), Number(c[1])]),
    });
  }
  const areas: MapLandView["areas"] = [];
  for (const area of Array.isArray(row.areas) ? row.areas : []) {
    if (!area || typeof area !== "object") continue;
    const a = area as Record<string, unknown>;
    if (typeof a.id !== "string" || typeof a.name !== "string" || typeof a.dimensionId !== "string") continue;
    areas.push({
      id: a.id,
      name: a.name,
      dimensionId: a.dimensionId,
      minX: Number(a.minX) || 0,
      minZ: Number(a.minZ) || 0,
      maxX: Number(a.maxX) || 0,
      maxZ: Number(a.maxZ) || 0,
    });
  }
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    ownerName: String(row.ownerName ?? ""),
    status: String(row.status ?? ""),
    level: Number(row.level) || 0,
    claims,
    areas,
  };
}

/**
 * 基于 db-server HTTP 的实现。
 * @param baseUrl 例如 http://127.0.0.1:3001
 */
export function createDbPlayerHomeSource(baseUrl: string, fetchImpl: typeof fetch = fetch): PlayerHomeSource {
  return {
    async status() {
      // 并行拉状态与指标：状态含在线名单与 BDS 进程，指标含 TPS
      const [statusRes, metricsRes] = await Promise.all([
        getJson(baseUrl, "/api/sfmc/status", fetchImpl),
        getJson(baseUrl, "/api/sfmc/metrics", fetchImpl),
      ]);
      const status = statusRes.data;
      const metrics = metricsRes.data;
      const processes = (status.processes ?? null) as Record<string, unknown> | null;
      const bds = (processes?.bds ?? null) as Record<string, unknown> | null;
      const online = Array.isArray(status.online) ? status.online : [];
      const onlineNames = online
        .map((item) => (item && typeof item === "object" ? String((item as { name?: unknown }).name ?? "") : ""))
        .filter(Boolean);
      const current = (metrics.current ?? null) as Record<string, unknown> | null;
      const running = bds?.state === "running" || bds?.running === true;
      return {
        running,
        onlineCount: onlineNames.length || (Number(current?.onlineCount) || 0),
        tps: typeof current?.tps === "number" ? current.tps : null,
        uptimeSec: typeof bds?.uptimeSec === "number" ? bds.uptimeSec : null,
        uptimeText: typeof bds?.uptimeText === "string" ? bds.uptimeText : "",
        version: typeof bds?.version === "string" ? bds.version : "",
        onlineNames,
      };
    },

    async onlineRank(metric, limit, openid) {
      const search = new URLSearchParams({ metric, limit: String(limit) });
      if (openid) search.set("openid", openid);
      const { status, data } = await getJson(baseUrl, `/api/sfmc/rank/online?${search}`, fetchImpl);
      requireSuccess(status, data, "读取在线时长排行失败");
      return asRankPage(data);
    },

    async wealthRank(limit, openid) {
      const search = new URLSearchParams({ limit: String(limit) });
      if (openid) search.set("openid", openid);
      const { status, data } = await getJson(baseUrl, `/api/sfmc/rank/wealth?${search}`, fetchImpl);
      requireSuccess(status, data, "读取财富排行失败");
      return asRankPage(data);
    },

    async scoreboardCatalog(openid) {
      const search = new URLSearchParams();
      if (openid) search.set("openid", openid);
      const q = search.toString();
      const { status, data } = await getJson(baseUrl, `/api/sfmc/rank/scoreboard${q ? `?${q}` : ""}`, fetchImpl);
      requireSuccess(status, data, "读取公开计分项失败");
      return asRankPage(data);
    },

    async scoreboardRank(objectiveId, limit, openid) {
      const search = new URLSearchParams({ objectiveId, limit: String(limit) });
      if (openid) search.set("openid", openid);
      const { status, data } = await getJson(baseUrl, `/api/sfmc/rank/scoreboard?${search}`, fetchImpl);
      requireSuccess(status, data, "读取计分项排行失败");
      return asRankPage(data);
    },

    async lands(openid) {
      const { status, data } = await getJson(baseUrl, `/api/sfmc/wechat/lands?openid=${encodeURIComponent(openid)}`, fetchImpl);
      requireSuccess(status, data, "读取领地失败");
      return {
        bound: data.bound === true,
        lands: Array.isArray(data.lands) ? data.lands.map(asLand).filter((row): row is PlayerLandView => row !== null) : [],
      };
    },

    async transactions(openid, limit, offset) {
      const search = new URLSearchParams({ openid, limit: String(limit), offset: String(offset) });
      const { status, data } = await getJson(baseUrl, `/api/sfmc/wechat/transactions?${search}`, fetchImpl);
      requireSuccess(status, data, "读取交易记录失败");
      return {
        bound: data.bound === true,
        records: Array.isArray(data.records) ? data.records.map(asTx).filter((row): row is PlayerTxView => row !== null) : [],
        total: Number(data.total) || 0,
        limit: Number(data.limit) || limit,
        offset: Number(data.offset) || offset,
      };
    },

    async mapLands() {
      const { status, data } = await getJson(baseUrl, "/api/sfmc/lands", fetchImpl);
      requireSuccess(status, data, "读取地图领地失败");
      return Array.isArray(data.lands) ? data.lands.map(asMapLand).filter((row): row is MapLandView => row !== null) : [];
    },
  };
}

/**
 * 读取入服公告配置文件。
 * 使用场景：GET /server/notice。文件不存在或格式不对时视为未启用。
 */
export function readJoinNotice(root: string, readFile: (filePath: string) => string = (filePath) => fs.readFileSync(filePath, "utf8")): ServerNoticeView {
  const filePath = path.join(root, "configs", "join_notice.json");
  try {
    const raw = JSON.parse(readFile(filePath)) as Record<string, unknown>;
    const content = Array.isArray(raw.content)
      ? raw.content.map((line) => String(line)).join("\n")
      : typeof raw.content === "string"
        ? raw.content
        : "";
    return {
      enabled: raw.enabled !== false && Boolean(String(raw.title ?? "").trim() || content.trim()),
      title: String(raw.title ?? ""),
      content,
    };
  } catch {
    return { enabled: false, title: "", content: "" };
  }
}
