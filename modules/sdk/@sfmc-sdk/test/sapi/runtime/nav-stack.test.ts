import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  popHistory,
  pushOrRewind,
  replaceOrRewind,
  shouldRenderScreen,
} from "../../../src/sapi/runtime/nav-stack.ts";

describe("导航面包屑栈", () => {
  it("前进压栈，回到已访问页则裁掉后面的段", () => {
    assert.deepEqual(pushOrRewind(["home"], "widgets"), ["home", "widgets"]);
    assert.deepEqual(
      pushOrRewind(["home", "widgets", "logic"], "widgets"),
      ["home", "widgets"],
    );
    assert.deepEqual(pushOrRewind(["home", "widgets"], "home"), ["home"]);
  });

  it("replace 目标已在栈中则回退，否则只换栈顶", () => {
    assert.deepEqual(replaceOrRewind(["home", "widgets"], "home"), ["home"]);
    assert.deepEqual(replaceOrRewind(["home", "widgets"], "logic"), [
      "home",
      "logic",
    ]);
  });

  it("back 只弹一层，根页不再弹", () => {
    assert.deepEqual(popHistory(["home", "widgets"]), ["home"]);
    assert.deepEqual(popHistory(["home"]), ["home"]);
  });

  it("当前页面和面包屑中的页面参与构建", () => {
    assert.equal(shouldRenderScreen("home", "detail", ["home", "detail"]), true);
    assert.equal(shouldRenderScreen("detail", "detail", ["home", "detail"]), true);
    assert.equal(shouldRenderScreen("other", "detail", ["home", "detail"]), false);
  });
});
