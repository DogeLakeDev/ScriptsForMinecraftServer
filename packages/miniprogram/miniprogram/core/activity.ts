/**
 * activity.ts — 小程序行为记录的筛选参数、列表视图与分页加载
 *
 * 使用场景：管理端「行为日志」页（全部玩家，经 activity.query）与玩家端「我的行为记录」页
 * （仅本人，经 GET /player/activity）共用；两页只差数据来源，文案与摘要规则来自桌面端
 * lib/activity.ts（vendor/desktop-lib.js），保持三端一致（DRY）。
 */
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_LEVELS,
  ACTIVITY_RANGE_PRESETS,
  activityActor,
  activityDetail,
  activityIcon,
  activityLabel,
  activityPosition,
  activityRange,
  activityTime,
} from "../vendor/desktop-lib";
import { errorText } from "./format";
import type { ActivityQueryParams, ActivityQueryResult, ActivityRecord } from "./types";

/** 单页条数：手机上约 4 屏，触底再加载下一页 */
export const ACTIVITY_PAGE_SIZE = 30;

/** 快捷时间范围的取值（today / 24h / 7d / 30d / all） */
export type ActivityRangeValue = (typeof ACTIVITY_RANGE_PRESETS)[number]["value"];

/**
 * 页面上的筛选条件。
 * 使用场景：两页的范围胶囊、分类胶囊与搜索框；eventType / actorId 仅管理端点统计项时设置。
 */
export interface ActivityFilters {
  range: ActivityRangeValue;
  /** 事件分类前缀（如 "block."），空串表示全部分类 */
  category: string;
  keyword: string;
  /** 精确事件类型；设置时优先于 category */
  eventType?: string;
  /** 只看某个玩家（管理端） */
  actorId?: string;
}

/** 页面初始筛选：今天、全部分类 */
export function defaultActivityFilters(): ActivityFilters {
  return { range: "today", category: "", keyword: "" };
}

/**
 * 筛选条件 → 查询参数（不含分页）。时间范围在调用时按当前时间换算，
 * 由 ActivityFeed 在 reset 时冻结，加载下一页沿用同一组参数，避免新记录插入导致翻页错位。
 */
export function activityParams(filters: ActivityFilters): ActivityQueryParams {
  const params: ActivityQueryParams = { ...activityRange(filters.range) };
  if (filters.eventType) params.eventType = filters.eventType;
  else if (filters.category) params.eventTypePrefix = filters.category;
  const keyword = filters.keyword.trim();
  if (keyword) params.keyword = keyword;
  if (filters.actorId) params.actorId = filters.actorId;
  return params;
}

/** 范围胶囊的视图 */
export function rangeChips(active: ActivityRangeValue) {
  return ACTIVITY_RANGE_PRESETS.map((preset) => ({ value: preset.value, label: preset.label, active: preset.value === active }));
}

/** 分类胶囊的视图（首项为「全部」） */
export function categoryChips(active: string) {
  return [{ prefix: "", label: "全部" }, ...ACTIVITY_CATEGORIES].map((category) => ({
    value: category.prefix,
    label: category.label,
    active: category.prefix === active,
  }));
}

/** 列表中一条记录的视图（activity-list 组件渲染） */
export interface ActivityItemView {
  id: string;
  /** 图标名（对应 .i-<icon>） */
  icon: string;
  /** 图标底块颜色：普通记录为 neutral，警告 / 错误用级别语气（与桌面端一致） */
  tone: string;
  title: string;
  /** 补充说明（聊天内容、物品、伤害等），可能为空 */
  detail: string;
  /** 位置与时间 */
  meta: string;
  /** 非 info 级别时显示的徽章文案；info 为空串 */
  levelLabel: string;
  levelTone: string;
  /** 展开后的键值明细 */
  fields: { key: string; value: string }[];
  /** 附加数据的格式化 JSON；没有时为空串 */
  payload: string;
}

/**
 * 记录 → 列表视图。
 *
 * @param withActor 标题前是否带玩家名：管理端为 true；玩家端只看自己，为 false
 */
export function activityItemView(record: ActivityRecord, withActor: boolean): ActivityItemView {
  const level = ACTIVITY_LEVELS[record.level] ?? ACTIVITY_LEVELS.info;
  const label = activityLabel(record.eventType);
  const position = activityPosition(record);
  const time = activityTime(record.timestamp);
  const fields = [
    { key: "事件类型", value: record.eventType },
    ...(withActor ? [{ key: "玩家", value: activityActor(record) }] : []),
    ...(withActor && record.actorId ? [{ key: "玩家 ID", value: record.actorId }] : []),
    ...(record.targetId ? [{ key: "目标", value: record.targetId }] : []),
    ...(position ? [{ key: "位置", value: position }] : []),
    { key: "时间", value: time },
    { key: "级别", value: level.label },
  ];
  const hasPayload = Boolean(record.payload && Object.keys(record.payload).length);
  return {
    id: record.id,
    icon: activityIcon(record.eventType),
    tone: record.level === "info" ? "neutral" : level.tone,
    title: withActor ? `${activityActor(record)} ${label}` : label,
    detail: activityDetail(record),
    meta: [position, time].filter(Boolean).join(" · "),
    levelLabel: record.level === "info" ? "" : level.label,
    levelTone: level.tone,
    fields,
    payload: hasPayload ? JSON.stringify(record.payload, null, 2) : "",
  };
}

