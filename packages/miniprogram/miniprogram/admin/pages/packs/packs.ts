/**
 * packs — 世界包（行为包与资源包）
 *
 * 使用场景：查看当前世界已安装的包、版本与图标，切换启用状态，卸载，或导入 .mcpack / .mcaddon / .zip。
 * 导入：从微信聊天选择文件 → 上传到网关收件箱 → 提交一次 packs.import（支持批量时一次提交全部，同桌面端 PacksPage）。
 */
import type { GlassTab } from "../../../components/glass-tab-bar/index";
import { confirmSheet, copy, guard, restartBlockReason, restartServices, submit } from "../../../core/actions";
import { plainMinecraft } from "../../../core/format";
import { connectionView, unwatchSession, watchSession } from "../../../core/page";
import { session, type SessionState } from "../../../core/session";
import { choosePacks, uploadPacks } from "../../core/upload";

/** 已拉取的世界包图标：键为「实例:包 id:iconStamp」，名单刷新时不重复下载 */
const iconCache = new Map<string, string>();
/** 图标缓存上限（与桌面端一致） */
const ICON_CACHE_LIMIT = 200;
/** 正在请求的图标键 */
const iconLoading = new Set<string>();

/** 页面状态（不放进 data） */
const view = { kind: "all" as "all" | "behavior" | "resource", query: "" };

/** 底部悬浮栏的包类型（glass-tab-bar docked）：key 与 view.kind 的取值一致，文字后接数量 */
const KIND_TABS: { key: typeof view.kind; text: string; icon: string }[] = [
  { key: "all", text: "全部", icon: "layers" },
  { key: "behavior", text: "行为包", icon: "cube" },
  { key: "resource", text: "资源包", icon: "image" },
];

function iconKey(state: SessionState, id: string, stamp: string | undefined): string {
  return session.can("pack-icons") && stamp ? `${state.profile?.id ?? ""}:${id}:${stamp}` : "";
}

function render(state: SessionState) {
  const editable = session.editable && session.can("manual-restart");
  const needle = view.query.trim().toLowerCase();
  const behavior = state.packs.filter((row) => row.kind === "behavior").length;
  const counts = { all: state.packs.length, behavior, resource: state.packs.length - behavior };
  const rows = state.packs
    .filter((row) => (view.kind === "all" || row.kind === view.kind) && `${plainMinecraft(row.name)} ${row.id}`.toLowerCase().includes(needle))
    .map((row) => ({
      id: row.id,
      name: plainMinecraft(row.name),
      kind: row.kind,
      version: row.version,
      enabled: row.enabled,
      protected: Boolean(row.protected),
      icon: iconCache.get(iconKey(state, row.id, row.iconStamp)) ?? "",
    }));
  return {
    ...connectionView(state),
    editable,
    manualRestart: session.can("manual-restart"),
    canUninstall: session.can("pack-uninstall"),
    restartReason: restartBlockReason("bds"),
    kind: view.kind,
    query: view.query,
    counts,
    kindTabs: KIND_TABS.map((tab): GlassTab => ({ ...tab, text: `${tab.text} ${counts[tab.key]}` })),
    rows,
  };
}

