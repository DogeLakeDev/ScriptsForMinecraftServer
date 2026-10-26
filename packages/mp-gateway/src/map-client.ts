/**
 * map-client.ts — 只读访问本机 bluemap 地图服务（map-server，默认 127.0.0.1:5120）
 *
 * 使用场景：map-routes.ts 的 …/map/meta、…/map/players、…/map/regions 与瓦片转发（小程序「地图」页）。
 * 以 MapSource 接口提供（DIP），路由不依赖地图服务的 HTTP 路径与文件布局；单测可换成指向假地图服务的实现。
 * 只调用地图服务的 GET 接口，绝不转发它没有鉴权的写接口（POST /api/players、/api/regions、/api/render）。
 */
import { Readable } from "node:stream";
import { HttpError } from "./routes.js";

/** 一张瓦片的边长（像素），uNmINeD 网页导出固定为 256；与 bluemap web/src/lib/unmined-meta.ts 一致 */
export const MAP_TILE_PX = 256;

/** 一个基岩区域的边长（方块），属性文件里的 region 下标按它换算成方块坐标 */
export const MAP_REGION_BLOCKS = 512;

/**
 * 玩家位置多久没有更新就视为上报中断（毫秒）。
 * 与 bluemap 网页 App.tsx 判断“玩家位置已停止更新”的阈值一致；中断后返回空列表并标记 stale，避免显示停在原地的旧位置。
 */
export const MAP_PLAYERS_STALE_MS = 10_000;

/** 访问地图服务的超时；瓦片较大，给得比 JSON 接口宽一些 */
const JSON_TIMEOUT_MS = 5_000;
const TILE_TIMEOUT_MS = 15_000;

/** 地图服务连不上时的统一错误 */
const MAP_UNAVAILABLE = () => new HttpError(503, "地图服务暂不可用，请稍后再试");

