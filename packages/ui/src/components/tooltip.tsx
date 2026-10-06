/**
 * tooltip.tsx — 悬浮提示（Base UI Tooltip 封装）
 *
 * 使用场景：图标按钮的名称提示、禁用控件的原因说明、截断文本的完整内容。
 * 单独成文件是为了让 controls.tsx（IconButton）与 overlays.tsx 都能依赖它而不形成循环引用。
 */
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import type { ReactElement, ReactNode } from "react";

/** 全局提示节奏：首次悬停 450ms 后出现，相邻提示之间切换时立即显示（应用根节点提供一次） */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <BaseTooltip.Provider delay={450} closeDelay={60}>
      {children}
    </BaseTooltip.Provider>
  );
}

/**
 * 悬浮提示。
 * @param content 提示内容；为空时直接渲染 children（不包裹）
 * @param wrap 用 <span> 包裹触发元素：禁用的原生按钮不触发指针事件，需要包裹才能显示禁用原因
 */
export function Tooltip({
  content,
  children,
  side = "top",
  wrap,
}: {
  content: ReactNode;
  children: ReactElement;
  side?: "top" | "bottom" | "left" | "right";
  wrap?: boolean;
}) {
  if (content === undefined || content === null || content === false || content === "") return children;
  return (
    <BaseTooltip.Root>
      {wrap ? (
        <BaseTooltip.Trigger render={<span className="tooltip-wrap" />}>{children}</BaseTooltip.Trigger>
      ) : (
        <BaseTooltip.Trigger render={children} />
      )}
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side={side} sideOffset={6} className="tooltip-positioner">
          <BaseTooltip.Popup className="tooltip">{content}</BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}
