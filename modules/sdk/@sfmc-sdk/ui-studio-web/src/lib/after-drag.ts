/**
 * after-drag.ts — 把回调排到 HTML5 拖放会话结束之后。
 *
 * drop 里同步改 DOM（尤其是空 body 插入新的 draggable 节点）时，
 * Chrome 可能不再派发 dragend，系统光标一直保持「握住」，
 * 同时画布 is-dnd 不撤，控件 pointer-events:none，页面像卡住。
 * 当前用途：画布 performDrop 推迟 insert/move，让 drop 与 dragend 先走完。
 */

/** 在当前拖放事件栈（drop → dragend）之后的下一个宏任务执行。 */
export function afterNativeDrag(run: () => void): void {
  setTimeout(run, 0);
}
