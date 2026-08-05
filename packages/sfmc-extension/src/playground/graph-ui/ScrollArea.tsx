import * as RadixScrollArea from "@radix-ui/react-scroll-area";
import type { ReactNode } from "react";

type ScrollAreaProps = {
  children: ReactNode;
  className?: string;
  /** Viewport 额外 class（如内边距） */
  viewportClassName?: string;
};

/**
 * Radix ScrollArea 薄封装：细 thumb / track，贴近桌面应用观感。
 * type=hover：悬停或滚动时才显示滑块。
 */
export function ScrollArea({ children, className, viewportClassName }: ScrollAreaProps) {
  return (
    <RadixScrollArea.Root
      type="hover"
      className={`scroll-area${className ? ` ${className}` : ""}`}
    >
      <RadixScrollArea.Viewport
        className={`scroll-area-viewport${viewportClassName ? ` ${viewportClassName}` : ""}`}
      >
        {children}
      </RadixScrollArea.Viewport>
      <RadixScrollArea.Scrollbar className="scroll-area-scrollbar" orientation="vertical">
        <RadixScrollArea.Thumb className="scroll-area-thumb" />
      </RadixScrollArea.Scrollbar>
      <RadixScrollArea.Scrollbar className="scroll-area-scrollbar" orientation="horizontal">
        <RadixScrollArea.Thumb className="scroll-area-thumb" />
      </RadixScrollArea.Scrollbar>
      <RadixScrollArea.Corner className="scroll-area-corner" />
    </RadixScrollArea.Root>
  );
}
