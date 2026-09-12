/**
 * ContextMenu.tsx — 通用右键菜单。
 *
 * Headless UI 没有 ContextMenu 原语，这里实现一个轻量版本：
 * fixed 定位在鼠标处、视口边缘钳制；外部点击 / ESC / 窗口失焦 / 滚动即关闭。
 * 通过 useContextMenu() 钩子管理状态，在目标元素 onContextMenu 中调用 open。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { LucideIcon } from "lucide-react";

/** 菜单项；"separator" 表示分隔线。 */
export interface ContextMenuItem {
  icon?: LucideIcon;
  label: string;
  danger?: boolean;
  onClick(): void;
}
export type ContextMenuEntry = ContextMenuItem | "separator";

export interface ContextMenuState {
  x: number;
  y: number;
  entries: ContextMenuEntry[];
}

/** 右键菜单状态钩子：open 绑定到 onContextMenu，close 由菜单自身触发。 */
export function useContextMenu() {
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const open = useCallback((event: ReactMouseEvent, entries: ContextMenuEntry[]) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ x: event.clientX, y: event.clientY, entries });
  }, []);
  const close = useCallback(() => setMenu(null), []);
  return { menu, open, close };
}

export function ContextMenu({
  state,
  onClose,
}: {
  state: ContextMenuState;
  onClose(): void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // 先渲染在鼠标处，首帧后按实际尺寸钳制到视口内。
  const [pos, setPos] = useState({ x: state.x, y: state.y });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({
      x: Math.max(4, Math.min(state.x, window.innerWidth - rect.width - 4)),
      y: Math.max(4, Math.min(state.y, window.innerHeight - rect.height - 4)),
    });
  }, [state]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onClose);
    window.addEventListener("blur", onClose);
    // 捕获阶段监听滚动（含任意滚动容器），菜单不跟随滚动。
    window.addEventListener("wheel", onClose, true);
    return () => {
      window.removeEventListener("mousedown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("blur", onClose);
      window.removeEventListener("wheel", onClose, true);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="context-menu" style={{ left: pos.x, top: pos.y }} role="menu">
      {state.entries.map((entry, index) =>
        entry === "separator" ? (
          <div key={index} className="context-menu-sep" />
        ) : (
          <button
            key={index}
            role="menuitem"
            className={`context-menu-item${entry.danger ? " danger" : ""}`}
            onClick={() => {
              onClose();
              entry.onClick();
            }}
          >
            {entry.icon ? <entry.icon size={14} strokeWidth={1.8} /> : null}
            {entry.label}
          </button>
        ),
      )}
    </div>
  );
}
