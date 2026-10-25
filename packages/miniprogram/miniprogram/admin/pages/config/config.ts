/**
 * config — 配置文件列表
 *
 * 使用场景：按「核心配置 / BDS / 各模块」分组列出 config.list 返回的可编辑配置，点击进入纯文本编辑页。
 * 配置修改后由「重启服务」按钮手动生效（同桌面端 ConfigPage）。
 */
import { guard, restartBlockReason, restartServices } from "../../../core/actions";
import { describeKey } from "../../../core/config-keys";
import { connectionView, unwatchSession, watchSession } from "../../../core/page";
import { session, type SessionState } from "../../../core/session";

/** 页面状态（不放进 data） */
const view = { filter: "" };

function render(state: SessionState) {
  const names = new Map(state.modules.map((row) => [row.id, row.name]));
  const needle = view.filter.trim().toLowerCase();
  const groups = new Map<string, { key: string; title: string; file: string; icon: string }[]>();
  for (const key of state.configKeys) {
    const info = describeKey(key, names);
    if (needle && !`${key} ${info.title} ${info.group}`.toLowerCase().includes(needle)) continue;
    groups.set(info.group, [...(groups.get(info.group) ?? []), { key, ...info }]);
  }
  return {
    ...connectionView(state),
    manualRestart: session.can("manual-restart"),
    restartReason: restartBlockReason("all"),
    filter: view.filter,
    total: state.configKeys.length,
    groups: [...groups.entries()].map(([name, rows]) => ({ name, rows })),
  };
}

Page({
  data: render(session.state),
  onShow() {
    watchSession(this, ["connection", "config", "modules", "tasks", "services"], render);
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
  onFilter(event: WechatMiniprogram.Input) {
    view.filter = event.detail.value;
    this.setData(render(session.state));
  },
  open(event: WechatMiniprogram.TouchEvent) {
    wx.navigateTo({ url: `/admin/pages/config-edit/config-edit?key=${encodeURIComponent(String(event.currentTarget.dataset.key))}` });
  },
  restart() {
    restartServices(this, "all");
  },
});
