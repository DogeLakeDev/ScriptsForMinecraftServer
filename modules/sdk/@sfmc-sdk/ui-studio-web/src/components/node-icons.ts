/**
 * node-icons.ts — 组件类型 → 图标映射。
 *
 * 组件库（Palette）与组件树（ProjectTree）共用同一份映射，
 * 保证同一类型在任何位置看到的图标一致；未知类型回退到 Box。
 */

import {
  ALargeSmall,
  BarChart3,
  Box,
  ChevronsUpDown,
  CircleAlert,
  Image,
  Minus,
  MousePointerClick,
  MoveVertical,
  Repeat,
  Rows3,
  Split,
  ToggleLeft,
  Type,
  type LucideIcon,
} from "lucide-react";

export type NodeIcon = LucideIcon;

const NODE_TYPE_ICONS: Record<string, NodeIcon> = {
  header: Type,
  text: ALargeSmall,
  info: CircleAlert,
  image: Image,
  divider: Minus,
  spacer: MoveVertical,
  button: MousePointerClick,
  textField: Rows3,
  toggle: ToggleLeft,
  dropdown: ChevronsUpDown,
  slider: BarChart3,
  when: Split,
  each: Repeat,
};

/** 取组件类型图标；未登记的类型回退到 Box。 */
export function nodeTypeIcon(type: string): NodeIcon {
  return NODE_TYPE_ICONS[type] ?? Box;
}
