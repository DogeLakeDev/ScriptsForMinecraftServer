/**
 * admin-nav — 管理端底部导航
 *
 * 使用场景：admin 分包的四个一级页面（实例 / 控制台 / 任务 / 管理）底部各放一个 <admin-nav current="…" />，
 * 替代原来的原生标签栏（原生标签栏已归玩家端）。「任务」项显示进行中任务数角标，随会话实时更新。
 */
import { ADMIN_TABS, switchAdminTab, type AdminTab } from "../../core/admin-nav";
import { taskBadgeText, unwatchSession, watchSession } from "../../core/page";
import { session } from "../../core/session";

Component({
  properties: {
    /** 当前所在的一级页面 */
    current: { type: String, value: "overview" },
  },
  data: {
    tabs: ADMIN_TABS.map(({ key, text, icon }) => ({ key, text, icon })),
    taskBadge: "",
  },
  lifetimes: {
    attached() {
      // 管理端没有独立的入口页：任一一级页面挂载导航时，按需恢复上次连接的实例
      session.ensureRestored();
      this.watch();
    },
    detached() {
      unwatchSession(this);
    },
  },
  pageLifetimes: {
    // 所在页面被二级页面盖住时不再 setData，回来时重新订阅（与 core/page.ts 的页面约定一致）
    show() {
      this.watch();
    },
    hide() {
      unwatchSession(this);
    },
  },
  methods: {
    watch() {
      watchSession(this, ["tasks", "connection"], (state) => ({ taskBadge: taskBadgeText(state) }));
    },
    open(event: WechatMiniprogram.TouchEvent) {
      switchAdminTab(String(event.currentTarget.dataset.key) as AdminTab);
    },
  },
});
