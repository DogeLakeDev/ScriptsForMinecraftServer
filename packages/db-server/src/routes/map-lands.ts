/**
 * routes/map-lands.ts — 地图用领地几何（实时读 land2_* 表）
 *
 *   GET /api/sfmc/lands → { success, lands: MapLandView[] }
 *
 * 使用场景：mp-gateway 的 /map/lands，替代原先 bluemap 推送的快照，保证小程序地图与「我的领地」看到同一份实时数据。
 * 领地模块未安装或表不存在时返回空列表。
 */
import { listMapLands } from "../domain/player-lands.js";
import { json, type QueryFn, type RouteHandler } from "./_shared.js";

interface Deps {
  query: QueryFn;
}

/**
 * 创建地图领地路由。
 * 使用场景：index.ts 平台路由链。
 */
export function createMapLandsRoutes({ query }: Deps): RouteHandler {
  return async function handle({ path, method, res }): Promise<boolean> {
    if (path !== "/api/sfmc/lands") return false;
    if (method !== "GET") {
      json(res, { success: false, error: "method_not_allowed" }, 405);
      return true;
    }
    json(res, { success: true, lands: listMapLands(query) });
    return true;
  };
}
