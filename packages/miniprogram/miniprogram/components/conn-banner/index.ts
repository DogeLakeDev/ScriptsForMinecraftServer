/**
 * conn-banner — 连接状态提示
 *
 * 使用场景：所有需要连接的页面顶部放一个 <conn-banner />。连接正常时不占位；
 * 未添加实例、连接中、断开、旧版只读、未初始化时给出说明和下一步操作。
 */
import { session, type SessionState } from "../../core/session";
import { unwatchSession, watchSession } from "../../core/page";

/** 提示种类 */
type BannerKind = "ok" | "none" | "connecting" | "offline" | "legacy" | "uninitialized";

/** 由会话状态推导提示种类 */
function bannerKind(state: SessionState): BannerKind {
  if (!state.profile) return "none";
  if (state.status === "connecting") return "connecting";
  if (state.status !== "online" || !state.handshake) return "offline";
  if (state.handshake.legacy) return "legacy";
  if (!state.handshake.initialized) return "uninitialized";
  return "ok";
}

Component({
  data: { kind: "ok" as BannerKind, name: "", message: "" },
  lifetimes: {
    attached() {
      watchSession(this, ["connection"], (state) => ({ kind: bannerKind(state), name: state.profile?.name ?? "", message: state.message }));
    },
    detached() {
      unwatchSession(this);
    },
  },
  methods: {
    reconnect() {
      void session.reconnect();
    },
    openInstances() {
      wx.navigateTo({ url: "/admin/pages/instances/instances" });
    },
    addInstance() {
      wx.navigateTo({ url: "/admin/pages/instance-edit/instance-edit" });
    },
  },
});
