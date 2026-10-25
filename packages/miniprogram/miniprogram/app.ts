/**
 * app.ts — 小程序入口
 *
 * 使用场景：首页是玩家端，启动时不连接管理通道；进入管理端（admin 分包）时才由 admin-nav 调用
 * session.ensureRestored() 恢复上次连接的实例。切到后台暂停轮询，回到前台时恢复（移动网络在后台会断开 WebSocket）；
 * 未进入过管理端时 resume / pause 都是空操作。
 */
import { session } from "./core/session";

App({
  onShow() {
    session.resume();
  },
  onHide() {
    session.pause();
  },
});
