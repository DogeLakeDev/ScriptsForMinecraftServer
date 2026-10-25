/**
 * app.ts — 小程序入口
 *
 * 使用场景：启动时恢复上次连接的实例；切到后台暂停轮询，回到前台时恢复（移动网络在后台会断开 WebSocket）。
 */
import { session } from "./core/session";

App({
  onLaunch() {
    session.restore();
  },
  onShow() {
    session.resume();
  },
  onHide() {
    session.pause();
  },
});
