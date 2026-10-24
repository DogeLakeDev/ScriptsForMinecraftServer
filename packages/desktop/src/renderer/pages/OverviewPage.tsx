/**
 * OverviewPage.tsx — 服务总览
 *
 * 使用场景：接入实例后的默认页，以服务状态、玩家快照、近期告警和维护任务帮助排查异常。
 * 布局自上而下：状态条（有没有问题）→ 服务表（底部附实例详情）+ 需要关注（要操作什么）→ 实例状态曲线（趋势）。
 */
import type { ManagementMethodMap, ServiceStatusRow } from "@sfmc-bds/management";
import { useEffect, useState, type ReactNode } from "react";
import { activeTasks, useDesktop } from "../app/desktop.js";
import { Button, IconButton } from "../components/controls.js";
import { useAlerts } from "../components/AlertsSheet.js";
import { AlertFeed, serviceMeta, serviceState, TaskFeed } from "../components/feeds.js";
import { formatMemoryMb, MetricsPanel, TPS_WARN_THRESHOLD, useRuntimeMetrics } from "../components/MetricsPanel.js";
import { Menu } from "../components/overlays.js";
import { Tooltip } from "../components/tooltip.js";
import { Badge, CopyText, EmptyState, IconTile, PageHeader, StatusDot, Surface } from "../components/ui.js";
import { StartupDrawer } from "../dialogs/StartupDrawer.js";
import { toAlertGroup } from "../lib/alert-archive.js";
import { cx } from "../lib/cx.js";
import { duration, hostLabel, type Tone } from "../lib/format.js";

/**
 * 顶部状态条中的一格：标题 + 数值，点击跳到对应区域或页面。
 * 使用场景：OverviewPage 顶部的运行服务、在线玩家、TPS、主机内存四项。
 * tone 只在数值有明确异常判定时传入（如 TPS 低于 TPS_WARN_THRESHOLD），正常时保持中性色。
 */
function StripItem({ label, value, tone, onClick }: { label: string; value: ReactNode; tone?: Tone; onClick?: () => void }) {
  return (
    <button type="button" className="overview-strip-item" onClick={onClick}>
      <span className="overview-strip-label">{label}</span>
      <span className={cx("overview-strip-value", tone && `tone-text-${tone}`)}>{value}</span>
    </button>
  );
}

/** 服务表中的一行：图标 + 名称说明、状态、归属、PID、运行时长、操作 */
function ServiceRow({ row }: { row: ServiceStatusRow }) {
  const { editable, submit, setPage, model } = useDesktop();
  const meta = serviceMeta(row.name);
  const state = serviceState(row);
  const external = row.ownership === "external";
  const stale = Boolean(model.disconnected);
  return (
    <div className="svc-row" role="row">
      <div className="svc-name" role="cell">
        <IconTile icon={meta.icon} size={28} />
        <div className="svc-title">
          <b>{row.title}</b>
          <span className="truncate">{meta.text}</span>
        </div>
      </div>
      <div role="cell">
        <Badge tone={!stale && row.running ? "success" : "neutral"} dot>
          {stale ? "状态未知" : row.running ? "运行中" : "已停止"}
        </Badge>
      </div>
      <div role="cell" className="svc-owner">
        {external ? (
          <Tooltip content="由外部管理器启动，无法安全停止" wrap>
            <span className={`tone-text-${state.tone}`}>外部进程</span>
          </Tooltip>
        ) : row.ownership === "managed" ? (
          "SFMC 托管"
        ) : (
          <span className="muted">尚未启动</span>
        )}
      </div>
      <div role="cell" className="mono num">
        {stale ? "—" : row.pid || "—"}
      </div>
      {/* 总览宽布局隐藏 PID 列，改由运行时长单元格的悬停提示展示 */}
      <div role="cell" className="mono num" title={!stale && row.pid ? `PID ${row.pid}` : undefined}>
        {!stale && row.running ? row.uptime : "—"}
      </div>
      <div role="cell" className="svc-actions">
        {row.running ? (
          <>
            <Button
              size="sm"
              icon="restart"
              disabled={!editable}
              onClick={() => void submit("services.restart", { name: row.name }, `重启 ${row.title}`)}
            >
              重启
            </Button>
            <Button
              size="sm"
              variant="danger-soft"
              icon="stop"
              disabled={!editable}
              onClick={() =>
                void submit("services.stop", { name: row.name }, `停止 ${row.title}`, { danger: true, okText: "停止" })
              }
            >
              停止
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            icon="play"
            disabled={!editable}
            onClick={() => void submit("services.start", { name: row.name }, `启动 ${row.title}`)}
          >
            启动
          </Button>
        )}
        <IconButton icon="terminal" label="查看日志" size="sm" onClick={() => setPage("logs")} />
      </div>
    </div>
  );
}

