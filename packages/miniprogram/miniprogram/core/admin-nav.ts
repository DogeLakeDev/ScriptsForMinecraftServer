/**
 * admin-nav.ts — 管理端（admin 分包）四个一级页面之间的切换
 *
 * 使用场景：原生标签栏已归玩家端，管理端的「实例 / 控制台 / 任务 / 管理」改由 components/admin-nav 底部导航承担；
 * 页面里原来的 wx.switchTab 也改走这里。切换用 redirectTo 替换当前页，页面栈深度不变，
 * 左上角返回始终回到进入管理端之前的玩家端页面。
 */

/** 管理端一级页面的标识 */
export type AdminTab = "overview" | "console" | "tasks" | "manage";

/** 管理端一级页面定义：顺序即底部导航顺序 */
export const ADMIN_TABS: ReadonlyArray<{ key: AdminTab; text: string; icon: string; url: string }> = [
  { key: "overview", text: "实例", icon: "overview", url: "/admin/pages/overview/overview" },
  { key: "console", text: "控制台", icon: "terminal", url: "/admin/pages/console/console" },
  { key: "tasks", text: "任务", icon: "tasks", url: "/admin/pages/tasks/tasks" },
  { key: "manage", text: "管理", icon: "settings", url: "/admin/pages/manage/manage" },
];

/** 管理端首页地址（玩家端「进入管理端」的目标） */
export const ADMIN_HOME_URL = ADMIN_TABS[0]!.url;

function tabUrl(key: AdminTab): string {
  return (ADMIN_TABS.find((tab) => tab.key === key) ?? ADMIN_TABS[0]!).url;
}

/** 当前页面栈里某个页面对应的一级页面（不是一级页面返回 undefined） */
function tabOfRoute(route: string): AdminTab | undefined {
  return ADMIN_TABS.find((tab) => tab.url === `/${route}`)?.key;
}

/**
 * 从一个一级页面切到另一个一级页面（替换当前页）。
 * 使用场景：底部导航点击、总览页跳转控制台 / 任务。
 */
export function switchAdminTab(key: AdminTab): void {
  const pages = getCurrentPages();
  const current = pages[pages.length - 1];
  if (current && tabOfRoute(current.route) === key) return;
  wx.redirectTo({ url: tabUrl(key) });
}

/**
 * 从管理端二级页面回到某个一级页面（原 wx.switchTab 的语义：关闭中间的二级页面）。
 * 使用场景：切换 / 保存实例后回到「实例」页。栈里没有一级页面时直接打开目标页。
 */
export function returnToAdminTab(key: AdminTab): void {
  const pages = getCurrentPages();
  for (let index = pages.length - 1; index >= 0; index--) {
    const tab = tabOfRoute(pages[index]!.route);
    if (!tab) continue;
    const delta = pages.length - 1 - index;
    const finish = () => {
      if (tab !== key) wx.redirectTo({ url: tabUrl(key) });
    };
    if (delta > 0) wx.navigateBack({ delta, success: finish });
    else finish();
    return;
  }
  wx.navigateTo({ url: tabUrl(key) });
}
