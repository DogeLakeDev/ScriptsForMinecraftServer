/**
 * activity — 管理端「行为日志」
 *
 * 使用场景：「管理」页的「行为日志」入口（握手带 activity 能力时显示），对应桌面端 ActivityPage：
 * 按时间范围 / 分类 / 关键词筛选全部玩家的行为记录，触底加载更多；统计卡片展示记录数、
 * 活跃玩家与事件分布，点按分布项或玩家可进一步筛选。「玩家与权限」页点按绑定记录时带
 * actorId / name 参数进入，只看该玩家。行为日志模块未安装时提示去「模块」页安装。
 */
import {
  ActivityList,
  activityParams,
  categoryChips,
  defaultActivityFilters,
  rangeChips,
  type ActivityFilters,
  type ActivityItemView,
  type ActivityRangeValue,
} from "../../../core/activity";
import { connectionView, unwatchSession, watchSession } from "../../../core/page";
import { session, type SessionState } from "../../../core/session";
import type { ActivityStatsResult } from "../../../core/types";
import { activityLabel } from "../../../vendor/desktop-lib";

/** 统计卡片中事件分布与活跃玩家各显示的行数 */
const TOP_ROWS = 5;

/** 页面状态（不放进 data） */
const view = {
  filters: defaultActivityFilters() as ActivityFilters,
  /** 按玩家筛选时显示的名称 */
  actorLabel: "",
  /** 记录列表；onLoad 时绑定到页面实例 */
  list: null as ActivityList | null,
  stats: null as ActivityStatsResult | null,
  /** 统计请求序号，丢弃筛选变化前发出的响应 */
  statsSeq: 0,
  /** 上次渲染时是否在线；从离线恢复时重新加载 */
  online: false,
};

/** 统计卡片的视图；尚未读到统计时为 null */
function statsView(stats: ActivityStatsResult | null) {
  if (!stats) return null;
  const level = (name: string) => stats.byLevel.find((row) => row.level === name)?.count ?? 0;
  const max = stats.byType[0]?.count || 1;
  return {
    total: stats.total,
    actors: stats.actors,
    warn: level("warn"),
    error: level("error"),
    types: stats.byType.slice(0, TOP_ROWS).map((row) => ({
      value: row.eventType,
      label: activityLabel(row.eventType),
      count: row.count,
      /** 条形宽度百分比；保留最小宽度，数量很少时也能看见 */
      width: Math.max(4, Math.round((row.count / max) * 100)),
      active: view.filters.eventType === row.eventType,
    })),
    players: stats.topActors.slice(0, TOP_ROWS).map((row) => ({
      id: row.actorId,
      name: row.actorName || row.actorId,
      count: row.count,
      active: view.filters.actorId === row.actorId,
    })),
  };
}

/** 除列表条目外的页面数据（条目由 ActivityList 写入） */
function render(state: SessionState) {
  const feed = view.list?.feed;
  return {
    ...connectionView(state),
    ranges: rangeChips(view.filters.range),
    categories: categoryChips(view.filters.eventType ? "" : view.filters.category),
    typeFilter: view.filters.eventType ? activityLabel(view.filters.eventType) : "",
    actorFilter: view.filters.actorId ? view.actorLabel || view.filters.actorId : "",
    stats: statsView(view.stats),
    loaded: Boolean(feed?.last),
    installed: (feed?.last?.installed ?? true) && (view.stats?.installed ?? true),
    loading: Boolean(feed?.loading),
    hasMore: Boolean(feed?.hasMore),
    total: feed?.total ?? 0,
    error: feed?.error ?? "",
  };
}

Page({
  data: {
    ...render(session.state),
    items: [] as ActivityItemView[],
    keyword: "",
  },
  onLoad(query: Record<string, string | undefined>) {
    view.filters = defaultActivityFilters();
    view.actorLabel = "";
    view.stats = null;
    view.online = false;
    view.list = new ActivityList(this, (params) => session.request("activity.query", params), true, () => this.rerender());
    if (query.actorId) {
      // 从玩家页进入时看该玩家的全部记录，不限今天
      view.filters.actorId = decodeURIComponent(query.actorId);
      view.actorLabel = query.name ? decodeURIComponent(query.name) : "";
      view.filters.range = "all";
    }
  },
  onShow() {
    watchSession(this, ["connection"], (state) => {
      const online = state.status === "online";
      const resumed = online && !view.online;
      view.online = online;
      if (resumed) void this.reload();
      return render(state);
    });
  },
  onHide() {
    unwatchSession(this);
  },
  onUnload() {
    unwatchSession(this);
  },
  async onPullDownRefresh() {
    await this.reload();
    wx.stopPullDownRefresh();
  },
  onReachBottom() {
    void view.list?.more();
  },
  rerender() {
    this.setData(render(session.state));
  },

  /** 按当前筛选重新读取第一页与统计 */
  async reload() {
    if (session.state.status !== "online" || !view.list) return;
    const params = activityParams(view.filters);
    const statsSeq = ++view.statsSeq;
    const stats = session
      .request("activity.stats", params)
      .then((value) => {
        if (statsSeq !== view.statsSeq) return;
        view.stats = value;
        this.rerender();
      })
      .catch(() => undefined);
    await Promise.all([view.list.reset(params), stats]);
  },

  pickRange(event: WechatMiniprogram.TouchEvent) {
    const value = event.currentTarget.dataset.value as ActivityRangeValue;
    if (value === view.filters.range) return;
    view.filters.range = value;
    void this.reload();
  },
  pickCategory(event: WechatMiniprogram.TouchEvent) {
    const value = String(event.currentTarget.dataset.value ?? "");
    if (value === view.filters.category && !view.filters.eventType) return;
    view.filters.category = value;
    view.filters.eventType = undefined;
    void this.reload();
  },
  /** 点按事件分布：按该事件类型筛选，再点一次取消 */
  pickType(event: WechatMiniprogram.TouchEvent) {
    const value = String(event.currentTarget.dataset.value);
    view.filters.eventType = view.filters.eventType === value ? undefined : value;
    void this.reload();
  },
  /** 点按活跃玩家：只看该玩家，再点一次取消 */
  pickActor(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id);
    const same = view.filters.actorId === id;
    view.filters.actorId = same ? undefined : id;
    view.actorLabel = same ? "" : String(event.currentTarget.dataset.name ?? "");
    void this.reload();
  },
  clearType() {
    view.filters.eventType = undefined;
    void this.reload();
  },
  clearActor() {
    view.filters.actorId = undefined;
    view.actorLabel = "";
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
  openModules() {
    wx.navigateTo({ url: "/admin/pages/modules/modules" });
  },
});
