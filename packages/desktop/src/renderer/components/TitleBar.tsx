/**
 * TitleBar.tsx — 顶栏（SnowUI Header）：面包屑、连接状态、搜索、外观、任务、告警、右侧栏开关
 *
 * 使用场景：窗口使用 titleBarStyle: "hidden" + 原生按钮覆盖层，本组件即窗口可拖拽区（高 68px）；
 * 右侧栏收起时通过 --wco-right（由 env(titlebar-area-*) 推导）为系统最小化/最大化/关闭按钮留位。
 */
import { useEffect, useMemo, useState } from "react";
import type { AppearanceMode } from "../../shared/api.js";
import { activeTasks, connectionState, useDesktop } from "../app/desktop.js";
import { navItem } from "../app/nav.js";
import { useAppearance } from "../app/theme.js";
import { duration, hostLabel, phaseLabel, taskLabel } from "../lib/format.js";
import { Button, IconButton } from "./controls.js";
import { ProgressLine } from "./feedback.js";
import { AlertFeed } from "./feeds.js";
import { Icon, type IconName } from "./icons.js";
import { Menu, Popover } from "./overlays.js";
import { Kbd, StatusDot } from "./ui.js";

/** 外观模式选项（顶栏外观菜单、命令面板共用） */
export const APPEARANCE_OPTIONS: { value: AppearanceMode; icon: IconName; label: string }[] = [
  { value: "system", icon: "system", label: "跟随系统" },
  { value: "light", icon: "sun", label: "浅色" },
  { value: "dark", icon: "moon", label: "深色" },
];

/** 连接详情弹层内容（逻辑与原实现一致：重新连接 / 断开 / 恢复连接 / 接入实例） */
function ConnectionDetails() {
  const { selected, model, connect, disconnect, setPage } = useDesktop();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  if (!selected) return null;
  const handshake = model.handshake;
  const state = connectionState(model);
  return (
    <div className="conn-pop">
      <div className="conn-pop-head">
        <StatusDot tone={state.tone} pulse={state.tone === "info"} />
        <b>{state.label}</b>
        <span className="conn-pop-name truncate">{selected.name}</span>
      </div>
      {handshake ? (
        <dl className="kv">
          <dt>平台版本</dt>
          <dd className="mono">{handshake.platformVersion}</dd>
          <dt>宿主系统</dt>
          <dd>
            {hostLabel(handshake.host.os, handshake.host.arch)}{" "}
            <span className="muted mono">{handshake.host.release}</span>
          </dd>
          <dt>守护进程</dt>
          <dd>
            <span className="mono">PID {handshake.daemonPid}</span>{" "}
            <span className="muted"> 已运行 {duration(now - Date.parse(handshake.daemonStartedAt))}</span>
          </dd>
          <dt>部署目录</dt>
          <dd className="mono truncate" title={handshake.root}>
            {handshake.root}
          </dd>
          <dt>协议</dt>
          <dd className="mono">
            v{handshake.protocolVersion}
            {handshake.legacy ? "（旧版）" : ""}
          </dd>
        </dl>
      ) : (
        <p className="muted conn-pop-empty">尚未与此实例建立管理连接。</p>
      )}
      {model.connectionMessage && <p className="conn-pop-msg">{model.connectionMessage}</p>}
      <div className="conn-pop-actions">
        {handshake && !model.disconnected ? (
          <>
            <Button size="sm" icon="refresh" onClick={() => void connect(selected, true)}>
              重新连接
            </Button>
            <Button size="sm" variant="danger-soft" icon="unplug" onClick={() => void disconnect(selected)}>
              断开
            </Button>
          </>
        ) : handshake ? (
          <Button
            size="sm"
            variant="primary"
            icon="plug"
            loading={model.connecting}
            onClick={() => void connect(selected, true)}
          >
            恢复连接
          </Button>
        ) : (
          <Button
            size="sm"
            variant="primary"
            icon="plug"
            loading={model.connecting}
            onClick={() => {
              setPage("overview");
              void connect(selected, false);
            }}
          >
            接入实例
          </Button>
        )}
      </div>
    </div>
  );
}

