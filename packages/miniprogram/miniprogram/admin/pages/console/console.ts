/**
 * console — 日志控制台
 *
 * 使用场景：查看本次连接缓存的历史与实时日志（最多 LOG_KEEP 条），按来源 / 级别 / 关键字筛选；
 * 平台支持 logs-range 时可选一天从服务端重读；底部向 BDS 等服务发送命令（services.send）。
 * 清屏只隐藏当前视图，不删除文件。手机端只渲染最近 RENDER_LIMIT 条匹配项，控制 setData 体积。
 */
import { guard } from "../../../core/actions";
import { clock, dayKey, errorText, hashHue } from "../../../core/format";
import { connectionView, consoleFocus, unwatchSession, watchSession } from "../../../core/page";
import { session, type SessionState } from "../../../core/session";
import type { LogEntryWire } from "../../../core/types";
import { LOG_TAIL_MAX } from "../../../vendor/management";

/** 单次渲染的最大日志行数 */
const RENDER_LIMIT = 300;
/** 最近一次日志滚动位置，用来区分滑到右边缘和滑到底部 */
const logScroll = { top: 0, height: 0 };
/** 可接收命令的服务（与桌面端 COMMAND_TARGETS 一致） */
const COMMAND_TARGETS = ["bds", "db", "qq", "llbot"];
/** 级别 → 文案（顺序与桌面端一致） */
const LEVELS: { value: LogEntryWire["level"]; label: string; tone: string }[] = [
  { value: "error", label: "错误", tone: "danger" },
  { value: "warn", label: "警告", tone: "warning" },
  { value: "info", label: "信息", tone: "info" },
  { value: "success", label: "成功", tone: "success" },
  { value: "debug", label: "调试", tone: "neutral" },
];

/** 页面筛选状态（不放进 data，render 时据此计算） */
const view = {
  query: "",
  sources: new Set<string>(),
  levels: new Set<string>(),
  clearedAt: "",
  /** 选中的日期（YYYY-MM-DD），空为实时 */
  day: "",
  /** 按日期从服务端读回的日志 */
  ranged: null as LogEntryWire[] | null,
  truncated: false,
  /** 需要定位的日志时间 */
  focus: "",
  /** 发送过的命令（最近 50 条） */
  history: [] as string[],
};

/** 日志在本地日期范围内 */
function inDay(log: LogEntryWire, day: string): boolean {
  return dayKey(new Date(log.time)) === day;
}

/** 合并按日期读回的历史与连接期间新到的同日日志（同桌面端 mergeRanged） */
function pool(state: SessionState): LogEntryWire[] {
  if (!view.day) return state.logs;
  if (!view.ranged) return state.logs.filter((log) => inDay(log, view.day));
  const key = (log: LogEntryWire) => `${log.time}\0${log.source}\0${log.level}\0${log.text}`;
  const seen = new Set(view.ranged.map(key));
  const extra = state.logs.filter((log) => inDay(log, view.day) && !seen.has(key(log)));
  return extra.length ? [...view.ranged, ...extra].sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0)) : view.ranged;
}

