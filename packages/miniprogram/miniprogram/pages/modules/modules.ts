/**
 * modules — 模块管理
 *
 * 使用场景：「已安装」切换启用 / 卸载本地模块；「可安装」浏览官方模块索引并安装。
 * 安装前核对 requires：未安装或未启用时不提交任务，只在详情里说明（同桌面端 ModulesPage / ModuleDetailSheet）。
 * 安装、启用、停用、卸载都不重启服务，由「重启 BDS」按钮手动重启。
 */
import { guard, restartBlockReason, restartServices, submit } from "../../core/actions";
import { errorText } from "../../core/format";
import { connectionView, unwatchSession, watchSession } from "../../core/page";
import { session, type SessionState } from "../../core/session";
import type { ModuleRow } from "../../core/types";
import { assessModuleRequires, moduleIdentity } from "../../vendor/management";

/** 模块索引条目（与桌面端 RegistryModule 字段一致） */
interface RegistryModule {
  id: string;
  npm?: string;
  version?: string;
  sdk?: string;
  repo?: string;
  tag?: string;
  name?: string;
  description?: string;
  category?: string;
  license?: string;
  official?: boolean;
  requires?: string[];
}

/** 依赖状态文案 */
const DEPENDENCY_STATUS: Record<string, { label: string; tone: string }> = {
  ready: { label: "已安装并启用", tone: "success" },
  disabled: { label: "已安装但未启用", tone: "warning" },
  missing: { label: "尚未安装", tone: "danger" },
};

/** 展示名：没有单独名称时用 id */
const moduleTitle = (row: { id: string; name?: string }) => (row.name && row.name !== row.id ? row.name : row.id);

/** 页面状态（不放进 data） */
const view = {
  tab: "installed" as "installed" | "discover",
  query: "",
  status: "all" as "all" | "enabled" | "disabled",
  search: "",
  results: null as RegistryModule[] | null,
  catalog: [] as RegistryModule[],
  stale: false,
  loading: false,
  error: "",
  /** 详情栈：点依赖的「查看」会叠一层 */
  stack: [] as string[],
};

/** 本机是否已有该模块（目录名与逻辑 id 都算） */
function findInstalled(installed: ModuleRow[], id: string): ModuleRow | undefined {
  const key = moduleIdentity(id);
  return installed.find((row) => moduleIdentity(row.id) === key || moduleIdentity(row.folder) === key);
}

function render(state: SessionState) {
  const editable = session.editable && session.can("manual-restart");
  const needle = view.query.trim().toLowerCase();
  const enabledCount = state.modules.filter((row) => row.enabled).length;
  const installed = state.modules
    .filter((row) => (view.status === "all" || (view.status === "enabled" ? row.enabled : !row.enabled)) && `${row.id} ${row.folder} ${row.name}`.toLowerCase().includes(needle))
    .map((row) => {
      const title = moduleTitle(row);
      return { folder: row.folder, id: row.id, title, sub: title === row.id ? row.folder : row.id, version: row.version, enabled: row.enabled, linked: row.linked };
    });
  const registry = (view.results ?? []).map((row) => {
    const local = findInstalled(state.modules, row.id);
    const check = assessModuleRequires(row.requires, state.modules);
    return {
      id: row.id,
      title: moduleTitle(row),
      source: row.npm ?? (row.repo ? `${row.repo}@${row.tag ?? ""}` : "—"),
      description: row.description ?? "",
      version: row.version ?? "",
      sdk: row.sdk ?? "",
      local: local ? local.version : "",
      differentVersion: Boolean(local && row.version && local.version !== row.version),
      dependency: !local && check.declared && check.items.length ? (check.ok ? "ok" : "blocked") : "",
    };
  });
  const selectedId = view.stack[view.stack.length - 1];
  const selected = selectedId ? view.catalog.find((row) => row.id === selectedId) ?? view.results?.find((row) => row.id === selectedId) : undefined;
  let detail = null;
  if (selectedId) {
    const check = selected ? assessModuleRequires(selected.requires, state.modules) : null;
    const local = findInstalled(state.modules, selectedId);
    detail = {
      id: selectedId,
      found: Boolean(selected),
      title: selected ? moduleTitle(selected) : selectedId,
      description: selected?.description ?? "",
      version: selected?.version ?? "",
      sdk: selected?.sdk ?? "",
      license: selected?.license ?? "",
      source: selected ? selected.npm ?? (selected.repo ? `${selected.repo}@${selected.tag ?? ""}` : "") : "",
      local: local ? local.version : "",
      declared: Boolean(check?.declared),
      canInstall: Boolean(selected && !local && editable && (!Array.isArray(selected.requires) || check?.ok)),
      blocked: Boolean(selected && Array.isArray(selected.requires) && check && !check.ok),
      dependencies: (check?.items ?? []).map((item) => {
        const catalogRow = view.catalog.find((row) => moduleIdentity(row.id) === moduleIdentity(item.id));
        return {
          id: item.id,
          title: catalogRow ? moduleTitle(catalogRow) : item.id,
          catalogId: catalogRow?.id ?? "",
          ...DEPENDENCY_STATUS[item.status]!,
        };
      }),
      canBack: view.stack.length > 1,
    };
  }
  return {
    ...connectionView(state),
    editable,
    restartReason: restartBlockReason("bds"),
    manualRestart: session.can("manual-restart"),
    tab: view.tab,
    query: view.query,
    status: view.status,
    counts: { all: state.modules.length, enabled: enabledCount, disabled: state.modules.length - enabledCount },
    installed,
    search: view.search,
    registry,
    registryLoaded: view.results !== null,
    stale: view.stale,
    loading: view.loading,
    error: view.error,
    detail,
  };
}

