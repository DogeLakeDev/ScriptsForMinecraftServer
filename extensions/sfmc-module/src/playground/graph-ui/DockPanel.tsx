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

/** 可停靠 / 浮动面板壳（Photoshop 式：标题拖、停靠、关闭） */
export function DockPanel({ title, layout, onChange, children, className }: DockPanelProps) {
  if (!layout.visible) return null;

  const onDragStart = (e: MouseEvent) => {
    if (layout.dock !== "float") return;
    e.preventDefault();
    const sx = e.clientX;
    const sy = e.clientY;
    const ox = layout.x;
    const oy = layout.y;
    const move = (ev: globalThis.MouseEvent) => {
      onChange({ x: Math.max(0, ox + ev.clientX - sx), y: Math.max(40, oy + ev.clientY - sy) });
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
          height: layout.h,
          zIndex: 20,
        }
      : undefined;

  return (
    <div
      className={`dock-panel dock-${layout.dock}${className ? ` ${className}` : ""}`}
      style={style}
    >
      <div className="dock-title" onMouseDown={onDragStart}>
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
      <ScrollArea className="dock-body" viewportClassName="dock-body-pad">
        {children}
      </ScrollArea>
      {layout.dock === "float" ? (
        <div
          className="dock-resize"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const sx = e.clientX;
            const sy = e.clientY;
            const sw = layout.w;
            const sh = layout.h;
            const move = (ev: globalThis.MouseEvent) => {
              onChange({
                w: Math.max(180, sw + ev.clientX - sx),
                h: Math.max(120, sh + ev.clientY - sy),
              });
            };
            const up = () => {
              window.removeEventListener("mousemove", move);
              window.removeEventListener("mouseup", up);
            };
            window.addEventListener("mousemove", move);
            window.addEventListener("mouseup", up);
          }}
        />
      ) : null}
    </div>
  );
}
