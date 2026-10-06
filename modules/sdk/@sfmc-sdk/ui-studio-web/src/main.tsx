/**
 * main.tsx — UI Studio 浏览器入口。
 *
 * hash 路由：
 * - #/        项目列表（IndexedDB）
 * - #/p/<id>  项目编辑器（三栏）
 */
import "@sfmc-bds/ui/styles/base.css";
import "@sfmc-bds/ui/styles/controls.css";
import "@sfmc-bds/ui/styles/overlays.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { syncDocumentTheme } from "./app/theme";
import "./styles/editor.css";
import "./styles/theme.css";

// HMR / 无内联脚本时补一次，正常加载由 index.html 抢先设置以免闪屏。
syncDocumentTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
