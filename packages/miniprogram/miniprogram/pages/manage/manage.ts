/**
 * manage — 管理入口
 *
 * 使用场景：桌面端侧边栏「管理」分组在手机上的落点：模块、世界包、配置、玩家与权限、更新与备份，
 * 以及实例切换与断开连接。入口按握手能力显示，旧平台缺少的功能不展示。
 */
import { ask } from "../../core/actions";
import { connectionView, syncTabBar, unwatchSession, watchSession } from "../../core/page";
import { session, type SessionState } from "../../core/session";

/** 管理入口定义；capability 为空表示始终可用；tone 为每行各自的图标底块颜色（styles/base.wxss 的 .tile-*） */
const ENTRIES = [
  { key: "modules", title: "模块", icon: "modules", tone: "blue", url: "/pages/modules/modules", capability: "modules" },
  { key: "packs", title: "世界包", icon: "package", tone: "green", url: "/pages/packs/packs", capability: "packs" },
  { key: "config", title: "配置", icon: "sliders", tone: "violet", url: "/pages/config/config", capability: "config" },
  { key: "players", title: "玩家与权限", icon: "users", tone: "orange", url: "/pages/players/players", capability: "players" },
  { key: "updates", title: "更新与备份", icon: "download", tone: "teal", url: "/pages/updates/updates", capability: "updates" },
];

function render(state: SessionState) {
  const caps = new Set<string>(state.handshake?.capabilities ?? []);
  const counts: Record<string, string> = {
    modules: state.modules.length ? `${state.modules.filter((row) => row.enabled).length} / ${state.modules.length} 已启用` : "",
    packs: state.packs.length ? `${state.packs.length} 个` : "",
    config: state.configKeys.length ? `${state.configKeys.length} 个文件` : "",
    players: "",
    updates: "",
  };
  return {
    ...connectionView(state),
    hasProfile: Boolean(state.profile),
    endpoint: state.profile?.endpoint ?? "",
    entries: ENTRIES.filter((entry) => state.status === "online" && (caps.size === 0 || caps.has(entry.capability))).map((entry) => ({
      ...entry,
      meta: counts[entry.key] ?? "",
    })),
  };
}

Page({
  data: render(session.state),
  onShow() {
    syncTabBar();
    watchSession(this, ["connection", "modules", "packs", "config"], render);
  },
  onHide() {
    unwatchSession(this);
  },
  onUnload() {
    unwatchSession(this);
  },
  open(event: WechatMiniprogram.TouchEvent) {
    wx.navigateTo({ url: String(event.currentTarget.dataset.url) });
  },
  openInstances() {
    wx.navigateTo({ url: "/pages/instances/instances" });
  },
  async disconnect() {
    if (session.state.status !== "online") {
      void session.reconnect();
      return;
    }
    if (await ask("断开连接？", "服务器和后台任务会继续运行，可随时重新连接。", "断开")) session.disconnect();
  },
});
