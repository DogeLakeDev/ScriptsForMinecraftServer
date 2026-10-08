/**
 * CommandPalette.tsx — 命令面板（Ctrl+K）
 *
 * 使用场景：键盘优先的全局入口，可跳转页面、切换/连接实例、批量启停服务、切换外观与布局、检查客户端更新。
 * 命令列表统一在 commands 中生成，新增命令只需追加一项（OCP）；执行逻辑全部委托给 useDesktop 的操作。
 * 外层使用 Base UI Dialog 提供焦点陷阱、Esc 关闭、滚动锁定与进出场动画。
 */
import { Dialog } from "@base-ui/react/dialog";
import { useEffect, useMemo, useRef, useState } from "react";
import { connectionState, useDesktop } from "../app/desktop.js";
import { NAV } from "../app/nav.js";
import { useAppearance } from "../app/theme.js";
import { cx } from "../lib/cx.js";
import { Icon, type IconName } from "./icons.js";
import { profileSubtitle } from "./Sidebar.js";
import { APPEARANCE_OPTIONS } from "./TitleBar.js";
import { Kbd, StatusDot } from "./ui.js";

/** 单条命令 */
interface Command {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: IconName;
  keywords?: string;
  disabled?: boolean;
  run: () => void;
  /** 右侧附加状态（实例连接点） */
  tone?: "success" | "warning" | "info" | "neutral";
}

/** 外观命令的辅助检索词 */
const APPEARANCE_KEYWORDS: Record<string, string> = {
  system: "theme appearance 主题",
  light: "theme light 主题 浅色",
  dark: "theme dark 主题 深色",
};

