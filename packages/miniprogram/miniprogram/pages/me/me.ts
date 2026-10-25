/**
 * me — 玩家端「我的」
 *
 * 使用场景：
 * - 微信静默登录（wx.login → 网关换会话），展示绑定的游戏角色、SFMC 等级、余额与在线时长；
 * - 未绑定时申请 6 位绑定码，玩家在游戏内 /c:bind 后在聊天框发送；页面轮询直到绑定完成；
 * - 已绑定时提供「我的行为记录」入口；
 * - 始终显示「进入管理端」：3 级管理员以微信身份管理，其他用户用访问令牌添加 / 管理实例；
 *   管理员还可扫码 / 输入登录码批准桌面端登录。
 */
import { ask, guard } from "../../core/actions";
import { enterAdmin } from "../../core/admin-entry";
import { errorText } from "../../core/format";
import { homePlayerApi, type BindCode, type DeviceRef, type PlayerMe } from "../../core/player-api";
import { HOME_SERVER, hasHomeServer, homeEndpoint } from "../../core/server";
import { parseDeviceLoginLink } from "../../vendor/management";

/** 绑定码有效期内轮询绑定结果的间隔 */
const BIND_POLL_MS = 3000;

/** SFMC 等级的展示文案（与游戏内 Permission 等级一致） */
const LEVEL_LABELS = ["访客", "成员", "OP", "管理员"];

/** 页面计时器（倒计时与绑定轮询共用一个，每秒刷新） */
let ticker: number | null = null;
/** 上次轮询绑定结果的时间 */
let lastPoll = 0;

/** 把 /player/me 的结果转换为页面数据 */
function accountView(me: PlayerMe | null) {
  const profile = me?.profile ?? null;
  return {
    bound: Boolean(me?.bound),
    playerName: me?.player?.name ?? "",
    levelLabel: me?.bound ? (LEVEL_LABELS[me.level] ?? `等级 ${me.level}`) : "",
    isAdmin: Boolean(me?.isAdmin),
    balanceText: profile ? (profile.balance === null ? "暂时读不到" : `${profile.balance} ${profile.unit}`) : "",
    todayText: profile?.today_text ?? "",
    monthText: profile?.month_text ?? "",
    totalText: profile?.total_text ?? "",
  };
}

/** 绑定码剩余时间文案 */
function remainText(expiresAt: number): string {
  const seconds = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
  return `${Math.floor(seconds / 60)} 分 ${String(seconds % 60).padStart(2, "0")} 秒后失效`;
}