/** 告警按钮：角标为"上次打开后新增"的警告/错误数，打开弹层即视为已读（按实例分别记录） */
function AlertsButton() {
  const { model, current, setPage } = useDesktop();
  const [seen, setSeen] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const seenAt = seen[current] ?? 0;
  const unread = useMemo(
    () =>
      model.logs.reduce(
        (count, log) =>
          (log.level === "error" || log.level === "warn") && Date.parse(log.time) > seenAt ? count + 1 : count,
        0
      ),
    [model.logs, seenAt]
  );
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setSeen((rows) => ({ ...rows, [current]: Date.now() }));
      }}
      width={340}
      className="alerts-pop"
      trigger={<IconButton icon="bell" label="告警" size="sm" badge={unread || undefined} tooltip={false} />}
    >
      <div className="pop-head">
        <b>告警</b>
        <span className="muted">最近的警告与错误日志</span>
      </div>
      <AlertFeed
        logs={model.logs}
        now={Date.now()}
        limit={8}
        onSelect={() => {
          setOpen(false);
          setPage("logs");
        }}
      />
    </Popover>
  );
}

/** 顶栏 */
export function TitleBar({
  onOpenPalette,
  railOpen,
  onToggleRail,
}: {
  onOpenPalette: () => void;
  railOpen: boolean;
  onToggleRail: () => void;
}) {
  const { selected, page, model, busy, setPage } = useDesktop();
  const { mode, dark, setMode } = useAppearance();
  const item = navItem(page);
  const state = connectionState(model);
  const running = activeTasks(model);
  const latest = running[0];
  return (
    <header className="titlebar drag">
      <div className="tb-left">
        {selected || !item.capability ? (
          <nav className="tb-crumbs" aria-label="位置">
            <span className="tb-crumb-muted truncate">{item.capability ? selected?.name : item.group}</span>
            <span className="tb-crumb-sep">/</span>
            <span className="tb-crumb-current">{item.label}</span>
          </nav>
        ) : (
          <span className="tb-crumb-muted">SFMC Desktop</span>
        )}
        {selected && item.capability && (
          <Popover
            trigger={
              <button type="button" className={`tb-conn no-drag tone-${state.tone}`}>
                <StatusDot tone={state.tone} pulse={state.tone === "info" || (state.online && !model.attached)} />
                <span>{state.label}</span>
                <Icon name="chevronDown" size={12} />
              </button>
            }
            align="start"
            width={340}
          >
            <ConnectionDetails />
          </Popover>
        )}
      </div>
      <div className="tb-right no-drag">
        {latest && !railOpen && (
          <button type="button" className="tb-task" onClick={() => setPage("tasks")} title="查看任务">
            <Icon name="loader" size={14} spin />
            <span className="truncate">
              {taskLabel(latest)}
              {latest.phases.at(-1) ? ` ${phaseLabel(latest.phases.at(-1)!.name)}` : ""}
            </span>
            {running.length > 1 && <span className="tb-task-more">+{running.length - 1}</span>}
          </button>
        )}
        <button type="button" className="tb-search" onClick={onOpenPalette} aria-label="打开命令面板">
          <Icon name="search" size={16} />
          <span className="tb-search-text">搜索</span>
          <span className="tb-search-keys">
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>
        <Menu
          trigger={<IconButton icon={dark ? "moon" : "sun"} label="外观" size="sm" />}
          items={APPEARANCE_OPTIONS.map((option) => ({
            key: option.value,
            label: option.label,
            icon: option.icon,
            checked: mode === option.value,
            onSelect: () => setMode(option.value),
          }))}
          width={160}
        />
        <IconButton
          icon="history"
          label="任务记录"
          size="sm"
          badge={running.length || undefined}
          onClick={() => setPage("tasks")}
        />
        <AlertsButton />
        <IconButton
          icon="panel"
          mirrored
          label={railOpen ? "收起动态栏" : "展开动态栏"}
          size="sm"
          onClick={onToggleRail}
        />
      </div>
      {busy && <ProgressLine className="tb-progress" />}
    </header>
  );
}
