/**
 * page.ts — 页面 / 组件与会话状态的绑定工具
 *
 * 使用场景：页面在 onShow 调用 watchSession 订阅需要的状态片段，onHide / onUnload 调用 unwatchSession；
 * 隐藏的页面不再 setData，回到前台时重新渲染一次。组件在 attached / detached 中同样使用。
 */
import { activeTasks, connectionLabel, session, type SessionState, type Slice } from "./session";

/** 可以 setData 的宿主（页面或组件实例） */
interface Host {
  setData(data: Record<string, unknown>): void;
}

/** 宿主 → 取消订阅函数 */
const bindings = new WeakMap<object, () => void>();

/**
 * 订阅会话状态：立即渲染一次，之后在所列片段变化时重新渲染。
 * render 返回要 setData 的数据；返回 undefined 表示本次不更新。
 */
export function watchSession(host: Host, slices: Slice[], render: (state: SessionState) => Record<string, unknown> | undefined): void {
  unwatchSession(host);
  const wanted = new Set(slices);
  const run = (state: SessionState) => {
    const data = render(state);
    if (data) host.setData(data);
  };
  run(session.state);
  bindings.set(
    host,
    session.subscribe((state, changed) => {
      for (const slice of changed) {
        if (wanted.has(slice)) {
          run(state);
          return;
        }
      }
    }),
  );
}

/** 取消订阅 */
export function unwatchSession(host: object): void {
  bindings.get(host)?.();
  bindings.delete(host);
}

/**
 * 页面通用的连接字段，所有页面的 render 都可展开它。
 * 使用场景：按钮的禁用态（editable）、页面副标题中的实例名、只读提示。
 */
export function connectionView(state: SessionState) {
  const label = connectionLabel(state);
  return {
    online: state.status === "online",
    editable: session.editable,
    instanceName: state.profile?.name ?? "",
    connTone: label.tone,
    connLabel: label.label,
  };
}

/**
 * 待控制台定位的日志时间。
 * 使用场景：总览页点击告警后写入，控制台 onShow 读取一次后清空并定位到该条（对应桌面端 openLog）。
 */
export const consoleFocus = { at: "" };

/** 「任务」在 app.json tabBar.list 中的下标，调整标签顺序时需同步修改 */
const TASKS_TAB_INDEX = 2;

/** 任务标签角标的当前文字（进行中任务数），空串表示不显示 */
let taskBadge = "";
/** 是否已订阅会话的任务变化（首次进入标签页时开始，之后常驻） */
let taskBadgeWatching = false;

/** 由会话状态计算角标文字：离线时不显示，超过 99 显示 99+ */
function taskBadgeText(state: SessionState): string {
  const count = state.status === "online" ? activeTasks(state).length : 0;
  if (!count) return "";
  return count > 99 ? "99+" : String(count);
}

/**
 * 把角标写到原生标签栏。
 * 当前页不是标签页时微信会返回失败，忽略即可：回到任意标签页时 syncTabBar 会再写一次。
 */
function applyTaskBadge(): void {
  const ignore = () => {};
  if (taskBadge) wx.setTabBarBadge({ index: TASKS_TAB_INDEX, text: taskBadge, fail: ignore });
  else wx.removeTabBarBadge({ index: TASKS_TAB_INDEX, fail: ignore });
}

/**
 * 同步原生标签栏的任务角标（对应桌面端侧边栏的任务计数）。
 * 使用场景：四个标签页在 onShow 中调用；首次调用时订阅会话的任务与连接变化，之后数量变化即时更新。
 */
export function syncTabBar(): void {
  if (!taskBadgeWatching) {
    taskBadgeWatching = true;
    taskBadge = taskBadgeText(session.state);
    session.subscribe((state, changed) => {
      if (!changed.has("tasks") && !changed.has("connection")) return;
      const text = taskBadgeText(state);
      if (text === taskBadge) return;
      taskBadge = text;
      applyTaskBadge();
    });
  }
  applyTaskBadge();
}
