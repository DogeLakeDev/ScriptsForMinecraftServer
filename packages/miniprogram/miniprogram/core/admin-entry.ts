/**
 * admin-entry.ts — 玩家端进入管理端（admin 分包）的入口规则
 *
 * 使用场景：「我的」页始终显示「进入管理端」，点击后建立 / 选中实例档案并打开管理端首页。
 * - 微信绑定的游戏账号为 3 级管理员：自动建立“微信身份”档案（不需要输入令牌，网关每次连接现查等级）；
 * - 其他用户：按令牌方式管理本机保存的实例；还没有实例时，管理端首页的连接提示引导「添加实例」。
 */
import { ADMIN_HOME_URL } from "./admin-nav";
import { isWechatProfile, lastProfileId, listProfiles, saveProfile, setLastProfile } from "./profiles";
import { HOME_SERVER, hasHomeServer, homeEndpoint } from "./server";
import type { InstanceProfile } from "./types";

/** 找到或建立玩家端服务器的微信身份档案 */
function ensureHomeWechatProfile(): InstanceProfile {
  const endpoint = homeEndpoint();
  const existing = listProfiles().find((profile) => isWechatProfile(profile) && profile.endpoint === endpoint);
  return existing ?? saveProfile({ name: HOME_SERVER.name, endpoint, token: "", auth: "wechat" });
}

/**
 * 打开管理端首页。
 * 管理员首次进入时建立微信身份档案；还没有“上次连接的实例”时把它设为上次连接，
 * 管理端底部导航挂载后会自动连接（session.ensureRestored）。已有上次连接的实例时保持用户原来的选择。
 */
export function enterAdmin(isAdmin: boolean): void {
  if (isAdmin && hasHomeServer()) {
    const profile = ensureHomeWechatProfile();
    if (!lastProfileId() || !listProfiles().some((row) => row.id === lastProfileId())) setLastProfile(profile.id);
  }
  wx.navigateTo({ url: ADMIN_HOME_URL });
}
