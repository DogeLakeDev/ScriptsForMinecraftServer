/** 应用外壳：路由、公共 UI 提供者、宿主外观同步与弹窗出口。 */
import { TooltipProvider } from "@sfmc-bds/ui/tooltip";
import { useCallback, useEffect, useState } from "react";
import { StudioDialogHost } from "../components/StudioDialogs";
import { App as EditorPage } from "../pages/EditorPage";
import { ProjectList } from "../pages/ProjectList";
import { embedded } from "./host";
import { applyResolvedTheme } from "./theme";

function parseRoute(): { name: "list" } | { name: "editor"; projectId: string } {
  const match = /^#\/p\/([^/]+)/.exec(window.location.hash);
  if (match) {
    try {
      return { name: "editor", projectId: decodeURIComponent(match[1]!) };
    } catch {
      /* 无效路由回到列表 */
    }
  }
  return { name: "list" };
}

export function App() {
  const [route, setRoute] = useState(parseRoute);
  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  useEffect(() => {
    if (!embedded) return;
    document.documentElement.dataset.embedded = "true";
    const initial = window.parent.document.documentElement.dataset.theme;
    if (initial === "light" || initial === "dark") applyResolvedTheme(initial);
    const onAppearance = (event: Event) => {
      const detail = (event as CustomEvent<{ dark?: unknown }>).detail;
      if (typeof detail?.dark === "boolean") applyResolvedTheme(detail.dark ? "dark" : "light");
    };
    window.addEventListener("sfmc:appearance", onAppearance);
    return () => window.removeEventListener("sfmc:appearance", onAppearance);
  }, []);
  const openProject = useCallback((id: string) => {
    window.location.hash = `#/p/${encodeURIComponent(id)}`;
  }, []);
  const goHome = useCallback(() => {
    window.location.hash = "#/";
  }, []);
  return (
    <TooltipProvider>
      {route.name === "editor" ? (
        <EditorPage key={route.projectId} projectId={route.projectId} onExit={goHome} />
      ) : (
        <ProjectList onOpen={openProject} />
      )}
      <StudioDialogHost />
    </TooltipProvider>
  );
}