/** 简单的多词子串匹配：所有空格分隔的词都需命中标签或关键词 */
function matches(command: Command, query: string): boolean {
  const haystack = `${command.label} ${command.keywords ?? ""} ${command.group}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

export function CommandPalette({
  open,
  onClose,
  onOpenAbout,
  onOpenSettings,
  onToggleSidebar,
  onToggleRail,
}: {
  open: boolean;
  onClose: () => void;
  onOpenAbout: () => void;
  onOpenSettings: () => void;
  onToggleSidebar?: () => void;
  onToggleRail?: () => void;
}) {
  const desktop = useDesktop();
  const { setMode } = useAppearance();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setCursor(0);
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const { selected, model, editable, profiles, models } = desktop;
    const rows: Command[] = NAV.map((item, index) => ({
      id: `page:${item.key}`,
      group: "页面",
      label: item.label,
      hint: `Ctrl ${index + 1}`,
      icon: item.icon,
      keywords: item.keywords,
      disabled: Boolean(
        item.capability && (!selected || (model.handshake && !model.handshake.capabilities.includes(item.capability)))
      ),
      run: () => desktop.setPage(item.key),
    }));
    if (selected) {
      if (!model.handshake || model.disconnected) {
        rows.push({
          id: "conn:connect",
          group: "实例",
          label: model.handshake ? `恢复连接 ${selected.name}` : `连接 ${selected.name}`,
          icon: "plug",
          keywords: "connect 连接 接入",
          run: () => void desktop.connect(selected, Boolean(model.handshake)),
        });
      } else {
        rows.push({
          id: "conn:reconnect",
          group: "实例",
          label: `重新连接 ${selected.name}`,
          icon: "refresh",
          keywords: "reconnect 重连",
          run: () => void desktop.connect(selected, true),
        });
        rows.push({
          id: "conn:disconnect",
          group: "实例",
          label: `断开 ${selected.name}`,
          icon: "unplug",
          keywords: "disconnect 断开",
          run: () => void desktop.disconnect(selected),
        });
      }
      rows.push({
        id: "conn:settings",
        group: "实例",
        label: "当前实例设置",
        icon: "settings",
        keywords: "settings 设置 连接",
        run: () => desktop.openProfileDialog(selected),
      });
    }
    for (const profile of profiles) {
      if (profile.id === desktop.current) continue;
      rows.push({
        id: `switch:${profile.id}`,
        group: "切换实例",
        label: profile.name,
        hint: profileSubtitle(profile),
        icon: profile.kind === "ssh" ? "server" : "monitor",
        keywords: `switch 切换 ${profile.host ?? ""} ${profile.root}`,
        tone: connectionState(models[profile.id]).tone,
        run: () => desktop.setCurrent(profile.id),
      });
    }
    rows.push({
      id: "profile:add",
      group: "实例",
      label: "添加实例",
      icon: "plus",
      keywords: "add new 新建 添加",
      run: () => desktop.openProfileDialog(null),
    });
    if (selected && model.handshake) {
      rows.push({
        id: "svc:start-all",
        group: "服务",
        label: "启动全部服务",
        icon: "play",
        keywords: "start all 启动",
        disabled: !editable,
        run: () => void desktop.submit("services.start", { name: "all" }, "启动全部服务"),
      });
      rows.push({
        id: "svc:restart-bds",
        group: "服务",
        label: "重启 BDS",
        icon: "restart",
        keywords: "restart bds 重启",
        disabled: !editable,
        run: () => void desktop.submit("services.restart", { name: "bds" }, "重启 BDS"),
      });
      rows.push({
        id: "svc:stop-all",
        group: "服务",
        label: "停止全部服务",
        icon: "stop",
        keywords: "stop all 停止",
        disabled: !editable,
        run: () =>
          void desktop.submit("services.stop", { name: "all" }, "停止全部服务", { danger: true, okText: "停止" }),
      });
      rows.push({
        id: "svc:refresh",
        group: "服务",
        label: "刷新实例数据",
        icon: "refresh",
        keywords: "refresh reload 刷新",
        disabled: model.disconnected,
        run: () => void desktop.guarded(() => desktop.refresh(desktop.current)),
      });
    }
    for (const option of APPEARANCE_OPTIONS) {
      rows.push({
        id: `theme:${option.value}`,
        group: "外观",
        label: `外观：${option.label}`,
        icon: option.icon,
        keywords: APPEARANCE_KEYWORDS[option.value],
        run: () => setMode(option.value),
      });
    }
    if (onToggleSidebar)
      rows.push({
        id: "layout:sidebar",
        group: "外观",
        label: "展开/收起侧栏",
        hint: "Ctrl B",
        icon: "panel",
        keywords: "sidebar layout 侧栏 布局",
        run: onToggleSidebar,
      });
    if (onToggleRail)
      rows.push({
        id: "layout:rail",
        group: "外观",
        label: "显示/隐藏动态栏",
        icon: "panel",
        keywords: "rail activity layout 动态 布局",
        run: onToggleRail,
      });
    rows.push({
      id: "app:settings",
      group: "客户端",
      label: "客户端设置",
      icon: "settings",
      keywords: "settings tray 托盘 开机启动 设置",
      run: onOpenSettings,
    });
    rows.push({
      id: "app:about",
      group: "客户端",
      label: "关于与检查更新",
      icon: "sparkles",
      keywords: "update about 更新 版本",
      run: onOpenAbout,
    });
    return rows;
  }, [desktop, setMode, onOpenAbout, onOpenSettings, onToggleSidebar, onToggleRail]);

  const visible = useMemo(
    () => commands.filter((command) => !query.trim() || matches(command, query.trim())),
    [commands, query]
  );
  const selectable = visible.filter((command) => !command.disabled);

  useEffect(() => {
    if (cursor >= selectable.length) setCursor(Math.max(0, selectable.length - 1));
  }, [cursor, selectable.length]);
  useEffect(() => {
    listRef.current?.querySelector(".cmd-row.active")?.scrollIntoView({ block: "nearest" });
  }, [cursor, query]);

  const execute = (command: Command | undefined) => {
    if (!command || command.disabled) return;
    onClose();
    command.run();
  };
  let lastGroup = "";
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="dialog-backdrop cmd-backdrop" />
        <Dialog.Viewport className="cmd-viewport">
          <Dialog.Popup className="cmd-panel" initialFocus={inputRef} aria-label="命令面板">
            <div className="cmd-input">
              <Icon name="search" size={16} />
              <input
                ref={inputRef}
                value={query}
                placeholder="输入页面、实例或操作…"
                aria-label="搜索命令"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setCursor(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setCursor((value) => Math.min(value + 1, selectable.length - 1));
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setCursor((value) => Math.max(value - 1, 0));
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                    execute(selectable[cursor]);
                  }
                }}
              />
              <Kbd>Esc</Kbd>
            </div>
            <div className="cmd-list" ref={listRef} role="listbox">
              {visible.length === 0 && <div className="cmd-empty">没有匹配的命令</div>}
              {visible.map((command) => {
                const header = command.group !== lastGroup ? command.group : null;
                lastGroup = command.group;
                const active = selectable[cursor]?.id === command.id;
                return (
                  <div key={command.id}>
                    {header && <div className="cmd-group">{header}</div>}
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={cx("cmd-row", active && "active")}
                      disabled={command.disabled}
                      tabIndex={-1}
                      onMouseMove={() => {
                        const index = selectable.findIndex((row) => row.id === command.id);
                        if (index >= 0 && index !== cursor) setCursor(index);
                      }}
                      onClick={() => execute(command)}
                    >
                      <span className="cmd-icon">
                        <Icon name={command.icon} size={16} />
                      </span>
                      <span className="cmd-label">{command.label}</span>
                      {command.tone && <StatusDot tone={command.tone} />}
                      {command.hint && <span className="cmd-hint truncate">{command.hint}</span>}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="cmd-foot">
              <span>
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> 选择
              </span>
              <span>
                <Kbd>Enter</Kbd> 执行
              </span>
              <span>
                <Kbd>Ctrl</Kbd>
                <Kbd>K</Kbd> 随时打开
              </span>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
