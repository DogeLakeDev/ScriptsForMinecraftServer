/**
 * App.tsx — 应用根组件与外壳布局（SnowUI Dashboard 三栏：侧栏 / 内容 / 右侧动态栏）
 *
 * 使用场景：main.tsx 渲染 <App />。负责：
 *  - 组合全局 Provider：外观 → 提示 → 确认框 → 实例状态，以及全局通知出口；
 *  - 外壳布局与可折叠的侧栏、右侧动态栏（偏好持久化在 localStorage）；
 *  - 全局快捷键：Ctrl+K 命令面板、Ctrl+B 侧栏、Ctrl+1…9 切换页面；
 *  - 根据实例状态选择欢迎页 / 连接门 / 工作区页面，并挂载实例设置、接入流程与关于对话框。
 * 页面由 PAGES 注册表按 PageKey 查找（OCP：新增页面只需在 nav.ts 与此表各加一项）。
 */
import { useCallback, useEffect, useState, type ComponentType } from "react";
import { CommandPalette } from "../components/CommandPalette.js";
import { Button } from "../components/controls.js";
import { ConfirmProvider, ToastHost } from "../components/feedback.js";
import { ConnectGate, Welcome } from "../components/Gates.js";
import { RightRail } from "../components/RightRail.js";
import { Sidebar } from "../components/Sidebar.js";
import { TitleBar } from "../components/TitleBar.js";
import { TooltipProvider } from "../components/tooltip.js";
import { Callout } from "../components/ui.js";
import { AboutDialog } from "../dialogs/AboutDialog.js";
import { FlowDialogs } from "../dialogs/FlowDialogs.js";
import { ProfileDialog } from "../dialogs/ProfileDialog.js";
import { cx } from "../lib/cx.js";
import { ConfigPage } from "../pages/ConfigPage.js";
import { ConsolePage } from "../pages/ConsolePage.js";
import { ModulesPage } from "../pages/ModulesPage.js";
import { OverviewPage } from "../pages/OverviewPage.js";
import { PacksPage } from "../pages/PacksPage.js";
import { PlayersPage } from "../pages/PlayersPage.js";
import { TasksPage } from "../pages/TasksPage.js";
import { UiStudioPage } from "../pages/UiStudioPage.js";
import { UpdatesPage } from "../pages/UpdatesPage.js";
import { DesktopProvider, useDesktop } from "./desktop.js";
import { NAV, type PageKey } from "./nav.js";
import { AppearanceProvider } from "./theme.js";

/** 页面注册表：PageKey → 页面组件 */
const PAGES: Record<Exclude<PageKey, "studio">, ComponentType> = {
  overview: OverviewPage,
  logs: ConsolePage,
  tasks: TasksPage,
  modules: ModulesPage,
  packs: PacksPage,
  config: ConfigPage,
  players: PlayersPage,
  updates: UpdatesPage,
};

/** 布局偏好的本地持久化键 */
const LAYOUT_KEY = "sfmc.desktop.layout";
/** 窗口宽度低于此值时右侧动态栏改为浮层（避免内容区过窄） */
const NARROW_QUERY = "(max-width: 1279px)";

/** 读取持久化的布局偏好 */
function readLayout(): { sidebar: boolean; rail: boolean } {
  try {
    const value = JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? "{}") as { sidebar?: boolean; rail?: boolean };
    return { sidebar: value.sidebar !== false, rail: value.rail === true };
  } catch {
    return { sidebar: true, rail: false };
  }
}

/** 订阅媒体查询（用于窄窗口下的布局切换） */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);
  return matches;
}

/** 工作区顶部提示：连接消息与只读状态（与原实现的两条 Alert 一致，并补充直接可执行的操作） */
function WorkspaceBanners() {
  const { model, selected, editable, connect, startAttach, guarded } = useDesktop();
  if (!selected || !model.handshake) return null;
  const readonly = !editable;
  return (
    <div className="workspace-banners">
      {model.connectionMessage && (
        <Callout
          tone={model.disconnected ? "warning" : "info"}
          title={model.disconnected ? "连接已断开" : undefined}
          action={
            model.disconnected && (
              <Button
                size="sm"
                variant="primary"
                icon="plug"
                loading={model.connecting}
                onClick={() => void connect(selected, true)}
              >
                恢复连接
              </Button>
            )
          }
        >
          {model.connectionMessage}
        </Callout>
      )}
      {readonly && !model.disconnected && (
        <Callout
          tone="info"
          icon="eye"
          action={
            !model.handshake.legacy && (
              <Button size="sm" icon="shield" onClick={() => void guarded(() => startAttach(selected))}>
                完成接入
              </Button>
            )
          }
        >
          {model.handshake.legacy ? "旧版平台，仅支持查看。升级后可执行管理操作。" : "只读连接。接入后可修改此实例。"}
        </Callout>
      )}
    </div>
  );
}

