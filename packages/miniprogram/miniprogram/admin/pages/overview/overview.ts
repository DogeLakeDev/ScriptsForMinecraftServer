/**
 * overview — 实例状态（首页）
 *
 * 使用场景：打开小程序的默认页。自上而下：实例切换头 → 状态条（运行服务 / 在线玩家 / TPS / 主机内存）
 * → 服务列表（启动 / 重启 / 停止）→ 需要关注（告警 + 任务）→ 运行趋势（含各进程内存）→ 实例详情。
 * 判定规则与桌面端 OverviewPage / MetricsPanel 一致：TPS 低于 19.5 标为警告；采样不新鲜时不显示 TPS 与在线人数。
 */
import { guard, submit } from "../../../core/actions";
import { switchAdminTab } from "../../../core/admin-nav";
import { duration, formatMemoryMb, hostLabel } from "../../../core/format";
import { connectionView, consoleFocus, unwatchSession, watchSession } from "../../../core/page";
import { activeTasks, session, type SessionState } from "../../../core/session";
import { asMetricSpan, buildTrend, emptyTrend, type MetricSpan } from "../../core/trend";
import type { MetricsResult, ProcessResources } from "../../../core/types";
import { alertViews, serviceView, taskView } from "../../core/views";

/** TPS 告警阈值（与桌面端 TPS_WARN_THRESHOLD 相同） */
const TPS_WARN = 19.5;
/** 指标轮询间隔（与桌面端一致：10 秒一次）。时间窗由用户在 15 分钟 / 1 小时 / 一天里选，默认仍是 1 小时。 */
const METRICS_POLL_MS = 10_000;
/** 指标回包超过这么久视为不可达（与桌面端 reachable 判定一致） */
const METRICS_STALE_MS = 30_000;

/** 在线快照超过这么久视为不新鲜（与桌面端 playersFresh 判定一致） */
const PLAYERS_STALE_MS = 60_000;

/**
 * 页面级的指标缓存与计时器（不放进 data）。
 * players 用于旧平台没有 metrics 能力时，回退到 players.list 读取在线人数（与桌面端一致）。
 */
const metricsState: {
  data: MetricsResult | null;
  receivedAt: number;
  failed: boolean;
  timer: number | null;
  busy: boolean;
  players: { count: number; fresh: boolean; updatedAt: string } | null;
  /** 数据所属的实例 */
  profileId: string;
  /** 趋势图时间窗 */
  span: MetricSpan;
  /** 上一轮还在飞时又改了时间窗，结束后立刻再请求一次 */
  again: boolean;
} = {
  profileId: "",
  data: null,
  receivedAt: 0,
  failed: false,
  timer: null,
  busy: false,
  players: null,
  span: "60",
  again: false,
};

/** 内存清单的一行。BDS 与数据服务始终占位，其余进程只在正在运行时出现。 */
interface MemoryRowView {
  key: string;
  label: string;
  value: string;
  /** 累计 CPU、已停止或资源未知 */
  detail: string;
}

/**
 * 与桌面端 MetricsPanel 的内存侧栏同一套数字。
 * 使用场景：总览「运行趋势」里内存图上方的实时清单。
 */
function memoryPanel(metrics: MetricsResult | null, reachable: boolean): {
  show: boolean;
  host: string;
  usedPercent: number;
  hostNote: boolean;
  total: string;
  rows: MemoryRowView[];
} {
  const host = reachable ? metrics?.host?.memory ?? null : null;
  const processes = reachable ? metrics?.processes : null;
  const rows: Array<{ key: string; label: string; process: ProcessResources | null }> = [
    { key: "bds", label: "BDS", process: processes?.bds ?? null },
    { key: "db", label: "数据服务", process: processes?.db ?? null },
  ];
  for (const part of processes?.parts ?? []) rows.push({ key: part.key, label: part.label, process: part });
  let sum = 0;
  let any = false;
  for (const row of rows) {
    const value = row.process?.memoryMb;
    if (typeof value !== "number") continue;
    sum += value;
    any = true;
  }
  return {
    show: true,
    host: host ? `${formatMemoryMb(host.usedMb)} / ${formatMemoryMb(host.totalMb)}` : "—",
    usedPercent: host ? Math.max(0, Math.min(100, host.usedPercent)) : 0,
    hostNote: Boolean(host),
    total: any ? formatMemoryMb(sum) : "",
    rows: rows.map((row) => ({
      key: row.key,
      label: row.label,
      value: formatMemoryMb(row.process?.memoryMb),
      detail: memoryDetail(row.process),
    })),
  };
}