/** 一页结果；玩家端额外带 bound（是否已绑定游戏账号） */
export interface ActivityPage extends ActivityQueryResult {
  bound?: boolean;
}

/**
 * 行为记录的分页加载器：首屏 reset，触底 more，自动丢弃过期响应。
 * 使用场景：由 ActivityList 持有；两页只注入不同的 load（管理端 session.request，玩家端 PlayerApi）（DIP）。
 */
export class ActivityFeed {
  /** 已加载的记录（按时间倒序） */
  records: ActivityRecord[] = [];
  /** 满足条件的总数 */
  total = 0;
  /** 最近一次成功的结果（读取 installed / bound）；首屏加载前为 null */
  last: ActivityPage | null = null;
  loading = false;
  /** 最近一次加载失败的原因；成功后清空 */
  error = "";
  /** reset 时冻结的查询参数 */
  private params: ActivityQueryParams = {};
  /** 下一页的偏移 */
  private nextOffset = 0;
  /** 请求序号，用于丢弃筛选变化前发出的响应 */
  private seq = 0;

  constructor(private readonly load: (params: ActivityQueryParams) => Promise<ActivityPage>) {}

  /** 是否还有下一页 */
  get hasMore(): boolean {
    return this.nextOffset < this.total;
  }

  /** 按新参数从第一页重新加载 */
  reset(params: ActivityQueryParams): Promise<void> {
    this.params = params;
    this.records = [];
    this.total = 0;
    this.nextOffset = 0;
    return this.fetch(true);
  }

  /** 加载下一页；正在加载或没有更多时忽略 */
  more(): Promise<void> {
    if (this.loading || !this.hasMore) return Promise.resolve();
    return this.fetch(false);
  }

  private async fetch(first: boolean): Promise<void> {
    const seq = ++this.seq;
    this.loading = true;
    try {
      const page = await this.load({ ...this.params, limit: ACTIVITY_PAGE_SIZE, offset: this.nextOffset });
      if (seq !== this.seq) return;
      this.records = first ? page.records : [...this.records, ...page.records];
      this.total = page.total;
      // 服务端返回空页时视为到底，避免 total 与实际不一致时反复请求
      this.nextOffset = page.records.length ? page.offset + page.records.length : this.total;
      this.last = page;
      this.error = "";
    } catch (error) {
      if (seq === this.seq) this.error = errorText(error);
    } finally {
      if (seq === this.seq) this.loading = false;
    }
  }
}

/** 可以 setData 的页面实例 */
interface Host {
  setData(data: Record<string, unknown>): void;
}

/**
 * 把 ActivityFeed 的结果写进页面 data.items：reset 后整体写入，触底后只增量写入新条目，
 * 避免每次 setData 传整份列表；筛选变化后到达的旧结果不写入。
 * 使用场景：两页在 onLoad 中各创建一个，页面其余字段由 onChange 回调里的 render 刷新。
 */
export class ActivityList {
  readonly feed: ActivityFeed;
  /** 每次 reset 递增；加载完成时据此判断列表是否已被重置 */
  private generation = 0;

  /**
   * @param host 页面实例（data.items 为 ActivityItemView[]）
   * @param load 数据来源
   * @param withActor 标题是否带玩家名（见 activityItemView）
   * @param onChange 加载状态变化时调用，页面在其中重新渲染 loading / total / error 等字段
   */
  constructor(
    private readonly host: Host,
    load: (params: ActivityQueryParams) => Promise<ActivityPage>,
    private readonly withActor: boolean,
    private readonly onChange: () => void,
  ) {
    this.feed = new ActivityFeed(load);
  }

  /** 按新参数重新加载第一页；返回 false 表示加载期间又发生了 reset */
  async reset(params: ActivityQueryParams): Promise<boolean> {
    const generation = ++this.generation;
    const pending = this.feed.reset(params);
    this.host.setData({ items: [] });
    this.onChange();
    await pending;
    if (generation !== this.generation) return false;
    this.host.setData({ items: this.feed.records.map((record) => activityItemView(record, this.withActor)) });
    this.onChange();
    return true;
  }

  /** 触底加载下一页；失败时提示 */
  async more(): Promise<void> {
    const feed = this.feed;
    if (feed.loading || !feed.hasMore) return;
    const start = feed.records.length;
    const generation = this.generation;
    const pending = feed.more();
    this.onChange();
    await pending;
    if (generation !== this.generation) return;
    const patch: Record<string, unknown> = {};
    feed.records.slice(start).forEach((record, index) => {
      patch[`items[${start + index}]`] = activityItemView(record, this.withActor);
    });
    if (Object.keys(patch).length) this.host.setData(patch);
    this.onChange();
    if (feed.error) wx.showToast({ title: `加载失败：${feed.error}`, icon: "none" });
  }
}
