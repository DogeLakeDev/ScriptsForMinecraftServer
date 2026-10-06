/**
 * latest-frame.ts — 同一动画帧内多次更新只落地最后一次。
 *
 * Chrome 点击 <input type="range"> 时，会按 step 对从旧值到新值的每一步
 * 都派发 input。金库滑杆 1–100000 一次点击可打出十万次事件；
 * 若每次都进 React setState，页面会卡死。
 */

export interface LatestFrameQueue<T> {
  push(value: T): void;
  dispose(): void;
}

/** 把高频值更新合并到下一帧；同一帧内只应用最后一次。 */
export function createLatestFrameQueue<T>(apply: (value: T) => void): LatestFrameQueue<T> {
  let pending: T | null = null;
  let hasPending = false;
  let frame = 0;
  const tick = () => {
    frame = 0;
    if (!hasPending) return;
    hasPending = false;
    apply(pending as T);
  };
  return {
    push(value) {
      pending = value;
      hasPending = true;
      if (frame) return;
      frame = requestAnimationFrame(tick);
    },
    dispose() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      hasPending = false;
      pending = null;
    },
  };
}
