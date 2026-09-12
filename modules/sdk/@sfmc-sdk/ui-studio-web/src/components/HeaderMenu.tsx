/**
 * HeaderMenu.tsx — 顶栏下拉菜单（基于 Headless UI Menu）。
 *
 * MenuItems 通过 anchor 属性由 floating-ui 定位到按钮下方；
 * 焦点/禁用状态经 data-focus / data-disabled 属性注入，样式在 styles.css 中定义。
 */

import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import type { LucideIcon } from "lucide-react";

/** 菜单项；"separator" 表示分隔线。 */
export interface HeaderMenuItem {
  icon?: LucideIcon;
  label: string;
  /** 右侧展示的快捷键提示（仅展示，不绑定）。 */
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  onClick(): void;
}
export type HeaderMenuEntry = HeaderMenuItem | "separator";

export function HeaderMenu({
  label,
  entries,
}: {
  label: string;
  entries: HeaderMenuEntry[];
}) {
  return (
    <Menu as="div" className="header-menu">
      <MenuButton className="btn header-menu-button">{label}</MenuButton>
      <MenuItems anchor="bottom start" className="header-menu-items">
        {entries.map((entry, index) =>
          entry === "separator" ? (
            <div key={index} className="header-menu-sep" />
          ) : (
            <MenuItem key={index} disabled={entry.disabled}>
              <button
                className={`header-menu-item${entry.danger ? " danger" : ""}`}
                onClick={entry.onClick}
              >
                {entry.icon ? (
                  <entry.icon size={14} strokeWidth={1.8} />
                ) : (
                  <span className="header-menu-icon-blank" />
                )}
                <span className="header-menu-label">{entry.label}</span>
                {entry.shortcut ? <kbd>{entry.shortcut}</kbd> : null}
              </button>
            </MenuItem>
          ),
        )}
      </MenuItems>
    </Menu>
  );
}
