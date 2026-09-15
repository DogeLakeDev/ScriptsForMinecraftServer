/**
 * afterNativeDrag 必须晚于当前调用栈，避免在 drop 处理函数里同步改 DOM。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { afterNativeDrag } from "../../ui-studio-web/src/after-drag.ts";

test("afterNativeDrag: 不在当前调用栈执行", async () => {
  let ran = false;
  afterNativeDrag(() => {
    ran = true;
  });
  assert.equal(ran, false);
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
  assert.equal(ran, true);
});
