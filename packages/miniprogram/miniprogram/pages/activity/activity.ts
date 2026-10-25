/**
 * activity — 玩家端「我的行为记录」
 *
 * 使用场景：「我的」页已绑定游戏账号时的入口。经 GET /player/activity 读取当前微信绑定角色的
 * 行为记录（网关按绑定关系限定执行者，看不到别人的记录），按时间范围 / 分类 / 关键词筛选，
 * 触底加载更多。列表与筛选规则与管理端「行为日志」页共用 core/activity.ts。
 */
import { ActivityList, activityParams, categoryChips, defaultActivityFilters, rangeChips, type ActivityFilters, type ActivityItemView, type ActivityRangeValue } from "../../core/activity";
import { homePlayerApi } from "../../core/player-api";
import { hasHomeServer } from "../../core/server";

/** 页面状态（不放进 data） */
const view = {
  filters: defaultActivityFilters() as ActivityFilters,
  /** 记录列表；onLoad 时绑定到页面实例 */
  list: null as ActivityList | null,
};

/** 除列表条目外的页面数据（条目由 ActivityList 写入） */
function render() {
  const feed = view.list?.feed;
  const last = feed?.last ?? null;
  return {
    ranges: rangeChips(view.filters.range),
    categories: categoryChips(view.filters.category),
    loaded: Boolean(last),
    /** 首屏加载前按已绑定处理，避免闪出「未绑定」提示 */
    bound: last ? last.bound !== false : true,
    installed: last ? last.installed : true,
    loading: Boolean(feed?.loading),
    hasMore: Boolean(feed?.hasMore),
    total: feed?.total ?? 0,
    error: feed?.error ?? "",
  };
}

Page({
  data: {
    configured: hasHomeServer(),
    ...render(),
    items: [] as ActivityItemView[],
    keyword: "",
  },
  onLoad() {
    view.filters = defaultActivityFilters();
    view.list = new ActivityList(this, (params) => homePlayerApi().activity(params), false, () => this.rerender());
    void this.reload();
  },
  async onPullDownRefresh() {
    await this.reload();
    wx.stopPullDownRefresh();
  },
  onReachBottom() {
    void view.list?.more();
  },
  rerender() {
    this.setData(render());
  },

  /** 按当前筛选重新读取第一页 */
  async reload() {
    if (!this.data.configured || !view.list) return;
    await view.list.reset(activityParams(view.filters));
  },

  pickRange(event: WechatMiniprogram.TouchEvent) {
    const value = event.currentTarget.dataset.value as ActivityRangeValue;
    if (value === view.filters.range) return;
    view.filters.range = value;
    void this.reload();
  },
  pickCategory(event: WechatMiniprogram.TouchEvent) {
    const value = String(event.currentTarget.dataset.value ?? "");
    if (value === view.filters.category) return;
    view.filters.category = value;
    void this.reload();
  },
  onKeyword(event: WechatMiniprogram.Input) {
    view.filters.keyword = event.detail.value;
    this.setData({ keyword: event.detail.value });
  },
  /** 键盘「搜索」时按关键词重新查询 */
  search() {
    void this.reload();
  },
  clearKeyword() {
    view.filters.keyword = "";
    this.setData({ keyword: "" });
    void this.reload();
  },
  /** 未绑定时回到「我的」页绑定 */
  openMe() {
    wx.switchTab({ url: "/pages/me/me" });
  },
});
