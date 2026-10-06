/** 工程树与画布的右键菜单，定位和键盘导航交由公共 Base UI 浮层。 */
import { ContextMenu as UiContextMenu } from "@sfmc-bds/ui/overlays";
import { useCallback, useState, type MouseEvent } from "react";
import { menuEntries, type HeaderMenuEntry } from "./HeaderMenu";

export type ContextMenuEntry = HeaderMenuEntry;
export interface ContextMenuState {
  x: number;
  y: number;
  entries: ContextMenuEntry[];
}

export function useContextMenu() {
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const open = useCallback((event: MouseEvent, entries: ContextMenuEntry[]) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ x: event.clientX, y: event.clientY, entries });
  }, []);
  const close = useCallback(() => setMenu(null), []);
  return { menu, open, close };
}

export function ContextMenu({ state, onClose }: { state: ContextMenuState; onClose(): void }) {
  return <UiContextMenu point={state} items={menuEntries(state.entries)} onClose={onClose} />;
}
