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

/**
 * 「任务」入口的角标文字（进行中任务数，对应桌面端侧边栏的任务计数）：离线时不显示，超过 99 显示 99+。
 * 使用场景：管理端底部导航 admin-nav 订阅会话后据此渲染。原生标签栏已归玩家端，管理端不再写原生角标。
 */
export function taskBadgeText(state: SessionState): string {
  const count = state.status === "online" ? activeTasks(state).length : 0;
  if (!count) return "";
  return count > 99 ? "99+" : String(count);
}
