/**
 * OverviewPage.tsx — 服务总览
 *
 * 使用场景：接入实例后的默认页，以服务状态、玩家快照、近期告警和维护任务帮助排查异常。
 */
import type { ManagementMethodMap, ServiceStatusRow } from "@sfmc-bds/management";
import { useEffect, useState } from "react";
import { activeTasks, useDesktop } from "../app/desktop.js";
import { Button, IconButton } from "../components/controls.js";
import { AlertFeed, serviceMeta, serviceState, TaskFeed } from "../components/feeds.js";
import { MetricsPanel, useRuntimeMetrics } from "../components/MetricsPanel.js";
import { Menu } from "../components/overlays.js";
import { Tooltip } from "../components/tooltip.js";
import { Badge, CopyText, EmptyState, IconTile, PageHeader, Stat, StatusDot, Surface } from "../components/ui.js";
import { StartupDrawer } from "../dialogs/StartupDrawer.js";
import { duration, hostLabel, relativeTime } from "../lib/format.js";

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
      <div role="cell" className="mono num">
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
  const { model, editable, submit, setPage, request } = useDesktop();
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
  const recentAlerts = model.logs.filter(
    (log) =>
      (log.level === "warn" || log.level === "error") &&
      now - Date.parse(log.time) >= 0 &&
      now - Date.parse(log.time) < 15 * 60_000
  );
  return (
    <div className="page">
      <PageHeader
        title="服务总览"
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
      <div className="stat-grid">
        <Stat
          label="运行服务"
          icon="server"
          value={
            stale ? (
              "—"
            ) : (
              <>
                {running}
                <span className="stat-total"> / {model.services.length}</span>
              </>
            )
          }
          hint={stale ? "连接已断开" : `${model.services.length - running} 项已停止`}
          onClick={() => document.querySelector(".svc-table")?.scrollIntoView({ block: "nearest", behavior: "smooth" })}
        />
        <Stat
          label="在线玩家"
          variant="graphite"
          icon="users"
          value={playersFresh ? (onlineCount ?? "—") : "—"}
          hint={
            playersFresh
              ? metrics.supported
                ? "实时监测"
                : `更新于 ${relativeTime(players!.updatedAt, now)}`
              : "在线状态未知"
          }
          onClick={() => setPage("players")}
        />
        <Stat
          label="近 15 分钟告警"
          icon="bell"
          value={stale ? "—" : recentAlerts.length}
          hint={stale ? "连接已断开" : ""}
          onClick={() => setPage("logs")}
        />
        <Stat
          label="进行中任务"
          variant="graphite"
          icon="history"
          value={stale ? "—" : active.length}
          hint={stale ? "任务状态未知" : active.length ? "查看执行进度" : "暂无维护任务"}
          onClick={() => setPage("tasks")}
        />
      </div>
      <MetricsPanel metrics={metrics} />
      <Surface
        title="服务"
        extra={
          <button type="button" className="link-btn" onClick={() => setPage("logs")}>
            打开控制台
          </button>
        }
        flush
      >
        {model.services.length ? (
          <div className="svc-table" role="table" aria-label="运行服务">
            <div className="svc-row svc-row-head" role="row">
              <div role="columnheader">服务</div>
              <div role="columnheader">状态</div>
              <div role="columnheader">归属</div>
              <div role="columnheader">PID</div>
              <div role="columnheader">运行时长</div>
              <div role="columnheader" className="svc-actions-head">
                操作
              </div>
            </div>
            {model.services.map((row) => (
              <ServiceRow key={row.name} row={row} />
            ))}
          </div>
        ) : (
          <EmptyState icon="server" title="暂无服务信息" />
        )}
      </Surface>
      <div className="overview-grid">
        <Surface
          title="最近告警"
          extra={
            <button type="button" className="link-btn" onClick={() => setPage("logs")}>
              打开控制台
            </button>
          }
        >
          <AlertFeed logs={model.logs} now={now} limit={5} onSelect={() => setPage("logs")} />
        </Surface>
        <Surface
          title="最近任务"
          extra={
            <button type="button" className="link-btn" onClick={() => setPage("tasks")}>
              全部任务
            </button>
          }
        >
          <TaskFeed tasks={model.tasks} now={now} limit={5} onSelect={() => setPage("tasks")} />
          {active.length > 0 && (
            <div className="mini-foot">
              <StatusDot tone="info" pulse /> {active.length} 个任务正在进行
            </div>
          )}
        </Surface>
      </div>
      <details className="instance-details">
        <summary>
          实例详情{" "}
          <span className="muted">
            SFMC {handshake.platformVersion} {hostLabel(handshake.host.os, handshake.host.arch)}
          </span>
        </summary>
        <dl className="kv">
          <dt>系统版本</dt>
          <dd>{handshake.host.release}</dd>
          <dt>守护进程</dt>
          <dd>
            {stale
              ? "状态未知"
              : `PID ${handshake.daemonPid} 运行 ${duration(now - Date.parse(handshake.daemonStartedAt))}`}
          </dd>
        </dl>
        <button type="button" className="link-btn" onClick={() => setPage("updates")}>
          查看更新与备份
        </button>
      </details>
      <StartupDrawer open={startupOpen} onClose={() => setStartupOpen(false)} />
    </div>
  );
}