Page({
  data: {
    serverName: HOME_SERVER.name,
    configured: hasHomeServer(),
    loading: true,
    error: "",
    ...accountView(null),
    /** 当前有效的绑定码（空表示未申请或已失效） */
    bindCode: "",
    bindExpiresAt: 0,
    bindRemain: "",
    requesting: false,
  },
  onShow() {
    void this.load();
    this.startTicker();
  },
  onHide() {
    this.stopTicker();
  },
  onUnload() {
    this.stopTicker();
  },
  async onPullDownRefresh() {
    await this.load();
    wx.stopPullDownRefresh();
  },

  /** 读取账号信息；失败时页面显示错误与重试 */
  async load() {
    if (!this.data.configured) {
      this.setData({ loading: false, ...accountView(null) });
      return;
    }
    try {
      const me = await homePlayerApi().me();
      this.applyAccount(me);
      this.setData({ loading: false, error: "" });
    } catch (error) {
      this.setData({ loading: false, error: errorText(error), ...accountView(null) });
    }
  },

  /** 应用账号信息；绑定码有效期间检测到已绑定时提示成功并清掉绑定码 */
  applyAccount(me: PlayerMe) {
    const justBound = me.bound && Boolean(this.data.bindCode);
    this.setData({ ...accountView(me), ...(me.bound ? { bindCode: "", bindExpiresAt: 0, bindRemain: "" } : {}) });
    if (justBound) wx.showToast({ title: "绑定成功", icon: "success" });
  },

  startTicker() {
    this.stopTicker();
    ticker = setInterval(() => this.tick(), 1000) as unknown as number;
  },
  stopTicker() {
    if (ticker !== null) clearInterval(ticker);
    ticker = null;
  },
  /** 每秒：刷新倒计时；绑定码有效时按间隔轮询绑定结果，过期后清除 */
  tick() {
    const { bindCode, bindExpiresAt } = this.data;
    if (!bindCode) return;
    if (Date.now() >= bindExpiresAt) {
      this.setData({ bindCode: "", bindExpiresAt: 0, bindRemain: "" });
      return;
    }
    this.setData({ bindRemain: remainText(bindExpiresAt) });
    if (Date.now() - lastPoll < BIND_POLL_MS) return;
    lastPoll = Date.now();
    homePlayerApi()
      .me()
      .then((me) => this.applyAccount(me))
      .catch(() => undefined);
  },

  /** 申请绑定码 */
  async requestBind() {
    if (this.data.requesting) return;
    this.setData({ requesting: true });
    const code: BindCode | undefined = await guard(() => homePlayerApi().requestBind(), "无法获取绑定码");
    this.setData({ requesting: false });
    if (!code) {
      // 可能已在其他设备完成绑定（409），刷新一次
      void this.load();
      return;
    }
    lastPoll = Date.now();
    this.setData({ bindCode: code.code, bindExpiresAt: code.expiresAt, bindRemain: remainText(code.expiresAt) });
  },

  copyBindCode() {
    wx.setClipboardData({ data: this.data.bindCode, success: () => wx.showToast({ title: "已复制绑定码", icon: "none" }) });
  },

  /** 解除微信与游戏账号的绑定 */
  async unbind() {
    if (!(await ask("解除绑定？", `微信将不再关联游戏角色 ${this.data.playerName}，之后可重新绑定。`, "解除绑定", true))) return;
    const done = await guard(() => homePlayerApi().unbind(), "解绑失败");
    if (done === undefined) return;
    wx.showToast({ title: "已解除绑定", icon: "none" });
    void this.load();
  },

  openAdmin() {
    enterAdmin(this.data.isAdmin);
  },

  /** 进入「我的行为记录」 */
  openActivity() {
    wx.navigateTo({ url: "/pages/activity/activity" });
  },

  /** 批准桌面端登录：选择扫码或输入登录码 */
  approveDesktop() {
    wx.showActionSheet({
      itemList: ["扫描桌面端二维码", "输入 6 位登录码"],
      success: ({ tapIndex }) => {
        if (tapIndex === 0) this.scanDesktop();
        else this.enterDesktopCode();
      },
    });
  },

  scanDesktop() {
    wx.scanCode({
      scanType: ["qrCode"],
      success: ({ result }) => {
        const link = parseDeviceLoginLink(result);
        if (!link) {
          wx.showModal({ title: "无法识别", content: "这不是 SFMC 桌面端的登录二维码。", showCancel: false, confirmText: "知道了" });
          return;
        }
        if (link.endpoint.replace(/\/+$/, "") !== homeEndpoint()) {
          wx.showModal({ title: "服务器不一致", content: `二维码来自 ${link.endpoint}，与 ${HOME_SERVER.name} 的地址不同，无法批准。`, showCancel: false, confirmText: "知道了" });
          return;
        }
        void this.confirmDevice({ deviceId: link.deviceId });
      },
    });
  },

  enterDesktopCode() {
    wx.showModal({
      title: "输入登录码",
      editable: true,
      placeholderText: "桌面端显示的 6 位数字",
      confirmText: "下一步",
      success: ({ confirm, content }) => {
        if (!confirm) return;
        const code = String(content ?? "").replace(/\s+/g, "");
        if (!/^\d{6}$/.test(code)) {
          wx.showToast({ title: "请输入 6 位数字", icon: "none" });
          return;
        }
        void this.confirmDevice({ userCode: code });
      },
    });
  },

  /** 查看待授权设备 → 二次确认 → 批准或拒绝 */
  async confirmDevice(ref: DeviceRef) {
    const api = homePlayerApi();
    const pending = await guard(() => api.describeDevice(ref), "找不到登录请求");
    if (!pending) return;
    const allow = await ask(
      "允许桌面端登录？",
      `设备「${pending.name}」将以你的管理员身份管理 ${HOME_SERVER.name}，授权 30 天，可在管理端「已授权设备」中撤销。`,
      "允许",
    );
    const target: DeviceRef = { deviceId: pending.deviceId };
    if (!allow) {
      await guard(() => api.denyDevice(target), "操作失败");
      return;
    }
    const approved = await guard(() => api.approveDevice(target), "批准失败");
    if (approved) wx.showToast({ title: "已批准，桌面端将自动登录", icon: "none" });
  },
});