Page({
  data: render(session.state),
  onShow() {
    watchSession(this, ["connection", "packs", "tasks", "services"], (state) => {
      this.loadIcons(state);
      return render(state);
    });
  },
  onHide() {
    unwatchSession(this);
  },
  onUnload() {
    unwatchSession(this);
  },
  async onPullDownRefresh() {
    await guard(() => session.refresh(), "刷新失败");
    wx.stopPullDownRefresh();
  },
  rerender() {
    this.setData(render(session.state));
  },

  /** 依次读取缺失的图标，读到后刷新列表 */
  loadIcons(state: SessionState) {
    if (!session.can("pack-icons") || state.status !== "online") return;
    for (const row of state.packs) {
      const key = iconKey(state, row.id, row.iconStamp);
      if (!key || iconCache.has(key) || iconLoading.has(key)) continue;
      iconLoading.add(key);
      session
        .request("packs.icon", { id: row.id })
        .then((result) => {
          if (result.mime !== "image/png" || !result.data || !/^[A-Za-z0-9+/=\s]+$/.test(result.data)) return;
          iconCache.set(key, `data:image/png;base64,${result.data.replace(/\s+/g, "")}`);
          while (iconCache.size > ICON_CACHE_LIMIT) {
            const oldest = iconCache.keys().next().value;
            if (oldest === undefined) break;
            iconCache.delete(oldest);
          }
          this.rerender();
        })
        .catch(() => {})
        .finally(() => iconLoading.delete(key));
    }
  },

  setKind(event: WechatMiniprogram.TouchEvent) {
    view.kind = event.currentTarget.dataset.value as typeof view.kind;
    this.rerender();
  },
  /** 底部悬浮栏 glass-tab-bar 的 select 事件：切换包类型 */
  selectKind(event: WechatMiniprogram.CustomEvent<{ key: string }>) {
    view.kind = event.detail.key as typeof view.kind;
    this.rerender();
  },
  onQuery(event: WechatMiniprogram.Input) {
    view.query = event.detail.value;
    this.rerender();
  },
  clearFilters() {
    view.query = "";
    view.kind = "all";
    this.rerender();
  },
  copyId(event: WechatMiniprogram.TouchEvent) {
    copy(String(event.currentTarget.dataset.id), "已复制 UUID");
  },

  toggle(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id);
    const row = session.state.packs.find((item) => item.id === id);
    if (!row || !this.data.editable) return;
    const enabled = !row.enabled;
    const name = plainMinecraft(row.name);
    void submit(this, "packs.toggle", { id: row.id, enabled }, `${enabled ? "启用" : "停用"} ${name}`, {
      description: "将保存世界包状态，可在操作完成后手动重启 BDS 使更改生效。",
    });
  },
  uninstall(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id);
    const row = session.state.packs.find((item) => item.id === id);
    if (!row || !this.data.editable) return;
    if (row.protected) {
      wx.showToast({ title: "平台聚合包请在模块管理中卸载", icon: "none" });
      return;
    }
    void submit(this, "packs.uninstall", { id: row.id }, `卸载 ${plainMinecraft(row.name)}`, {
      danger: true,
      okText: "卸载",
      description: "将从当前世界移走该包。默认进入卸载回收站。若这是行为包且带有配对资源包，会一起移走。完成后可手动重启 BDS。",
    });
  },
  restart() {
    restartServices(this, "bds");
  },

  /** 导入：选择 → 上传 → 提交 packs.import */
  async importPacks() {
    if (!this.data.editable) {
      wx.showToast({ title: "当前为只读或未连接", icon: "none" });
      return;
    }
    const picked = await guard(() => choosePacks(), "无法选择文件");
    if (!picked) return;
    if (picked.rejected.length) wx.showToast({ title: `已跳过 ${picked.rejected.length} 个不支持的文件`, icon: "none" });
    if (!picked.files.length) return;
    const uploaded = await guard(() => uploadPacks(picked.files), "上传失败");
    if (!uploaded?.length) return;
    const labels = uploaded.map((row) => row.original);
    const title = labels.length === 1 ? "导入世界包" : `导入 ${labels.length} 个世界包`;
    const description =
      labels.length === 1
        ? `已上传 ${labels[0]}。将安装到当前世界并启用，可在导入完成后手动重启 BDS。`
        : `已上传 ${labels.join("、")}。将依次安装到当前世界并启用。若其中一个失败，已经安装的包会保留。完成后可手动重启 BDS。`;
    if (session.can("pack-import-batch") || uploaded.length === 1) {
      await submit(
        this,
        "packs.import",
        session.can("pack-import-batch") ? { filenames: uploaded.map((row) => row.filename) } : { filename: uploaded[0]!.filename },
        title,
        { description, okText: "导入" },
      );
      return;
    }
    // 旧平台不支持批量：确认一次后逐个提交（与桌面端回退逻辑一致）
    await confirmSheet(this).open({
      title,
      description,
      okText: "导入",
      onConfirm: async () => {
        for (const row of uploaded) {
          const accepted = await session.request("packs.import", { filename: row.filename });
          session.track(accepted.operationId, `导入 ${row.original}`);
        }
        void session.refresh();
      },
    });
  },
});
