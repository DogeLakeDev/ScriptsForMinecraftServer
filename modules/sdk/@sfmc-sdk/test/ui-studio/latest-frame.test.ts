/**
 * 同一动画帧合并队列：高频 range input 不得每步都进 React。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createLatestFrameQueue } from "../../ui-studio-web/src/latest-frame.ts";

test("latest-frame: 同一帧多次 push 只应用最后一次", () => {
  const frames: Array<(time: number) => void> = [];
  const raf = globalThis.requestAnimationFrame;
  const caf = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    frames.push(cb);
    return frames.length;
  }) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((id: number) => {
    frames[id - 1] = () => {};
  }) as typeof cancelAnimationFrame;
  try {
    const applied: number[] = [];
    const queue = createLatestFrameQueue((value: number) => applied.push(value));
    queue.push(1);
    queue.push(2);
    queue.push(99999);
    assert.deepEqual(applied, []);
    assert.equal(frames.length, 1);
    frames[0]!(0);
    assert.deepEqual(applied, [99999]);
    queue.push(7);
    frames[1]!(0);
    assert.deepEqual(applied, [99999, 7]);
    queue.dispose();
  } finally {
    globalThis.requestAnimationFrame = raf;
    globalThis.cancelAnimationFrame = caf;
  }
});