/** 进程行下方的说明，文案与桌面端一致。 */
function memoryDetail(process: ProcessResources | null): string {
  if (!process) return "资源未知";
  if (!process.running) return "已停止";
  return `累计 CPU ${process.cpuSeconds === null ? "未知" : `${process.cpuSeconds.toFixed(1)} s`}`;
}

/** 由会话状态与指标缓存推导整页数据 */
function render(state: SessionState) {
  const now = Date.now();
  const handshake = state.handshake;
  const stale = state.status !== "online";
  const running = state.services.filter((row) => row.running).length;
  const active = activeTasks(state);
  const metrics = metricsState.data;
  const reachable = !stale && !metricsState.failed && now - metricsState.receivedAt < METRICS_STALE_MS && Boolean(metrics);
  const fresh = reachable && Boolean(metrics?.fresh);
  const tps = fresh ? metrics?.current?.tps ?? null : null;
  const memory = reachable ? metrics?.host?.memory ?? null : null;
  const snapshot = metricsState.players;
  const playersFresh = session.can("metrics")
    ? fresh
    : Boolean(!stale && snapshot?.fresh && now - Date.parse(snapshot.updatedAt) < PLAYERS_STALE_MS);
  const onlineCount = session.can("metrics") ? metrics?.current?.onlineCount : snapshot?.count;
  return {
    ...connectionView(state),
    hasProfile: Boolean(state.profile),
    ready: Boolean(handshake),
    root: handshake?.root ?? "",
    strip: {
      running: stale ? "—" : String(running),
      total: stale ? "" : ` / ${state.services.length}`,
      players: playersFresh ? String(onlineCount ?? "—") : "—",
      tps: tps === null ? "—" : tps.toFixed(2),
      tpsWarn: tps !== null && tps < TPS_WARN,
      memory: memory ? formatMemoryMb(memory.usedMb) : "—",
      memoryTotal: memory ? ` / ${formatMemoryMb(memory.totalMb)}` : "",
    },
    services: state.services.map((row) => serviceView(row, stale)),
    alerts: alertViews(state.logs, 3, now),
    activeCount: active.length,
    tasks: (active.length ? active : state.tasks).slice(0, 3).map((task) => taskView(task, now)),
    metricsSupported: session.can("metrics"),
    metricsNote: !session.can("metrics") ? "当前平台暂不支持运行指标" : !metrics ? "正在读取指标…" : !fresh ? metrics.note ?? "暂时没有新的采样" : "",
    memoryPanel: session.can("metrics") ? memoryPanel(metrics, reachable) : { show: false, host: "—", usedPercent: 0, hostNote: false, total: "", rows: [] },
    detail: handshake
      ? {
          platform: `SFMC ${handshake.platformVersion} ${hostLabel(handshake.host.os, handshake.host.arch)}`,
          release: handshake.host.release,
          daemon: stale ? "状态未知" : `PID ${handshake.daemonPid} 运行 ${duration(now - Date.parse(handshake.daemonStartedAt))}`,
        }
      : null,
  };
}

