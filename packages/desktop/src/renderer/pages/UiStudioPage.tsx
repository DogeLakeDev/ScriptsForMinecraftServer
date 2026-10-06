/**
 * UiStudioPage.tsx — 内置 UI Studio，复用 SDK 的浏览器编辑器。
 *
 * 编辑器资源随客户端打包，工程存于客户端 IndexedDB，无需启动 CLI 或连接实例。
 * 独立文档隔离两套样式；iframe 保留挂载，由应用外壳控制可见性。
 */
import { useEffect, useRef } from "react";
import { useAppearance } from "../app/theme.js";

export function UiStudioPage() {
  const frame = useRef<HTMLIFrameElement>(null);
  const { dark } = useAppearance();
  useEffect(() => {
    // iframe 内的键盘事件不会冒泡到外壳，只转交桌面导航快捷键。
    const forwardShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      if (!/^(k|b|[1-9])$/i.test(event.key)) return;
      event.preventDefault();
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: event.key, ctrlKey: event.ctrlKey, metaKey: event.metaKey })
      );
    };
    const element = frame.current;
    let frameWindow: Window | null = null;
    const attach = () => {
      frameWindow?.removeEventListener("keydown", forwardShortcut);
      frameWindow = element?.contentWindow ?? null;
      frameWindow?.addEventListener("keydown", forwardShortcut);
      if (frameWindow) {
        const event = frameWindow.document.createEvent("CustomEvent");
        event.initCustomEvent("sfmc:appearance", false, false, { dark });
        frameWindow.dispatchEvent(event);
      }
    };
    element?.addEventListener("load", attach);
    attach();
    return () => {
      element?.removeEventListener("load", attach);
      frameWindow?.removeEventListener("keydown", forwardShortcut);
    };
  }, [dark]);
  return (
    <iframe
      ref={frame}
      className="ui-studio-frame"
      title="UI Studio 界面编辑器"
      src="./ui-studio/index.html?embedded=1"
    />
  );
}