export function OverviewPage() {
  const { model, editable, submit, setPage, request, openLog } = useDesktop();
  const { alerts, openAlerts } = useAlerts();
  const [startupOpen, setStartupOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const metrics = useRuntimeMetrics();
  const [players, setPlayers] = useState<ManagementMethodMap["players.list"]>();
  const canReadPlayers = model.handshake?.capabilities.includes("players") && !model.disconnected;
  // 单次请求未完成时不启动下一轮；切换实例后丢弃旧连接的回包。
  useEffect(() => {
    setPlayers(undefined);
    if (!canReadPlayers || metrics.supported) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const value = await request("players.list");
        if (!disposed) {
          setPlayers(value);
          setNow(Date.now());
        }
      } catch {
        if (!disposed) setPlayers(undefined);
      } finally {
        if (!disposed) timer = setTimeout(() => void poll(), 5000);
      }
    };
    void poll();
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [request, canReadPlayers, metrics.supported]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);
  const handshake = model.handshake!;
  const running = model.services.filter((row) => row.running).length;
  const active = activeTasks(model);
  const stale = Boolean(model.disconnected);
  const playersFresh = metrics.supported
    ? metrics.fresh
    : Boolean(!stale && players?.fresh && now - Date.parse(players.updatedAt) < 60_000);
  const onlineCount = metrics.supported ? metrics.data?.current?.onlineCount : players?.players.length;
  // 状态条的 TPS / 内存与 MetricsPanel 同源：采样新鲜才显示 TPS，连接可达才显示主机内存。
  const tps = metrics.fresh ? metrics.data?.current?.tps : null;
  const hostMemory = metrics.reachable ? metrics.data?.host?.memory : null;
  // 有进行中任务时只列进行中的；否则回退到最近任务，保留原“最近任务”区块的信息。
  const shownTasks = active.length ? active : model.tasks;
  return (
    <div className="page">
      <PageHeader
        title="实例状态"
        description={<CopyText text={handshake.root} />}
        actions={
          <>
            <Button
              icon="play"
              disabled={!editable}
              onClick={() => void submit("services.start", { name: "all" }, "启动全部服务")}
            >
              启动全部
            </Button>
            <Menu
              trigger={<IconButton icon="more" label="更多操作" variant="secondary" />}
              items={[
                {
                  key: "restart",
                  disabled: !editable,
                  icon: "restart",
                  label: "重启全部服务",
                  onSelect: () =>
                    void submit("services.restart", { name: "all" }, "重启全部服务", {
                      okText: "重启",
                      description: "将按依赖顺序停止所有托管服务，再依次启动。玩家连接会暂时中断。",
                    }),
                },
                {
                  key: "stop",
                  danger: true,
                  disabled: !editable,
                  icon: "stop",
                  label: "停止全部服务",
                  onSelect: () =>
                    void submit("services.stop", { name: "all" }, "停止全部服务", {
                      danger: true,
                      okText: "停止",
                      description: "将按依赖顺序停止所有托管服务。",
                    }),
                },
                { type: "separator", key: "sep" },
                { key: "startup", icon: "power", label: "配置开机启动…", onSelect: () => setStartupOpen(true) },
              ]}
              width={200}
            />
          </>
        }
      />
      <div className="overview-strip" role="group" aria-label="实例概况">
        <StripItem
          label="运行服务"
          value={
            stale ? (
              "—"
            ) : (
              <>
                {running}
                <span className="overview-strip-total"> / {model.services.length}</span>
              </>
            )
          }
          onClick={() => document.querySelector(".svc-table")?.scrollIntoView({ block: "nearest", behavior: "smooth" })}
        />
        <StripItem label="在线玩家" value={playersFresh ? (onlineCount ?? "—") : "—"} onClick={() => setPage("players")} />
        <StripItem
          label="TPS"
          value={tps === null || tps === undefined ? "—" : tps.toFixed(2)}
          tone={tps !== null && tps !== undefined && tps < TPS_WARN_THRESHOLD ? "warning" : undefined}
          onClick={() => document.querySelector(".overview-metrics")?.scrollIntoView({ block: "nearest", behavior: "smooth" })}
        />
        <StripItem
          label="主机内存"
          value={
            hostMemory ? (
              <>
                {formatMemoryMb(hostMemory.usedMb)}
                <span className="overview-strip-total"> / {formatMemoryMb(hostMemory.totalMb)}</span>
              </>
            ) : (
              "—"
            )
          }
          onClick={() => document.querySelector(".overview-metrics")?.scrollIntoView({ block: "nearest", behavior: "smooth" })}
        />
      </div>
      <div className="overview-main">
        <Surface className="overview-services" title="服务" flush>
          {model.services.length ? (
            <div className="svc-table" role="table" aria-label="运行服务">
              {model.services.map((row) => (
                <ServiceRow key={row.name} row={row} />
              ))}
            </div>
          ) : (
            <EmptyState icon="server" title="暂无服务信息" />
          )}
          {/*
            实例详情：原页面底部折叠的 <details>，内容不变，移到服务卡底部。
            两列布局时服务卡与“需要关注”等高，详情贴底，填补服务较少时的空白。
          */}
          <footer className="overview-instance" aria-label="实例详情">
            <span>
              SFMC {handshake.platformVersion} {hostLabel(handshake.host.os, handshake.host.arch)}
            </span>
            <span>系统版本 {handshake.host.release}</span>
            <span>
              守护进程{" "}
              {stale
                ? "状态未知"
                : `PID ${handshake.daemonPid} 运行 ${duration(now - Date.parse(handshake.daemonStartedAt))}`}
            </span>
            <button type="button" className="link-btn" onClick={() => setPage("updates")}>
              查看更新与备份
            </button>
          </footer>
        </Surface>
        {/* 需要关注：合并原“最近告警”“最近任务”两个区块，放在服务表旁边保证首屏可见 */}
        <Surface
          className="overview-attention"
          title="需要关注"
          flush
          extra={
            <button type="button" className="link-btn" onClick={openAlerts}>
              全部告警 {alerts.length}
            </button>
          }
        >
          <AlertFeed groups={alerts.map(toAlertGroup)} now={now} limit={3} onSelect={openLog} emptyText="还没有保存的警告或错误" />
          <div className="overview-attention-tasks">
            <div className="overview-attention-head">
              <span>
                {active.length > 0 ? (
                  <>
                    <StatusDot tone="info" pulse /> {active.length} 个任务正在进行
                  </>
                ) : (
                  "最近任务"
                )}
              </span>
              <button type="button" className="link-btn" onClick={() => setPage("tasks")}>
                全部任务
              </button>
            </div>
            <TaskFeed tasks={shownTasks} now={now} limit={3} onSelect={() => setPage("tasks")} />
          </div>
        </Surface>
      </div>
      <MetricsPanel className="overview-metrics" metrics={metrics} />
      <StartupDrawer open={startupOpen} onClose={() => setStartupOpen(false)} />
    </div>
  );
}