Page({
  data: { ...render(session.state), span: metricsState.span, charts: emptyTrend() },
  onShow() {
    watchSession(this, ["connection", "services", "logs", "tasks"], render);
    this.startMetrics();
  },
  onHide() {
    unwatchSession(this);
    this.stopMetrics();
  },
  onUnload() {
    unwatchSession(this);
    this.stopMetrics();
  },
  async onPullDownRefresh() {
    if (session.state.status === "online") await guard(() => session.refresh(), "刷新失败");
    else await session.reconnect();
    wx.stopPullDownRefresh();
  },

  /** 指标轮询：单次请求未完成时不并行发下一轮；时间窗在飞行途中被改掉则结束后补一次。曲线只在这里更新，避免日志刷新把整段历史重复 setData。 */
  startMetrics() {
    this.stopMetrics();
    const poll = async () => {
      if (metricsState.busy) {
        metricsState.again = true;
        return;
      }
      const profileId = session.state.profile?.id ?? "";
      if (metricsState.profileId !== profileId) {
        Object.assign(metricsState, { profileId, data: null, receivedAt: 0, failed: false, players: null });
        this.setData({ charts: emptyTrend(Date.now(), metricsState.span) });
      }
      const span = metricsState.span;
      if (session.state.status === "online" && session.can("metrics")) {
        metricsState.busy = true;
        try {
          metricsState.data = await session.request("metrics.read", { spanMs: Number(span) * 60_000 });
          metricsState.receivedAt = Date.now();
          metricsState.failed = false;
        } catch {
          metricsState.failed = true;
        } finally {
          metricsState.busy = false;
        }
      } else if (session.state.status === "online" && session.can("players")) {
        metricsState.busy = true;
        try {
          const value = await session.request("players.list");
          metricsState.players = { count: value.players.length, fresh: value.fresh, updatedAt: value.updatedAt };
        } catch {
          metricsState.players = null;
        } finally {
          metricsState.busy = false;
        }
      }
      if (metricsState.span !== span) {
        metricsState.again = true;
      } else {
        this.setData({ ...render(session.state), charts: buildTrend(metricsState.data, span, Date.now()) });
      }
      if (metricsState.again) {
        metricsState.again = false;
        void poll();
      }
    };
    void poll();
    metricsState.timer = setInterval(() => void poll(), METRICS_POLL_MS) as unknown as number;
  },
  /** 切换趋势图时间窗。档位与桌面端相同。 */
  setSpan(event: WechatMiniprogram.TouchEvent) {
    const span = asMetricSpan(String(event.currentTarget.dataset.value ?? ""));
    if (!span || span === metricsState.span) return;
    metricsState.span = span;
    this.setData({ span });
    this.startMetrics();
  },
  stopMetrics() {
    if (metricsState.timer !== null) clearInterval(metricsState.timer);
    metricsState.timer = null;
  },

  openInstances() {
    wx.navigateTo({ url: "/admin/pages/instances/instances" });
  },
  openTasks() {
    switchAdminTab("tasks");
  },
  openConsole(event: WechatMiniprogram.TouchEvent) {
    const at = event.currentTarget.dataset.at as string | undefined;
    if (at) consoleFocus.at = at;
    switchAdminTab("console");
  },
  openPlayers() {
    wx.navigateTo({ url: "/admin/pages/players/players" });
  },
  openUpdates() {
    wx.navigateTo({ url: "/admin/pages/updates/updates" });
  },
  copyRoot() {
    if (this.data.root) wx.setClipboardData({ data: this.data.root });
  },

  /** 服务行的操作菜单 */
  serviceMenu(event: WechatMiniprogram.TouchEvent) {
    const name = event.currentTarget.dataset.name as string;
    const row = session.state.services.find((item) => item.name === name);
    if (!row) return;
    if (!session.editable) {
      wx.showToast({ title: "当前为只读或未连接", icon: "none" });
      return;
    }
    const items = row.running ? ["重启", "停止"] : ["启动"];
    wx.showActionSheet({
      alertText: row.running && row.pid ? `${row.title} · PID ${row.pid}` : row.title,
      itemList: items,
      success: ({ tapIndex }) => {
        const action = items[tapIndex];
        if (action === "启动") void submit(this, "services.start", { name: row.name }, `启动 ${row.title}`);
        if (action === "重启") void submit(this, "services.restart", { name: row.name }, `重启 ${row.title}`);
        if (action === "停止") void submit(this, "services.stop", { name: row.name }, `停止 ${row.title}`, { danger: true, okText: "停止" });
      },
    });
  },
  startAll() {
    void submit(this, "services.start", { name: "all" }, "启动全部服务");
  },
  /** 全部服务的更多操作（与桌面端「更多操作」菜单一致） */
  moreActions() {
    if (!session.editable) {
      wx.showToast({ title: "当前为只读或未连接", icon: "none" });
      return;
    }
    wx.showActionSheet({
      itemList: ["重启全部服务", "停止全部服务"],
      success: ({ tapIndex }) => {
        if (tapIndex === 0)
          void submit(this, "services.restart", { name: "all" }, "重启全部服务", {
            okText: "重启",
            description: "将按依赖顺序停止所有托管服务，再依次启动。玩家连接会暂时中断。",
          });
        else
          void submit(this, "services.stop", { name: "all" }, "停止全部服务", {
            danger: true,
            okText: "停止",
            description: "将按依赖顺序停止所有托管服务。",
          });
      },
    });
  },
});
