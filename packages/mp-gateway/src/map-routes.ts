/**
 * map-routes.ts — 小程序玩家端「地图」：只读转发 bluemap 地图服务
 *
 *   GET …/map/meta                        → MapMeta（需要玩家会话）
 *   GET …/map/players                     → { players, updatedAt, stale }（需要玩家会话；所有在线玩家）
 *   GET …/map/regions                     → { regions }（需要玩家会话）
 *   GET …/map/tiles/{zoom}/{x}/{z}.{ext}  → 瓦片图片（公开；canvas 加载网络图片无法携带 Authorization 头）
 *
 * 使用场景：小程序 pages/map。按 player-routes.ts 约定的方式新增路由工厂并在 server.ts 注册（OCP）。
 * 未配置地图服务（实例没有 configs/bluemap.json，也没有 --map-url）时所有地图接口回 503“服务器未开启地图”。
 */
import { pipeline } from "node:stream/promises";
import type { MapSource, MapTileKey } from "./map-client.js";
import { requirePlayer, type PlayerAuthDeps } from "./player-auth.js";
import { WECHAT_DISABLED } from "./player-routes.js";
import { HttpError, type Route, type RouteContext } from "./routes.js";
import { sendJson } from "./upload.js";

/** 地图路由依赖 */
export interface MapRouteDeps extends PlayerAuthDeps {
  /** 未启用微信登录时需要会话的地图接口回 503，与其他玩家接口一致 */
  wechatEnabled: boolean;
  /** 地图数据源；null 表示服务器未开启地图 */
  map: MapSource | null;
}

/** 未开启地图时的统一错误 */
export const MAP_DISABLED = new HttpError(503, "服务器未开启地图");

/**
 * 瓦片路由的路径形状：…/map/tiles/ 后恰好三段。
 * 只做粗匹配，让形状对但内容非法的请求得到 400，而不是笼统的 404；各段在 parseTileKey 里严格校验。
 */
const TILE_ROUTE_PATTERN = /\/map\/tiles\/[^/]+\/[^/]+\/[^/]+$/;

/** 层级段：可带负号的 1–2 位整数（uNmINeD 层级通常在 -5 到 5 之间） */
const ZOOM_SEGMENT = /^-?\d{1,2}$/;
/** 瓦片 x 段：可带负号的 1–7 位整数 */
const COORD_SEGMENT = /^-?\d{1,7}$/;
/** 瓦片 z 段加扩展名：只允许 png / jpg */
const LAST_SEGMENT = /^(-?\d{1,7})\.(png|jpg)$/;

/**
 * 从路径解析并校验瓦片坐标；不合法抛 400。
 * 使用场景：瓦片路由。只接受纯整数与固定扩展名，转发路径由 tilePath 重新拼出，因此不存在路径穿越。
 */
export function parseTileKey(pathname: string): MapTileKey {
  const parts = pathname.split("/");
  const last = parts.pop() ?? "";
  const xText = parts.pop() ?? "";
  const zoomText = parts.pop() ?? "";
  const lastMatch = LAST_SEGMENT.exec(last);
  if (!ZOOM_SEGMENT.test(zoomText) || !COORD_SEGMENT.test(xText) || !lastMatch) throw new HttpError(400, "瓦片参数无效");
  return { zoom: Number(zoomText), x: Number(xText), z: Number(lastMatch[1]), ext: lastMatch[2] as MapTileKey["ext"] };
}

/**
 * 创建地图路由。
 * 使用场景：server.ts 拼入路由表。
 */
export function createMapRoutes(deps: MapRouteDeps): Route[] {
  /** 需要会话的地图接口：先校验微信登录与会话，再确认地图已开启 */
  const sessionMap = (context: RouteContext): MapSource => {
    if (!deps.wechatEnabled) throw WECHAT_DISABLED;
    requirePlayer(deps, context);
    if (!deps.map) throw MAP_DISABLED;
    return deps.map;
  };

  return [
    {
      method: "GET",
      suffix: "/map/meta",
      async handle(context) {
        sendJson(context.response, 200, await sessionMap(context).meta());
      },
    },
    {
      method: "GET",
      suffix: "/map/players",
      async handle(context) {
        sendJson(context.response, 200, await sessionMap(context).players());
      },
    },
    {
      method: "GET",
      suffix: "/map/regions",
      async handle(context) {
        sendJson(context.response, 200, { regions: await sessionMap(context).regions() });
      },
    },
    {
      method: "GET",
      suffix: "/map/tiles",
      pattern: TILE_ROUTE_PATTERN,
      async handle({ response, url }) {
        if (!deps.map) throw MAP_DISABLED;
        const tile = await deps.map.tile(parseTileKey(url.pathname));
        if (tile.status === 404 || !tile.body) {
          sendJson(response, 404, { error: "瓦片不存在" });
          return;
        }
        response.writeHead(200, {
          "content-type": tile.contentType,
          // 沿用地图服务的缓存策略（重新渲染后需要尽快生效），没有时给一个较短的缓存
          "cache-control": tile.cacheControl || "public, max-age=60",
        });
        await pipeline(tile.body, response);
      },
    },
  ];
}
