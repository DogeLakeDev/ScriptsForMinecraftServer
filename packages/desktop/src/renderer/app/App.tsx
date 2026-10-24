/**
 * App.tsx — 应用根组件与外壳布局（侧栏 / 内容）
 *
 * 使用场景：main.tsx 渲染 <App />。负责：
 *  - 组合全局 Provider：外观 → 提示 → 确认框 → 实例状态，以及全局通知出口；
 *  - 外壳布局与可折叠的左侧栏（偏好持久化在 localStorage）；右侧告警与任务栏已移除；
 *  - 全局快捷键：Ctrl+K 命令面板、Ctrl+B 侧栏、Ctrl+1…9 切换页面；
 *  - 根据实例状态选择欢迎页 / 连接门 / 工作区页面，并挂载实例设置、初始化流程与关于对话框。
 * 页面由 PAGES 注册表按 PageKey 查找（OCP：新增页面只需在 nav.ts 与此表各加一项）。
 */
import { useCallback, useEffect, useState, type ComponentType } from "react";
import { AlertsProvider } from "../components/AlertsSheet.js";
import { CommandPalette } from "../components/CommandPalette.js";
import { Button } from "../components/controls.js";
import { ConfirmProvider, ProgressLine, ToastHost } from "../components/feedback.js";
import { ConnectGate, Welcome } from "../components/Gates.js";
import { Sidebar } from "../components/Sidebar.js";
import { TitleBar } from "../components/TitleBar.js";
import { TooltipProvider } from "../components/tooltip.js";
import { Callout } from "../components/ui.js";
import { AboutDialog } from "../dialogs/AboutDialog.js";
import { ClientSettingsDialog } from "../dialogs/ClientSettingsDialog.js";
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

/** 布局偏好的本地持久化键。旧数据里的 rail 不再读取。 */
const LAYOUT_KEY = "sfmc.desktop.layout";

/** 读取持久化的左侧栏展开状态。 */
function readLayout(): { sidebar: boolean } {
  try {
    const value = JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? "{}") as { sidebar?: boolean };
    return { sidebar: value.sidebar !== false };
  } catch {
    return { sidebar: true };
  }
}

/** 工作区顶部提示：连接消息、旧版只读，以及尚未初始化的目录 */
function WorkspaceBanners() {
  const { model, selected, connect, setFlow } = useDesktop();
  if (!selected || !model.handshake) return null;
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
      {model.handshake.legacy && !model.disconnected && (
        <Callout tone="info" icon="eye">
          旧版平台只支持查看。请在更新页升级平台后再进行管理。
        </Callout>
      )}
      {!model.handshake.initialized && !model.handshake.legacy && !model.disconnected && (
        <Callout
          tone="info"
          icon="rocket"
          title="目录尚未初始化"
          action={<Button size="sm" icon="rocket" onClick={() => setFlow({ kind: "deploy", profile: selected })}>初始化</Button>}
        >
          接受使用条款并准备服务端之后，就可以管理这台服务器。
        </Callout>
      )}
    </div>
  );
}

/** 连接尚未握手时的说明和进度。上传平台时用已传输字节，解包时没有总长。 */
function ConnectProgress() {
  const { model } = useDesktop();
  const progress = model.connectionProgress;
  const message = model.connectionMessage || "正在连接";
  return (
    <div className="connect-wait">
      <p>{message}</p>
      {typeof progress === "number" ? (
        <div className="connect-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label={message}>
          <span style={{ width: `${progress}%` }} />
        </div>
      ) : (
        <ProgressLine className="connect-progress-line" />
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
  if (!model.handshake) return model.connecting ? <ConnectProgress /> : <ConnectGate />;
  const Page = PAGES[page];
  return (
    <>
      <WorkspaceBanners />
      <Page key={current} />
    </>
  );
}

/** 外壳：左侧栏与内容区、快捷键与全局对话框 */
function Shell() {
  const { selected, model, page, setPage, appInfo } = useDesktop();
  const [layout, setLayout] = useState(readLayout);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  const toggleSidebar = useCallback(() => setLayout((value) => ({ ...value, sidebar: !value.sidebar })), []);
  const openAbout = useCallback(() => setAboutOpen(true), []);
  const openSettings = useCallback(() => setSettingsOpen(true), []);

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
        layout.sidebar ? "sidebar-open" : "sidebar-collapsed"
      )}
      data-platform={appInfo?.platform}
    >
      <Sidebar
        collapsed={!layout.sidebar}
        onToggleSidebar={toggleSidebar}
        onOpenAbout={openAbout}
        onOpenSettings={openSettings}
      />
      <div className="main">
        <TitleBar onOpenPalette={() => setPaletteOpen(true)} />
        <main className="content" id="content">
          <Workspace />
          {studioOpened && (
            <div className="studio-workspace" hidden={page !== "studio"}>
              <UiStudioPage />
            </div>
          )}
        </main>
      </div>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onOpenAbout={openAbout}
        onOpenSettings={openSettings}
        onToggleSidebar={toggleSidebar}
      />
      <ProfileDialog />
      <FlowDialogs />
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <ClientSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
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
            <AlertsProvider>
              <Shell />
            </AlertsProvider>
          </DesktopProvider>
        </ConfirmProvider>
        <ToastHost />
      </TooltipProvider>
    </AppearanceProvider>
  );
}
