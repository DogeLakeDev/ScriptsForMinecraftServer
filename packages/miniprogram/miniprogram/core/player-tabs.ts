/**
 * player-tabs.ts — 玩家端标签页（首页 / 地图 / 排行 / 我的）的定义与选中态同步
 *
 * 使用场景：app.json 的 tabBar 开启 custom 后，由 custom-tab-bar 用 components/glass-tab-bar 渲染悬浮玻璃标签栏；
 * 每个标签页的自定义标签栏实例是独立的，选中态要由页面在 onShow 里同步（微信官方约定），即调用 selectPlayerTab(this)。
 * 顺序与页面路径需与 app.json 的 tabBar.list 一致；图标为构建脚本按 TAB_ICONS 生成的 .i-tab-<名称>（选中为 -fill）。
 */
import type { GlassTab } from "../components/glass-tab-bar/index";

/** 玩家端标签页：GlassTab 外加 wx.switchTab 的目标路径 */
export interface PlayerTab extends GlassTab {
  url: string;
}

/** 玩家端标签页定义：顺序即标签栏顺序 */
export const PLAYER_TABS: ReadonlyArray<PlayerTab> = [
  { key: "home", text: "首页", icon: "tab-home", activeIcon: "tab-home-fill", url: "/pages/home/home" },
  { key: "map", text: "地图", icon: "tab-map", activeIcon: "tab-map-fill", url: "/pages/map/map" },
  { key: "rank", text: "排行", icon: "tab-rank", activeIcon: "tab-rank-fill", url: "/pages/rank/rank" },
  { key: "me", text: "我的", icon: "tab-me", activeIcon: "tab-me-fill", url: "/pages/me/me" },
];

/**
 * 把当前标签页同步为自定义标签栏的选中项。
 * 使用场景：四个玩家端标签页的 onShow。按页面路由查找对应的标签，不在标签页列表里时不处理。
 */
export function selectPlayerTab(page: WechatMiniprogram.Page.TrivialInstance): void {
  const tab = PLAYER_TABS.find((item) => item.url === `/${page.route}`);
  if (!tab || typeof page.getTabBar !== "function") return;
  page.getTabBar()?.setData({ current: tab.key });
}