function render(state: SessionState) {
  const visible = pool(state).filter((log) => !view.clearedAt || log.time > view.clearedAt);
  const sourceCounts = new Map<string, number>();
  const levelCounts = new Map<string, number>();
  for (const log of visible) {
    sourceCounts.set(log.source, (sourceCounts.get(log.source) ?? 0) + 1);
    levelCounts.set(log.level, (levelCounts.get(log.level) ?? 0) + 1);
  }
  const needle = view.query.trim().toLowerCase();
  const filtered = visible.filter(
    (log) =>
      (!view.sources.size || view.sources.has(log.source)) &&
      (!view.levels.size || view.levels.has(log.level)) &&
      (!needle || log.text.toLowerCase().includes(needle)),
  );
  // 定位：确保目标行落在渲染窗口内
  let focusIndex = -1;
  if (view.focus) for (let index = filtered.length - 1; index >= 0; index--) if (filtered[index]!.time === view.focus) { focusIndex = index; break; }
  const start = focusIndex >= 0 ? Math.max(0, Math.min(focusIndex - 40, filtered.length - RENDER_LIMIT)) : Math.max(0, filtered.length - RENDER_LIMIT);
  const today = dayKey(new Date());
  const rows = filtered.slice(start, start + RENDER_LIMIT);
  const withDate = Boolean(view.day) || rows.some((log) => dayKey(new Date(log.time)) !== today);
  return {
    ...connectionView(state),
    canRange: session.can("logs-range"),
    day: view.day,
    truncated: view.truncated,
    query: view.query,
    total: visible.length,
    matched: filtered.length,
    hiddenCount: filtered.length - rows.length,
    sources: [...sourceCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count, active: view.sources.has(name), hue: hashHue(name) })),
    levels: LEVELS.filter((level) => levelCounts.has(level.value)).map((level) => ({
      ...level,
      count: levelCounts.get(level.value) ?? 0,
      active: view.levels.has(level.value),
    })),
    filtering: Boolean(view.sources.size || view.levels.size || needle),
    rows: rows.map((log, index) => ({
      id: `r${start + index}`,
      time: clock(log.time, withDate),
      source: log.source,
      hue: hashHue(log.source),
      level: log.level,
      text: log.text,
      focus: start + index === focusIndex,
    })),
    focusId: focusIndex >= 0 ? `r${focusIndex}` : "",
  };
}

