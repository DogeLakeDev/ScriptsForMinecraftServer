/**
 * DragHandle.tsx — 六点抓手。
 *
 * 只有抓手带 draggable：侧栏条目的点击（选中/展开）与拖动不再抢手势。
 * 拖影用最近的 [data-drag-ghost] 祖先（整张卡片/整行），避免只拖一个小图标。
 * 当前用于组件库条目与组件树节点。
 */

import { GripVertical } from "lucide-react";
import type { DragEvent } from "react";

/** 侧栏六点抓手：仅此元素发起 HTML5 拖放。 */
export function DragHandle({
  label,
  onDragStart,
}: {
  /** 无障碍与悬停说明，如「拖到画布插入」。 */
  label: string;
  onDragStart(event: DragEvent<HTMLElement>): void;
}) {
  return (
    <span
      className="drag-handle"
      draggable
      title={label}
      aria-label={label}
      onClick={(event) => event.stopPropagation()}
      onDragStart={(event) => {
        event.stopPropagation();
        onDragStart(event);
        const ghost = event.currentTarget.closest("[data-drag-ghost]");
        if (ghost instanceof HTMLElement) {
          const rect = ghost.getBoundingClientRect();
          event.dataTransfer.setDragImage(
            ghost,
            Math.max(0, event.clientX - rect.left),
            Math.max(0, event.clientY - rect.top),
          );
        }
      }}
    >
      <GripVertical size={12} strokeWidth={1.8} />
    </span>
  );
}
