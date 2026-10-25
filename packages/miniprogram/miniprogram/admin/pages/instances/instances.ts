/**
 * instances — 实例列表
 *
 * 使用场景：切换当前管理的实例、进入新增 / 编辑。点击实例即连接并回到首页（小程序同一时间只连接一个实例）。
 */
import { isWechatProfile, listProfiles } from "../../../core/profiles";
import { unwatchSession, watchSession } from "../../../core/page";
import { connectionLabel, session, type SessionState } from "../../../core/session";
import { returnToAdminTab } from "../../../core/admin-nav";

function render(state: SessionState) {
  const label = connectionLabel(state);
  return {
    profiles: listProfiles().map((profile) => {
      const current = state.profile?.id === profile.id;
      return {
        id: profile.id,
        name: profile.name,
        endpoint: profile.endpoint,
        /** 微信身份档案（无令牌，网关按绑定账号等级鉴权） */
        wechat: isWechatProfile(profile),
        current,
        tone: current ? label.tone : "neutral",
        label: current ? label.label : "",
      };
    }),
  };
}

Page({
  data: render(session.state),
  onShow() {
    watchSession(this, ["connection"], render);
  },
  onHide() {
    unwatchSession(this);
  },
  onUnload() {
    unwatchSession(this);
  },
  select(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id);
    const profile = listProfiles().find((row) => row.id === id);
    if (!profile) return;
    if (session.state.profile?.id !== id || session.state.status !== "online") void session.connect(profile);
    returnToAdminTab("overview");
  },
  edit(event: WechatMiniprogram.TouchEvent) {
    wx.navigateTo({ url: `/admin/pages/instance-edit/instance-edit?id=${encodeURIComponent(String(event.currentTarget.dataset.id))}` });
  },
  add() {
    wx.navigateTo({ url: "/admin/pages/instance-edit/instance-edit" });
  },
});