Page({
  data: render(session.state),
  onShow() {
    watchSession(this, ["connection", "modules", "tasks", "services"], render);
  },
  onHide() {
    unwatchSession(this);
  },
  onUnload() {
    unwatchSession(this);
    view.stack = [];
  },
  async onPullDownRefresh() {
    await guard(() => session.refresh(), "刷新失败");
    if (view.tab === "discover") await this.searchRegistry(view.search);
    wx.stopPullDownRefresh();
  },
  rerender() {
    this.setData(render(session.state));
  },

  setTab(event: WechatMiniprogram.TouchEvent) {
    view.tab = event.currentTarget.dataset.value as typeof view.tab;
    this.rerender();
    if (view.tab === "discover" && view.results === null && !view.loading) void this.searchRegistry("");
  },
  setStatus(event: WechatMiniprogram.TouchEvent) {
    view.status = event.currentTarget.dataset.value as typeof view.status;
    this.rerender();
  },
  onQuery(event: WechatMiniprogram.Input) {
    view.query = event.detail.value;
    this.rerender();
  },
  clearFilters() {
    view.query = "";
    view.status = "all";
    this.rerender();
  },

  /** 启用 / 停用 */
  toggle(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id);
    const row = session.state.modules.find((item) => item.id === id);
    if (!row || !this.data.editable) return;
    const enabled = !row.enabled;
    void submit(this, "modules.toggle", { id: row.id, enabled }, `${enabled ? "启用" : "停用"}模块 ${row.id}`, {
      description: "将更新模块状态并重建行为包，可在操作完成后手动重启 BDS。",
    });
  },
  /** 卸载（本地链接模块不可卸载） */
  uninstall(event: WechatMiniprogram.TouchEvent) {
    const folder = String(event.currentTarget.dataset.folder);
    const row = session.state.modules.find((item) => item.folder === folder);
    if (!row || !this.data.editable) return;
    if (row.linked) {
      wx.showToast({ title: "本地链接模块不可卸载", icon: "none" });
      return;
    }
    void submit(this, "modules.uninstall", { id: row.folder }, `卸载 ${row.id}`, {
      danger: true,
      okText: "卸载",
      description: "将移除模块文件并重建行为包；模块写入的数据保留在数据库中。操作完成后可手动重启 BDS。",
    });
  },
  restart() {
    restartServices(this, "bds");
  },

  /** 模块索引搜索 */
  onSearchInput(event: WechatMiniprogram.Input) {
    view.search = event.detail.value;
    if (!view.search) void this.searchRegistry("");
  },
  onSearchConfirm() {
    void this.searchRegistry(view.search);
  },
  async searchRegistry(text: string) {
    view.loading = true;
    view.error = "";
    this.rerender();
    try {
      const result = await session.request("modules.search", { query: text });
      const modules = result.modules as RegistryModule[];
      view.results = modules;
      if (!text.trim()) view.catalog = modules;
      view.stale = Boolean((result as { stale?: boolean }).stale);
    } catch (error) {
      view.error = errorText(error);
    } finally {
      view.loading = false;
      this.rerender();
    }
  },

  /** 打开详情 */
  openDetail(event: WechatMiniprogram.TouchEvent) {
    view.stack = [String(event.currentTarget.dataset.id)];
    this.rerender();
  },
  openDependency(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id);
    if (!id || view.stack[view.stack.length - 1] === id) return;
    view.stack = [...view.stack, id];
    this.rerender();
  },
  backDetail() {
    view.stack = view.stack.slice(0, -1);
    this.rerender();
  },
  closeDetail() {
    view.stack = [];
    this.rerender();
  },
  showInstalled() {
    view.stack = [];
    view.tab = "installed";
    this.rerender();
  },

  /** 安装：依赖未满足时只打开详情，不提交任务 */
  install(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id);
    const row = view.catalog.find((item) => item.id === id) ?? view.results?.find((item) => item.id === id);
    if (!row || !this.data.editable || findInstalled(session.state.modules, row.id)) return;
    const requires = row.requires;
    if (Array.isArray(requires) && !assessModuleRequires(requires, session.state.modules).ok) {
      view.stack = [row.id];
      this.rerender();
      return;
    }
    view.stack = [];
    this.rerender();
    void submit(this, "modules.install", { id: row.id }, `安装模块 ${moduleTitle(row)}`, {
      description:
        Array.isArray(requires) && requires.length
          ? "依赖都已安装并启用。将下载模块并重建行为包，可在安装完成后手动重启 BDS。"
          : Array.isArray(requires)
            ? "这个模块没有额外依赖。将下载模块并重建行为包，可在安装完成后手动重启 BDS。"
            : "将下载模块并重建行为包，可在安装完成后手动重启 BDS。",
    });
  },
});
