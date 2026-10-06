/** 顶栏数据驱动菜单，复用 desktop 的 Base UI 菜单与 SnowUI 浮层。 */
import { Button } from "@sfmc-bds/ui/controls";
import { Menu, type MenuEntry } from "@sfmc-bds/ui/overlays";
import type { UiIcon } from "./icons";

export interface HeaderMenuItem {
  icon?: UiIcon;
  label: string;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  onClick(): void;
}
export type HeaderMenuEntry = HeaderMenuItem | "separator";

export const menuEntries = (entries: HeaderMenuEntry[]): MenuEntry[] =>
  entries.map((entry, index) =>
    entry === "separator"
      ? { type: "separator", key: String(index) }
      : {
          key: String(index),
          label: entry.label,
          icon: entry.icon?.iconName,
          hint: entry.shortcut,
          danger: entry.danger,
          disabled: entry.disabled,
          onSelect: entry.onClick,
        }
  );

export function HeaderMenu({ label, entries }: { label: string; entries: HeaderMenuEntry[] }) {
  return <Menu trigger={<Button>{label}</Button>} items={menuEntries(entries)} align="start" />;
}
