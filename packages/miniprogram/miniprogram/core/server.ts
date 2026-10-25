/**
 * server.ts — 玩家端对接的服务器（东方犬明湖）
 *
 * 使用场景：玩家端（首页 / 排行 / 我的）的微信登录、账号绑定与玩家接口都发往这台服务器的 mp-gateway；
 * 管理员从「我的」进入管理端时，也以这里的地址建立“微信身份”实例档案。
 * 地址须同时加入小程序后台的 request 与 socket 合法域名。
 */
import { normalizeEndpoint } from "./profiles";

/** 玩家端服务器定义 */
export const HOME_SERVER = {
  /** 展示名称，也用作管理端里该实例档案的名称 */
  name: "东方犬明湖",
  /**
   * mp-gateway 的基础地址（与管理端实例档案的“网关地址”同一格式，例如 https://mc.example.com/sfmc）。
   * 部署时填写；留空时玩家端各页面提示“尚未配置服务器地址”，不会发出任何请求。
   */
  endpoint: "https://sapi.dogelake.cn/sfmc",
};

/**
 * 规整后的玩家端服务器地址；未配置时抛出可读错误。
 * 使用场景：core/auth.ts 登录、core/player-api.ts 默认实例、「进入管理端」建立档案。
 */
export function homeEndpoint(): string {
  if (!HOME_SERVER.endpoint.trim()) throw new Error("尚未配置服务器地址（core/server.ts 的 HOME_SERVER.endpoint）");
  return normalizeEndpoint(HOME_SERVER.endpoint);
}

/** 是否已配置玩家端服务器地址（页面据此决定显示功能还是配置提示） */
export function hasHomeServer(): boolean {
  return Boolean(HOME_SERVER.endpoint.trim());
}
