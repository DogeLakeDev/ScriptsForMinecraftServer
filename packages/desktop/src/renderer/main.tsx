/**
 * main.tsx — 渲染进程入口
 *
 * 使用场景：index.html 加载本文件。负责：
 *  - 配置 Monaco 的 Web Worker（通用编辑器 + JSON 语言服务）并让 @monaco-editor/react 使用本地打包的 monaco（不走 CDN，符合 CSP）；
 *  - 开发模式下若不在 Electron 中运行（没有 preload 注入的 window.sfmc），安装模拟桥接以便在浏览器中走查界面；
 *  - 字体加载完成后让 Monaco 重新测量字符宽度（避免变宽字体晚到导致光标错位）；
 *  - 引入全局样式并渲染 <App />。
 * 原单文件实现的全部业务逻辑已迁移到 app/、pages/、dialogs/ 与 components/ 下的模块。
 */
import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/editor/editor.worker.js?worker";
import jsonWorker from "monaco-editor/language/json/json.worker.js?worker";
import { createRoot } from "react-dom/client";
import { App } from "./app/App.js";
import { installMockBridge } from "./dev/mock-bridge.js";
import "./styles/base.css";
import "./styles/controls.css";
import "./styles/overlays.css";
import "./styles/components.css";
import "./styles/shell.css";
import "./styles/pages.css";

globalThis.MonacoEnvironment = {
  getWorker: (_id, label) => (label === "json" ? new jsonWorker() : new editorWorker()),
};
loader.config({ monaco });

if (import.meta.env.DEV && !window.sfmc) installMockBridge();

void document.fonts.ready.then(() => monaco.editor.remeasureFonts());

createRoot(document.getElementById("root")!).render(<App />);