Page({
  data: {
    ...render(session.state),
    follow: true,
    wrap: true,
    scrollTop: 0,
    command: "",
    sending: false,
    target: "bds",
    targets: COMMAND_TARGETS,
    rangeLoading: false,
  },
  onShow() {
    if (consoleFocus.at) {
      // 从告警跳转：清空筛选，必要时按当天重读，定位到该条
      Object.assign(view, { query: "", clearedAt: "", focus: consoleFocus.at });
      view.sources.clear();
      view.levels.clear();
      const inBuffer = session.state.logs.some((log) => log.time === consoleFocus.at);
      const day = dayKey(new Date(consoleFocus.at));
      consoleFocus.at = "";
      this.setData({ follow: false });
      if (!inBuffer && session.can("logs-range")) void this.loadDay(day);
    }
    watchSession(this, ["connection", "logs"], (state) => {
      const data = render(state) as Record<string, unknown>;
      if (this.data.follow) data.scrollTop = (this.data.scrollTop as number) + 100_000;
      return data;
    });
  },
  onHide() {
    unwatchSession(this);
  },
  onUnload() {
    unwatchSession(this);
  },

  /** 重新渲染（筛选变化后） */
  rerender() {
    const data = render(session.state) as Record<string, unknown>;
    if (this.data.follow && !view.focus) data.scrollTop = (this.data.scrollTop as number) + 100_000;
    this.setData(data);
  },

  onQuery(event: WechatMiniprogram.Input) {
    view.query = event.detail.value;
    this.rerender();
  },
  toggleSource(event: WechatMiniprogram.TouchEvent) {
    const name = event.currentTarget.dataset.name as string;
    if (view.sources.has(name)) view.sources.delete(name);
    else view.sources.add(name);
    this.rerender();
  },
  toggleLevel(event: WechatMiniprogram.TouchEvent) {
    const value = event.currentTarget.dataset.value as string;
    if (view.levels.has(value)) view.levels.delete(value);
    else view.levels.add(value);
    this.rerender();
  },
  clearFilters() {
    view.query = "";
    view.sources.clear();
    view.levels.clear();
    this.rerender();
  },

  /** 按日期读取（logs-range） */
  onPickDay(event: WechatMiniprogram.PickerChange) {
    void this.loadDay(String(event.detail.value));
  },
  async loadDay(day: string) {
    view.day = day;
    view.ranged = null;
    view.truncated = false;
    this.setData({ rangeLoading: true, follow: !view.focus });
    this.rerender();
    try {
      // 按本地日历日取范围；不用 "YYYY-MM-DDTHH:mm" 字符串解析，部分 iOS 版本会当作 UTC。
      const [year, month, date] = day.split("-").map(Number) as [number, number, number];
      const since = new Date(year, month - 1, date, 0, 0, 0, 0).toISOString();
      const until = new Date(year, month - 1, date, 23, 59, 59, 999).toISOString();
      const result = await session.request("logs.tail", { limit: LOG_TAIL_MAX, since, until });
      if (view.day !== day) return;
      view.ranged = result.entries;
      view.truncated = result.truncated === true;
    } catch (error) {
      if (view.day === day) view.ranged = [];
      wx.showModal({ title: "无法按日期读取日志", content: errorText(error), showCancel: false });
    } finally {
      this.setData({ rangeLoading: false });
      this.rerender();
    }
  },
  /** 回到实时日志 */
  resetDay() {
    Object.assign(view, { day: "", ranged: null, truncated: false, focus: "" });
    this.setData({ follow: true });
    this.rerender();
  },

  /** 清屏：只隐藏此前的日志 */
  clearScreen() {
    const logs = session.state.logs;
    view.clearedAt = logs[logs.length - 1]?.time ?? new Date().toISOString();
    view.focus = "";
    this.rerender();
  },
  /** 显示已清屏的日志 */
  restoreScreen() {
    view.clearedAt = "";
    this.rerender();
  },
  toggleWrap() {
    this.setData({ wrap: !this.data.wrap });
  },
  /** 复制当前渲染的日志 */
  copyVisible() {
    const rows = this.data.rows as { time: string; source: string; level: string; text: string }[];
    const text = rows.map((row) => `${row.time} [${row.source}] [${row.level}] ${row.text}`).join("\n");
    wx.setClipboardData({ data: text, success: () => wx.showToast({ title: `已复制 ${rows.length} 条`, icon: "none" }) });
  },
  /** 长按复制单行 */
  copyRow(event: WechatMiniprogram.TouchEvent) {
    const text = String(event.currentTarget.dataset.text ?? "");
    if (text) wx.setClipboardData({ data: text });
  },

  /** 用户向上滚动时停止跟随。横向滑动不取消跟随，避免读长行时被拉回底部。 */
  onScroll(event: WechatMiniprogram.ScrollViewScroll) {
    const detail = event.detail;
    logScroll.top = detail.scrollTop;
    logScroll.height = detail.scrollHeight;
    const vertical = detail.deltaY > 0 && Math.abs(detail.deltaY) >= Math.abs(detail.deltaX);
    if (vertical && this.data.follow) this.setData({ follow: false });
  },
  /** 滑到底部时恢复跟随。scrolltolower 在滑到右边缘时也会触发，先确认是纵向到底。 */
  onReachBottom() {
    if (this.data.follow || view.focus) return;
    this.createSelectorQuery()
      .select(".log-view")
      .boundingClientRect((rect) => {
        if (!rect) return;
        if (logScroll.top + rect.height >= logScroll.height - 40) this.setData({ follow: true });
      })
      .exec();
  },
  followLatest() {
    view.focus = "";
    this.setData({ follow: true });
    this.rerender();
  },

  /** 命令输入 */
  onCommand(event: WechatMiniprogram.Input) {
    this.setData({ command: event.detail.value });
  },
  pickTarget() {
    wx.showActionSheet({
      itemList: COMMAND_TARGETS,
      success: ({ tapIndex }) => this.setData({ target: COMMAND_TARGETS[tapIndex] }),
    });
  },
  /** 历史命令 */
  pickHistory() {
    if (!view.history.length) {
      wx.showToast({ title: "还没有发送过命令", icon: "none" });
      return;
    }
    wx.showActionSheet({
      itemList: view.history.slice(0, 6),
      success: ({ tapIndex }) => this.setData({ command: view.history[tapIndex] ?? "" }),
    });
  },
  async send() {
    const command = this.data.command as string;
    const line = command.trim();
    if (!line || this.data.sending) return;
    if (!session.editable) {
      wx.showToast({ title: "当前为只读或未连接", icon: "none" });
      return;
    }
    this.setData({ sending: true });
    const result = await guard(() => session.request("services.send", { name: this.data.target, message: command }), "发送失败");
    this.setData({ sending: false });
    if (!result) return;
    if (!result.delivered) {
      wx.showToast({ title: "服务未接收命令（可能为外部进程）", icon: "none" });
      return;
    }
    view.history = [line, ...view.history.filter((item) => item !== line)].slice(0, 50);
    view.focus = "";
    this.setData({ command: (this.data.command as string) === command ? "" : this.data.command, follow: true });
    this.rerender();
  },
});
