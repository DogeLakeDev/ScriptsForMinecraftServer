import { type MouseEvent, type ReactNode } from "react";
import { Codicon } from "./Codicon";
import type { PanelLayout } from "./layoutPrefs";
import { ScrollArea } from "./ScrollArea";

type DockPanelProps = {
  title: string;
  layout: PanelLayout;
  onChange: (patch: Partial<PanelLayout>) => void;
  children: ReactNode;
  className?: string;
};

const DRAG_OUT_PX = 8;

/** 可停靠 / 浮动面板壳（折叠、标题拖、停靠、角缩放、关闭） */
export function DockPanel({ title, layout, onChange, children, className }: DockPanelProps) {
  if (!layout.visible) return null;

  const collapsed = !!layout.collapsed;

  const onTitleMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const sx = e.clientX;
    const sy = e.clientY;
    const wasFloat = layout.dock === "float";
    const ox = layout.x;
    const oy = layout.y;
    let floated = wasFloat;
    let originX = ox;
    let originY = oy;
    let originClientX = sx;
    let originClientY = sy;

    const move = (ev: globalThis.MouseEvent) => {
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      if (!floated) {
        if (Math.hypot(dx, dy) < DRAG_OUT_PX) return;
        // dock 列内拖出 → 浮动（折叠标题条也可拖出）
        floated = true;
        originX = Math.max(0, ev.clientX - 40);
        originY = Math.max(40, ev.clientY - 12);
        originClientX = ev.clientX;
        originClientY = ev.clientY;
        onChange({
          dock: "float",
          x: originX,
          y: originY,
          w: Math.max(180, layout.w),
          h: collapsed ? 32 : Math.max(120, layout.h),
        });
        return;
      }
      onChange({
        x: Math.max(0, originX + (ev.clientX - originClientX)),
        y: Math.max(40, originY + (ev.clientY - originClientY)),
      });
    };

    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const style =
    layout.dock === "float"
      ? {
          position: "absolute" as const,
          left: layout.x,
          top: layout.y,
          width: layout.w,
          height: collapsed ? undefined : layout.h,
          zIndex: 20,
        }
      : undefined;

  const startResize =
    (edge: "e" | "s" | "se") => (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const sx = e.clientX;
      const sy = e.clientY;
      const sw = layout.w;
      const sh = layout.h;
      const move = (ev: globalThis.MouseEvent) => {
        const next: Partial<PanelLayout> = {};
        if (edge === "e" || edge === "se") {
          next.w = Math.max(180, sw + ev.clientX - sx);
        }
        if (!collapsed && (edge === "s" || edge === "se")) {
          next.h = Math.max(120, sh + ev.clientY - sy);
        }
        if (Object.keys(next).length) onChange(next);
      };
      const up = () => {
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
      };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    };

  return (
    <div
      className={`dock-panel dock-${layout.dock}${collapsed ? " dock-collapsed" : ""}${
        className ? ` ${className}` : ""
      }`}
      style={style}
    >
      <div className="dock-title" onMouseDown={onTitleMouseDown}>
        <button
          type="button"
          className="dock-icon-btn dock-collapse-btn"
          title={collapsed ? "展开" : "折叠"}
          aria-label={collapsed ? "展开" : "折叠"}
          aria-expanded={!collapsed}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => onChange({ collapsed: !collapsed })}
        >
          <Codicon name={collapsed ? "chevron-right" : "chevron-down"} />
        </button>
        <span className="dock-title-text">{title}</span>
        <div className="dock-actions" onMouseDown={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="dock-icon-btn"
            title="停靠左侧"
            aria-label="停靠左侧"
            onClick={() => onChange({ dock: "left" })}
          >
            <Codicon name="layout-sidebar-left" />
          </button>
          <button
            type="button"
            className="dock-icon-btn"
            title="浮动"
            aria-label="浮动"
            onClick={() => onChange({ dock: "float" })}
          >
            <Codicon name="window" />
          </button>
          <button
            type="button"
            className="dock-icon-btn"
            title="停靠右侧"
            aria-label="停靠右侧"
            onClick={() => onChange({ dock: "right" })}
          >
            <Codicon name="layout-sidebar-right" />
          </button>
          <button
            type="button"
            className="dock-icon-btn"
            title="关闭"
            aria-label="关闭"
            onClick={() => onChange({ visible: false })}
          >
            <Codicon name="close" />
          </button>
        </div>
      </div>
      {!collapsed ? (
        <ScrollArea className="dock-body" viewportClassName="dock-body-pad">
          {children}
        </ScrollArea>
      ) : null}
      {layout.dock === "float" ? (
        <>
          <div
            className="dock-resize dock-resize-e"
            onMouseDown={startResize("e")}
            aria-hidden
          />
          {!collapsed ? (
            <>
              <div
                className="dock-resize dock-resize-s"
                onMouseDown={startResize("s")}
                aria-hidden
              />
              <div
                className="dock-resize dock-resize-se"
                onMouseDown={startResize("se")}
                aria-hidden
              />
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
