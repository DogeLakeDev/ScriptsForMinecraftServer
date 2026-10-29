/**
 * admin-nav — 管理端底部导航
 *
 * 使用场景：admin 分包的四个一级页面（实例 / 控制台 / 任务 / 管理）底部各放一个 <admin-nav current="…" />，
 * 替代原来的原生标签栏（原生标签栏已归玩家端）。「任务」项显示进行中任务数角标，随会话实时更新。
 * 外观由 components/glass-tab-bar 渲染（与玩家端 custom-tab-bar 同一套 iOS 27 悬浮玻璃标签栏）。
 */
import { ADMIN_TABS, switchAdminTab, type AdminTab } from "../../core/admin-nav";
import { taskBadgeText, unwatchSession, watchSession } from "../../core/page";
import { session } from "../../core/session";
import type { GlassTab } from "../glass-tab-bar/index";

/** 按「任务」角标生成 glass-tab-bar 的标签项（角标只挂在任务项上） */
function adminTabs(taskBadge: string): GlassTab[] {
  return ADMIN_TABS.map(({ key, text, icon }) => ({ key, text, icon, badge: key === "tasks" ? taskBadge : "" }));
}

Component({
  properties: {
    /** 当前所在的一级页面 */
    current: { type: String, value: "overview" },
  },
  data: {
    tabs: adminTabs(""),
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
      watchSession(this, ["tasks", "connection"], (state) => {
        const taskBadge = taskBadgeText(state);
        return { taskBadge, tabs: adminTabs(taskBadge) };
      });
    },
    /** glass-tab-bar 的 select 事件：detail.key 为目标一级页面 */
    open(event: WechatMiniprogram.CustomEvent<{ key: string }>) {
      switchAdminTab(event.detail.key as AdminTab);
    },
  },
});
