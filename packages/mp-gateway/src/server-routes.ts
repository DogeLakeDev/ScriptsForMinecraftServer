/**
 * server-routes.ts — 小程序玩家端首页：服务器状态、公告、加入地址
 *
 *   GET …/server/status  → 运行状态、在线人数、TPS、运行时长、版本、在线名单；已绑定时附带 joinAddress
 *   GET …/server/notice  → 入服公告（读 configs/join_notice.json）
 *
 * 使用场景：小程序 pages/home。加入地址只对已绑定玩家返回（用户决定）；未绑定或不配置时 joinAddress 为空。
 */
import type { PlayerDirectory } from "./db-client.js";
import { readJoinNotice, type PlayerHomeSource } from "./player-home-client.js";
import { requirePlayer, type PlayerAuthDeps } from "./player-auth.js";
import { WECHAT_DISABLED } from "./player-routes.js";
import type { Route } from "./routes.js";
import { sendJson } from "./upload.js";

/** 首页路由依赖 */
export interface ServerRouteDeps extends PlayerAuthDeps {
  wechatEnabled: boolean;
  home: PlayerHomeSource;
  directory: PlayerDirectory;
  /** 实例根目录，用于读入服公告 */
  root: string;
  /**
   * 对外展示的加入地址（host:port 或 host）；空串表示不展示。
   * 使用场景：仅已绑定玩家能在 /server/status 里看到。
   */
  joinAddress: string;
}

/**
 * 创建首页路由。
 * 使用场景：server.ts 拼入路由表。
 */
export function createServerRoutes(deps: ServerRouteDeps): Route[] {
  return [
    {
      method: "GET",
      suffix: "/server/status",
      async handle(context) {
        if (!deps.wechatEnabled) throw WECHAT_DISABLED;
        const { openid } = requirePlayer(deps, context);
        const status = await deps.home.status();
        let joinAddress = "";
        if (deps.joinAddress) {
          try {
            const account = await deps.directory.account(openid);
            if (account.bound) joinAddress = deps.joinAddress;
          } catch {
            // 绑定查询失败时不暴露地址
          }
        }
        sendJson(context.response, 200, { ...status, joinAddress });
      },
    },
    {
      method: "GET",
      suffix: "/server/notice",
      async handle(context) {
        if (!deps.wechatEnabled) throw WECHAT_DISABLED;
        requirePlayer(deps, context);
        sendJson(context.response, 200, readJoinNotice(deps.root));
      },
    },
  ];
}
