/**
 * home — 玩家端首页
 *
 * 使用场景：展示服务器名称、运行状态（在线人数 / TPS / 运行时长 / 版本）、加入地址（已绑定时）、
 * 在线玩家头像条、入服公告，以及绑定入口。数据来自 GET /server/status 与 /server/notice。
 */
import { errorText, hashHue } from "../../core/format";
import { homePlayerApi, type PlayerMe, type ServerNotice, type ServerStatus } from "../../core/player-api";
import { selectPlayerTab } from "../../core/player-tabs";
import { HOME_SERVER, hasHomeServer } from "../../core/server";

/** 头像条上的一名在线玩家（仅名字；色相与地图气泡一致） */
interface OnlineChip {
  name: string;
  initial: string;
  hue: number;
}

/** 把状态与公告整理成页面 data 片段 */
function homeView(status: ServerStatus | null, notice: ServerNotice | null, me: PlayerMe | null) {
  const onlinePlayers: OnlineChip[] = (status?.onlineNames ?? []).map((name) => ({
    name,
    initial: name.slice(0, 1).toUpperCase() || "?",
    hue: hashHue(name),
  }));
  const noticeOn = Boolean(notice?.enabled && (notice.title || notice.content));
  return {
    bound: Boolean(me?.bound),
    running: Boolean(status?.running),
    onlineCount: status?.onlineCount ?? 0,
    tpsText: status?.tps === null || status?.tps === undefined ? "—" : String(status.tps),
    uptimeText: status?.uptimeText || "—",
    version: status?.version || "",
    joinAddress: status?.joinAddress || "",
    onlinePlayers,
    noticeOn,
    noticeTitle: notice?.title || "公告",
    noticeContent: notice?.content || "",
  };
}

Page({
  data: {
    serverName: HOME_SERVER.name,
    configured: hasHomeServer(),
    loading: true,
    error: "",
    ...homeView(null, null, null),
  },
  onShow() {
    selectPlayerTab(this);
    void this.load();
  },
  async onPullDownRefresh() {
    await this.load();
    wx.stopPullDownRefresh();
  },

  /** 并行拉取状态、公告与绑定信息；未配置地址时只显示提示 */
  async load() {
    if (!this.data.configured) {
      this.setData({ loading: false, ...homeView(null, null, null) });
      return;
    }
    try {
      const api = homePlayerApi();
      const [status, notice, me] = await Promise.all([api.serverStatus(), api.serverNotice(), api.me().catch(() => null)]);
      this.setData({ loading: false, error: "", ...homeView(status, notice, me) });
    } catch (error) {
      this.setData({ loading: false, error: errorText(error), ...homeView(null, null, null) });
    }
  },

  /** 复制加入地址到剪贴板 */
  copyJoinAddress() {
    const address = this.data.joinAddress;
    if (!address) return;
    wx.setClipboardData({ data: address, success: () => wx.showToast({ title: "已复制加入地址", icon: "none" }) });
  },

  /** 头像条点按 → 地图页看在线位置 */
  openMap() {
    wx.switchTab({ url: "/pages/map/map" });
  },

  /** 绑定入口 / 已绑定快捷入口 →「我的」 */
  openMe() {
    wx.switchTab({ url: "/pages/me/me" });
  },
});