/** 内容区：按实例状态选择欢迎页 / 连接门 / 页面 */
function Workspace() {
  const { ready, profiles, selected, model, page, current } = useDesktop();
  if (!ready) return <div className="workspace-loading" />;
  if (page === "studio") return null;
  if (!profiles.length || !selected) return <Welcome />;
  if (!model.handshake) return <ConnectGate />;
  const Page = PAGES[page];
  return (
    <>
      <WorkspaceBanners />
      <Page key={current} />
    </>
  );
}

/** 外壳：三栏布局、快捷键与全局对话框 */
function Shell() {
  const { selected, model, page, setPage, appInfo } = useDesktop();
  const [layout, setLayout] = useState(readLayout);
  const narrow = useMediaQuery(NARROW_QUERY);
  /** 窄窗口下右侧栏以浮层打开（不持久化） */
  const [railOverlay, setRailOverlay] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [studioOpened, setStudioOpened] = useState(page === "studio");
  // 编辑器首次打开后保留挂载，切换页面或实例不会丢失当前草稿、选中项与撤销记录。
  useEffect(() => {
    if (page === "studio") setStudioOpened(true);
  }, [page]);
  useEffect(() => localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)), [layout]);
  // 旧版平台没有模块/配置等能力时，停在这些页面只会看到空列表。切到第一个仍可用的页面。
  useEffect(() => {
    const handshake = model.handshake;
    if (!handshake) return;
    const item = NAV.find((row) => row.key === page);
    if (item?.capability && !handshake.capabilities.includes(item.capability)) {
      const fallback = NAV.find((row) => row.capability && handshake.capabilities.includes(row.capability));
      if (fallback) setPage(fallback.key);
    }
  }, [model.handshake, page, setPage]);
  useEffect(() => setRailOverlay(false), [narrow]);

  const railOpen = narrow ? railOverlay : layout.rail;
  const toggleSidebar = useCallback(() => setLayout((value) => ({ ...value, sidebar: !value.sidebar })), []);
  const toggleRail = useCallback(() => {
    if (narrow) setRailOverlay((value) => !value);
    else setLayout((value) => ({ ...value, rail: !value.rail }));
  }, [narrow]);
  const openAbout = useCallback(() => setAboutOpen(true), []);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "k") {
        event.preventDefault();
        setPaletteOpen((value) => !value);
      } else if (key === "b" && !event.shiftKey) {
        event.preventDefault();
        toggleSidebar();
      } else if (/^[1-9]$/.test(key)) {
        const item = NAV[Number(key) - 1];
        if (
          item &&
          (!item.capability ||
            (selected && (!model.handshake || model.handshake.capabilities.includes(item.capability))))
        ) {
          event.preventDefault();
          setPage(item.key);
        }
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [selected, model.handshake, setPage, toggleSidebar]);

  return (
    <div
      className={cx(
        "app",
        layout.sidebar ? "sidebar-open" : "sidebar-collapsed",
        railOpen && "rail-open",
        narrow && "narrow"
      )}
      data-platform={appInfo?.platform}
    >
      <Sidebar collapsed={!layout.sidebar} onToggleSidebar={toggleSidebar} onOpenAbout={openAbout} />
      <div className="main">
        <TitleBar onOpenPalette={() => setPaletteOpen(true)} railOpen={railOpen} onToggleRail={toggleRail} />
        <main className="content" id="content">
          <Workspace />
          {studioOpened && (
            <div className="studio-workspace" hidden={page !== "studio"}>
              <UiStudioPage />
            </div>
          )}
        </main>
      </div>
      {railOpen && (
        <>
          {narrow && <div className="rail-scrim" onClick={() => setRailOverlay(false)} aria-hidden="true" />}
          <RightRail />
        </>
      )}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onOpenAbout={openAbout}
        onToggleSidebar={toggleSidebar}
        onToggleRail={toggleRail}
      />
      <ProfileDialog />
      <FlowDialogs />
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  );
}

/** 应用根组件 */
export function App() {
  return (
    <AppearanceProvider>
      <TooltipProvider>
        <ConfirmProvider>
          <DesktopProvider>
            <Shell />
          </DesktopProvider>
        </ConfirmProvider>
        <ToastHost />
      </TooltipProvider>
    </AppearanceProvider>
  );
}
