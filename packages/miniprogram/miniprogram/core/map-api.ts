/**
 * map-api.ts — mp-gateway 的地图接口（只读转发服务器上的 bluemap 地图服务）
 *
 * 使用场景：玩家端「地图」页读取地图元数据、在线玩家位置、区域与领地，并拼出瓦片图片地址。
 * 页面只依赖 MapApi 接口，不接触 URL 与令牌细节（DIP）；带会话的请求复用 player-api.ts 的 createSessionCall（401 自动续期）。
 * 瓦片地址不需要会话：canvas 加载网络图片无法携带 Authorization 头，网关对瓦片公开只读。
 */
import { createSessionCall } from "./player-api";
import { homeEndpoint } from "./server";

/** 方块坐标边界（左上含，右下不含） */
export interface MapBounds {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

/**
 * 地图元数据（GET /map/meta）。
 * rendered 为 false 表示服务器还没渲染出地图，此时瓦片相关字段为 null。
 */
export interface MapMeta {
  rendered: boolean;
  /** 渲染阶段：idle / copying / rendering / done / error 等 */
  phase: string;
  /** 渲染阶段的中文说明 */
  message: string;
  /** 瓦片层级范围：层级 z 的原生比例为每方块 2^z 像素 */
  minZoom: number | null;
  maxZoom: number | null;
  /** uNmINeD 建议的初始层级；没有时为 null */
  defaultZoom: number | null;
  imageFormat: string | null;
  /** 瓦片边长（像素），uNmINeD 固定为 256 */
  tileSize: number;
  bounds: MapBounds | null;
  centerX: number | null;
  centerZ: number | null;
  worldName: string;
  /** 瓦片覆盖的维度；目前只渲染主世界 */
  dimension: "overworld";
}

/** 已渲染地图的元数据（rendered 为 true 时各字段一定存在） */
export interface RenderedMapMeta {
  minZoom: number;
  maxZoom: number;
  /** uNmINeD 建议的初始层级；没有时为 null（初始视图改为整图适配） */
  defaultZoom: number | null;
  imageFormat: string;
  tileSize: number;
  bounds: MapBounds;
  centerX: number;
  centerZ: number;
}

/** 一名在线玩家的位置 */
export interface MapPlayer {
  name: string;
  /** 维度 id，例如 minecraft:overworld */
  dimension: string;
  x: number;
  y: number;
  z: number;
  /** 朝向角（度），0 为南（+Z），90 为西（-X），与 SAPI getRotation().y 一致 */
  yaw: number;
}

/** 在线玩家列表（GET /map/players）；stale 为 true 表示游戏服务器的位置上报已中断 */
export interface MapPlayers {
  players: MapPlayer[];
  updatedAt: number;
  stale: boolean;
}

/** area 模块的区域（area），或旧版 area 里带 land_core 的领地（land）的矩形范围 */
export interface MapRegion {
  id: string;
  kind: "area" | "land";
  name: string;
  dimension: string;
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

/** 领地里的一个子区域（水平投影，坐标含两端方块） */
export interface MapLandArea {
  id: string;
  name: string;
  dimensionId: string;
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

/**
 * land 模块的一块领地（GET /map/lands）。
 * 使用场景：地图页按区块画领地、点击时显示领主与所在子区域。与 bluemap 网页的 MapLand 同形，网关已去掉领主玩家 id。
 */
export interface MapLand {
  id: string;
  name: string;
  ownerName: string;
  /** active / delinquent / frozen；未知值原样显示 */
  status: string;
  level: number;
  /** 按维度分组的已占领区块，chunks 为 [chunkX, chunkZ] */
  claims: Array<{ dimensionId: string; chunks: Array<[number, number]> }>;
  areas: MapLandArea[];
}

/** 地图接口 */
export interface MapApi {
  readonly endpoint: string;
  meta(): Promise<MapMeta>;
  players(): Promise<MapPlayers>;
  regions(): Promise<MapRegion[]>;
  /** land 模块的领地；旧版网关没有该接口时请求失败，由调用方按没有领地处理 */
  lands(): Promise<MapLand[]>;
  /** 一张瓦片的完整地址（公开，不带会话） */
  tileUrl(zoom: number, tileX: number, tileZ: number, imageFormat: string): string;
}

/**
 * 把元数据收窄为已渲染地图；未渲染或字段不全时返回 null。
 * 使用场景：地图页决定显示地图还是“还没渲染”状态。
 */
export function renderedMeta(meta: MapMeta): RenderedMapMeta | null {
  if (!meta.rendered || meta.minZoom === null || meta.maxZoom === null || !meta.bounds || meta.centerX === null || meta.centerZ === null) return null;
  return {
    minZoom: meta.minZoom,
    maxZoom: meta.maxZoom,
    // 旧版网关没有该字段时按 null 处理
    defaultZoom: typeof meta.defaultZoom === "number" ? meta.defaultZoom : null,
    imageFormat: meta.imageFormat || "png",
    tileSize: meta.tileSize,
    bounds: meta.bounds,
    centerX: meta.centerX,
    centerZ: meta.centerZ,
  };
}

/**
 * 创建某个网关的地图接口。
 * 使用场景：玩家端用 homeMapApi()。
 */
export function createMapApi(endpoint: string): MapApi {
  const call = createSessionCall(endpoint);
  return {
    endpoint,
    meta: () => call<MapMeta>("GET", "/map/meta"),
    players: () => call<MapPlayers>("GET", "/map/players"),
    regions: async () => (await call<{ regions: MapRegion[] }>("GET", "/map/regions")).regions,
    lands: async () => (await call<{ lands: MapLand[] }>("GET", "/map/lands")).lands,
    tileUrl: (zoom, tileX, tileZ, imageFormat) => `${endpoint}/map/tiles/${zoom}/${tileX}/${tileZ}.${imageFormat === "jpg" ? "jpg" : "png"}`,
  };
}

/** 玩家端服务器（东方犬明湖）的地图接口；未配置地址时抛出可读错误 */
export function homeMapApi(): MapApi {
  return createMapApi(homeEndpoint());
}
