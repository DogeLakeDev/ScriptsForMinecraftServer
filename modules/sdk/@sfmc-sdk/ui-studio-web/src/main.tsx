/**
 * main.tsx — UI Studio 浏览器入口。
 *
 * hash 路由：
 * - #/        项目列表（IndexedDB）
 * - #/p/<id>  项目编辑器（三栏）
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useCallback, useEffect, useState } from "react";
import { App } from "./App";
import { ProjectList } from "./pages/ProjectList";
import "./theme.css";
import "./styles.css";

/** 解析 location.hash 为路由。 */
function parseRoute(): { name: "list" } | { name: "editor"; projectId: string } {
  const hash = window.location.hash;
  const match = /^#\/p\/([^/]+)/.exec(hash);
  if (match) return { name: "editor", projectId: decodeURIComponent(match[1]!) };
  return { name: "list" };
}

function Root() {
  const [route, setRoute] = useState(parseRoute);

  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const openProject = useCallback((id: string) => {
    window.location.hash = `#/p/${encodeURIComponent(id)}`;
  }, []);
  const goHome = useCallback(() => {
    window.location.hash = "#/";
  }, []);

  return route.name === "editor" ? (
    <App projectId={route.projectId} onExit={goHome} />
  ) : (
    <ProjectList onOpen={openProject} />
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
