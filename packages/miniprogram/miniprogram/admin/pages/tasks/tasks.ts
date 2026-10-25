/**
 * tasks — 任务记录
 *
 * 使用场景：查看实例上的后台维护任务（启停、安装、配置保存、更新、备份等）。
 * 每行展示状态、当前阶段、耗时与更新时间；点开显示阶段时间线、错误信封、结构化结果与任务编号（同桌面端 TasksPage）。
 */
import { copy, guard } from "../../../core/actions";
import { isTaskDone } from "../../../core/format";
import { connectionView, unwatchSession, watchSession } from "../../../core/page";
import { session, type SessionState } from "../../../core/session";
import { taskDetailView, taskView } from "../../core/views";

/** 列表筛选 */
type Filter = "all" | "active" | "failed";

/** 页面状态（不放进 data） */
const view = { filter: "all" as Filter, expanded: new Set<string>(), autoExpanded: "" };

const failedOf = (status: string) => status === "failed" || status === "interrupted";

function render(state: SessionState) {
  const now = Date.now();
  const running = state.tasks.filter((task) => !isTaskDone(task.status));
  // 首次出现新的进行中任务时自动展开，便于直接查看进度
  const first = running[0];
  if (first && view.autoExpanded !== first.id && !view.expanded.size) {
    view.expanded.add(first.id);
    view.autoExpanded = first.id;
  }
  const rows = state.tasks.filter((task) =>
    view.filter === "all" ? true : view.filter === "active" ? !isTaskDone(task.status) : failedOf(task.status),
  );
  return {
    ...connectionView(state),
    filter: view.filter,
    counts: {
      all: state.tasks.length,
      active: running.length,
      failed: state.tasks.filter((task) => failedOf(task.status)).length,
    },
    rows: rows.map((task) => {
      const open = view.expanded.has(task.id);
      return { ...taskView(task, now), open, detail: open ? taskDetailView(task) : null };
    }),
    hasAny: state.tasks.length > 0,
  };
}

/** 进行中任务的耗时每秒刷新 */
let ticker: number | null = null;

Page({
  data: render(session.state),
  onShow() {
    watchSession(this, ["connection", "tasks"], render);
    ticker = setInterval(() => {
      if (session.state.tasks.some((task) => !isTaskDone(task.status))) this.setData(render(session.state));
    }, 1000) as unknown as number;
  },
  onHide() {
    this.stop();
  },
  onUnload() {
    this.stop();
  },
  stop() {
    unwatchSession(this);
    if (ticker !== null) clearInterval(ticker);
    ticker = null;
  },
  async onPullDownRefresh() {
    await guard(() => session.refresh(), "刷新失败");
    wx.stopPullDownRefresh();
  },
  setFilter(event: WechatMiniprogram.TouchEvent) {
    view.filter = event.currentTarget.dataset.value as Filter;
    this.setData(render(session.state));
  },
  toggle(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id as string;
    if (view.expanded.has(id)) view.expanded.delete(id);
    else view.expanded.add(id);
    this.setData(render(session.state));
  },
  copyId(event: WechatMiniprogram.TouchEvent) {
    copy(String(event.currentTarget.dataset.id), "已复制任务编号");
  },
});
