/**
 * scoreboard.ts — 计分板快照的共享状态（计分项列表页与计分项详情页共用）
 *
 * 使用场景：admin/pages/scoreboard（计分项列表，新建 / 删除计分项）与 admin/pages/scoreboard-objective
 *（某个计分项的统计、排行、参与者与分数编辑）读取同一份快照。页面在 onShow 调用 watchScoreboard、
 * onHide / onUnload 调用 unwatchScoreboard；有页面在看时定时刷新（数据服务只在有人查看时要求游戏内脚本上报），
 * 编辑经 applyScoreboard 下发后等待包含结果的新快照，再通知所有正在显示的页面重新渲染。
 */
import { guard } from "../../core/actions";
import { errorText, relativeTime } from "../../core/format";
import { connectionView, unwatchSession, watchSession } from "../../core/page";
import { session, type SessionState } from "../../core/session";
import type { ScoreboardOperation, ScoreboardReadResult } from "../../core/types";

/** 页面显示期间的刷新间隔；需短于数据服务的关注期（30 秒），游戏内脚本才会持续同步 */
const POLL_MS = 5_000;

/** 可以 setData 的页面实例 */
interface Host {
  setData(data: Record<string, unknown>): void;
}

/** 两个页面共用的快照与请求状态 */
export const scoreboard = {
  result: null as ScoreboardReadResult | null,
  loading: false,
  error: "",
  /** 编辑操作下发中：两个页面的编辑入口都置灰 */
  saving: false,
  /** 读取请求序号，丢弃被后发请求取代的响应 */
  seq: 0,
  /** 进行中的读取数；定时刷新在有读取未完成时跳过，以免顶掉编辑后等待新快照的那次读取 */
  inflight: 0,
};

/** 正在显示的页面 → 按最新状态重新渲染 */
const listeners = new Map<object, () => void>();
/** 定时刷新；有页面在看时运行 */
let timer: number | null = null;

function notify() {
  for (const rerender of listeners.values()) rerender();
}

/** 进入计分板（列表页 onLoad）时清空上次的快照与错误 */
export function resetScoreboard() {
  scoreboard.result = null;
  scoreboard.loading = scoreboard.saving = false;
  scoreboard.error = "";
}

/** 读取快照；after 用于编辑后等待包含结果的新快照，silent 为定时刷新（失败不覆盖已有数据） */
export async function loadScoreboard(options: { after?: number; silent?: boolean } = {}) {
  if (session.state.status !== "online") return;
  const seq = ++scoreboard.seq;
  if (!options.silent) {
    scoreboard.loading = true;
    notify();
  }
  scoreboard.inflight++;
  try {
    const value = await session.request("scoreboard.read", options.after === undefined ? {} : { after: options.after });
    if (seq !== scoreboard.seq) return;
    scoreboard.result = value;
    scoreboard.error = "";
  } catch (error) {
    if (seq !== scoreboard.seq) return;
    if (!options.silent || !scoreboard.result) scoreboard.error = errorText(error);
  } finally {
    scoreboard.inflight--;
    if (seq === scoreboard.seq) {
      scoreboard.loading = false;
      notify();
    }
  }
}

/** 下发编辑操作并等待新快照；成功返回 true，失败弹窗说明。调用方先确认 canEdit */
export async function applyScoreboard(operations: ScoreboardOperation[], success: string, failTitle: string): Promise<boolean> {
  if (scoreboard.saving) return false;
  scoreboard.saving = true;
  notify();
  const done = await guard(async () => {
    const { sentAt } = await session.request("scoreboard.apply", { operations });
    wx.showToast({ title: success, icon: "success" });
    await loadScoreboard({ after: sentAt, silent: true });
    return true;
  }, failTitle);
  scoreboard.saving = false;
  notify();
  return Boolean(done);
}

/**
 * 页面显示时订阅：连接状态变化与快照更新时用 render 重新渲染；从离线恢复（含每次回到前台）时重新读取；
 * 第一个订阅的页面启动定时刷新。
 */
export function watchScoreboard(host: Host, render: (state: SessionState) => Record<string, unknown>) {
  let online = false;
  listeners.set(host, () => host.setData(render(session.state)));
  watchSession(host, ["connection"], (state) => {
    const now = state.status === "online";
    const resumed = now && !online;
    online = now;
    if (resumed) void loadScoreboard();
    return render(state);
  });
  if (timer === null) {
    timer = setInterval(() => {
      if (scoreboard.inflight === 0) void loadScoreboard({ silent: true });
    }, POLL_MS) as unknown as number;
  }
}

/** 页面隐藏 / 卸载时取消订阅；没有页面在看时停止定时刷新 */
export function unwatchScoreboard(host: object) {
  unwatchSession(host);
  listeners.delete(host);
  if (!listeners.size && timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

/** 两个页面共用的连接与快照状态字段（编辑权限、同步时间、不可用说明等） */
export function scoreboardStatus(state: SessionState) {
  const result = scoreboard.result;
  const connection = connectionView(state);
  return {
    ...connection,
    /** 可以下发编辑：连接可写且数据服务可用 */
    canEdit: connection.editable && Boolean(result?.available),
    loaded: Boolean(result),
    loading: scoreboard.loading,
    saving: scoreboard.saving,
    error: scoreboard.error,
    synced: result?.updatedAt ? `同步于 ${relativeTime(result.updatedAt, Date.now())}` : "",
    /** 不可用或不新鲜时的说明，以及提示语气 */
    note: result && (!result.available || !result.fresh) ? result.note ?? "" : "",
    noteTone: result?.available ? "warning" : "info",
    truncated: Boolean(result?.truncated),
  };
}