/** 方块坐标边界（左上含，右下不含），与网页版 worldBounds 一致 */
export interface MapBounds {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

/**
 * 小程序地图页需要的元数据。
 * rendered 为 false 时还没有渲染出地图，瓦片相关字段为 null；phase / message 来自地图服务的渲染状态。
 */
export interface MapMeta {
  rendered: boolean;
  /** 渲染阶段：idle / copying / rendering / done / error 等，原样来自地图服务 */
  phase: string;
  /** 渲染阶段的中文说明 */
  message: string;
  /** 瓦片层级范围：层级 z 的原生比例为每方块 2^z 像素 */
  minZoom: number | null;
  maxZoom: number | null;
  /** uNmINeD 建议的初始层级（属性文件的 defaultZoom）；没有该字段时为 null，由客户端自行适配 */
  defaultZoom: number | null;
  /** 瓦片图片格式（png / jpg） */
  imageFormat: string | null;
  /** 瓦片边长（像素） */
  tileSize: number;
  bounds: MapBounds | null;
  centerX: number | null;
  centerZ: number | null;
  worldName: string;
  /** 瓦片所覆盖的维度；uNmINeD 目前只渲染主世界 */
  dimension: "overworld";
}

/** 一名在线玩家的位置 */
export interface MapPlayer {
  name: string;
  /** 维度 id，例如 minecraft:overworld */
  dimension: string;
  x: number;
  y: number;
  z: number;
  /** 朝向角（度），0 为南，与 SAPI getRotation().y 一致 */
  yaw: number;
}

/** 在线玩家列表；stale 为 true 表示上报已中断，此时 players 为空 */
export interface MapPlayersResult {
  players: MapPlayer[];
  updatedAt: number;
  stale: boolean;
}

/** 一块区域或领地的矩形范围 */
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

/** 一张瓦片的转发结果；status 为 404 时 body 为 null */
export interface MapTile {
  status: 200 | 404;
  contentType: string;
  /** 地图服务给的 Cache-Control，没有时为空串 */
  cacheControl: string;
  body: Readable | null;
}

/** 瓦片坐标；已由路由校验为整数，ext 只会是 png 或 jpg */
export interface MapTileKey {
  zoom: number;
  x: number;
  z: number;
  ext: "png" | "jpg";
}

/** 地图数据源 */
export interface MapSource {
  meta(): Promise<MapMeta>;
  players(): Promise<MapPlayersResult>;
  regions(): Promise<MapRegion[]>;
  tile(key: MapTileKey): Promise<MapTile>;
}

/** 从 uNmINeD 属性脚本里取一个数字字段；规则与网页版 parseUnminedProperties 一致，不执行脚本 */
function readNumber(source: string, key: string): number | null {
  const match = source.match(new RegExp(`\\b${key}\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`));
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

/** 从 uNmINeD 属性脚本里取一个字符串字段 */
function readString(source: string, key: string): string {
  const match = source.match(new RegExp(`\\b${key}\\s*:\\s*"([^"]*)"`));
  return match?.[1] ?? "";
}

/** 解析出的 uNmINeD 地图属性 */
export interface UnminedProperties {
  minZoom: number;
  maxZoom: number;
  /** 可选字段，缺失时为 null */
  defaultZoom: number | null;
  imageFormat: string;
  bounds: MapBounds;
  centerX: number;
  centerZ: number;
  worldName: string;
}

/**
 * 解析 uNmINeD 写出的 unmined.map.properties.js。
 * 使用场景：meta() 组装元数据。必需字段缺失时返回 null（视为还没有可用地图）。
 */
export function parseUnminedProperties(source: string): UnminedProperties | null {
  const fields = ["minZoom", "maxZoom", "minRegionX", "minRegionZ", "maxRegionX", "maxRegionZ", "centerX", "centerZ"] as const;
  const values: Partial<Record<(typeof fields)[number], number>> = {};
  for (const key of fields) {
    const value = readNumber(source, key);
    if (value === null) return null;
    values[key] = value;
  }
  const v = values as Record<(typeof fields)[number], number>;
  const format = readString(source, "imageFormat").toLowerCase();
  return {
    minZoom: v.minZoom,
    maxZoom: v.maxZoom,
    defaultZoom: readNumber(source, "defaultZoom"),
    imageFormat: format === "jpg" || format === "jpeg" ? "jpg" : "png",
    bounds: {
      minX: v.minRegionX * MAP_REGION_BLOCKS,
      minZ: v.minRegionZ * MAP_REGION_BLOCKS,
      maxX: (v.maxRegionX + 1) * MAP_REGION_BLOCKS,
      maxZ: (v.maxRegionZ + 1) * MAP_REGION_BLOCKS,
    },
    centerX: v.centerX,
    centerZ: v.centerZ,
    worldName: readString(source, "worldName"),
  };
}

/**
 * 地图服务里一张瓦片的相对路径：目录分组为坐标除以 10 向下取整。
 * 与 bluemap 网页 tileUrl 的规则一致（两边各有一份，后续可抽成共享包）。
 */
export function tilePath(key: MapTileKey): string {
  const dirX = Math.floor(key.x / 10);
  const dirZ = Math.floor(key.z / 10);
  return `/unmined/tiles/zoom.${key.zoom}/${dirX}/${dirZ}/tile.${key.x}.${key.z}.${key.ext}`;
}

/** 是否为有限数字 */
function isNum(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** 只保留合法的玩家条目，并去掉地图服务可能附带的其他字段 */
function sanitizePlayers(raw: unknown): MapPlayer[] {
  if (!Array.isArray(raw)) return [];
  const result: MapPlayer[] = [];
  for (const row of raw as Array<Record<string, unknown>>) {
    if (!row || typeof row.name !== "string" || typeof row.dimension !== "string") continue;
    if (!isNum(row.x) || !isNum(row.y) || !isNum(row.z)) continue;
    result.push({ name: row.name, dimension: row.dimension, x: row.x, y: row.y, z: row.z, yaw: isNum(row.yaw) ? row.yaw : 0 });
  }
  return result;
}

/** 只保留合法的区域条目 */
function sanitizeRegions(raw: unknown): MapRegion[] {
  if (!Array.isArray(raw)) return [];
  const result: MapRegion[] = [];
  for (const row of raw as Array<Record<string, unknown>>) {
    if (!row || typeof row.id !== "string" || typeof row.name !== "string" || typeof row.dimension !== "string") continue;
    if (row.kind !== "area" && row.kind !== "land") continue;
    if (!isNum(row.minX) || !isNum(row.minZ) || !isNum(row.maxX) || !isNum(row.maxZ)) continue;
    result.push({ id: row.id, kind: row.kind, name: row.name, dimension: row.dimension, minX: row.minX, minZ: row.minZ, maxX: row.maxX, maxZ: row.maxZ });
  }
  return result;
}

/**
 * 基于地图服务 HTTP 的实现。
 *
 * @param baseUrl 例如 http://127.0.0.1:5120
 * @param now 当前时间，单测可注入以验证 stale 判断
 */
export function createHttpMapSource(baseUrl: string, fetchImpl: typeof fetch = fetch, now: () => number = Date.now): MapSource {
  /** GET 一个地图服务地址；网络错误统一转成 503 */
  const get = async (pathname: string, timeoutMs: number): Promise<Response> => {
    try {
      return await fetchImpl(`${baseUrl}${pathname}`, { signal: AbortSignal.timeout(timeoutMs) });
    } catch {
      throw MAP_UNAVAILABLE();
    }
  };

  /** GET 一个 JSON 接口；非 2xx 或格式不对视为地图服务异常 */
  const getJson = async (pathname: string): Promise<Record<string, unknown>> => {
    const response = await get(pathname, JSON_TIMEOUT_MS);
    if (!response.ok) throw MAP_UNAVAILABLE();
    try {
      const data = (await response.json()) as unknown;
      if (data && typeof data === "object" && !Array.isArray(data)) return data as Record<string, unknown>;
    } catch {
      // 落到下面统一报错
    }
    throw MAP_UNAVAILABLE();
  };

  return {
    async meta() {
      const status = await getJson("/api/status");
      const propsResponse = await get("/unmined/unmined.map.properties.js", JSON_TIMEOUT_MS);
      const props = propsResponse.ok ? parseUnminedProperties(await propsResponse.text()) : null;
      if (!propsResponse.ok) await propsResponse.body?.cancel();
      return {
        rendered: props !== null,
        phase: typeof status.phase === "string" ? status.phase : "",
        message: typeof status.message === "string" ? status.message : "",
        minZoom: props?.minZoom ?? null,
        maxZoom: props?.maxZoom ?? null,
        defaultZoom: props?.defaultZoom ?? null,
        imageFormat: props?.imageFormat ?? null,
        tileSize: MAP_TILE_PX,
        bounds: props?.bounds ?? null,
        centerX: props?.centerX ?? null,
        centerZ: props?.centerZ ?? null,
        worldName: props?.worldName ?? "",
        dimension: "overworld",
      };
    },

    async players() {
      const data = await getJson("/api/players");
      const updatedAt = isNum(data.updatedAt) ? data.updatedAt : 0;
      const stale = updatedAt <= 0 || now() - updatedAt > MAP_PLAYERS_STALE_MS;
      return { players: stale ? [] : sanitizePlayers(data.players), updatedAt, stale };
    },

    async regions() {
      const data = await getJson("/api/regions");
      return sanitizeRegions(data.regions);
    },

    async tile(key) {
      const response = await get(tilePath(key), TILE_TIMEOUT_MS);
      if (response.status === 404) {
        await response.body?.cancel();
        return { status: 404, contentType: "", cacheControl: "", body: null };
      }
      if (!response.ok || !response.body) {
        await response.body?.cancel();
        throw MAP_UNAVAILABLE();
      }
      return {
        status: 200,
        // 按扩展名给类型：地图服务的 MIME 表没有 .jpg，会回 application/octet-stream
        contentType: key.ext === "jpg" ? "image/jpeg" : "image/png",
        cacheControl: response.headers.get("cache-control") ?? "",
        body: Readable.fromWeb(response.body as import("node:stream/web").ReadableStream<Uint8Array>),
      };
    },
  };
}
