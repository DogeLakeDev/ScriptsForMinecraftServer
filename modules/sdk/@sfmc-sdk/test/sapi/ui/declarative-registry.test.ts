import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  clearDeclarativeFeatures,
  listDeclarativeEntries,
  registerDeclarativeFeature,
  unregisterDeclarativeFeature,
} from "../../../src/sapi/ui/declarative.ts";

const screen = {
  formatVersion: 1,
  id: "demo.home",
  presentation: "menu",
  title: "首页",
  body: [],
};

function project(target = "demo.home") {
  return {
    feature: {
      formatVersion: 1,
      moduleId: "demo",
      entries: [
        {
          id: "demo.main",
          surface: "player",
          group: "demo",
          title: "示例",
          target,
        },
      ],
      screens: [{ id: "demo.home", file: "screens/home.ui.json" }],
    },
    screens: { "screens/home.ui.json": screen },
  };
}

afterEach(() => clearDeclarativeFeatures());

describe("SDK 声明式 UI registry", () => {
  it("注册前先执行共享工程编译，并公开带 moduleId 的入口", () => {
    const result = registerDeclarativeFeature(project());
    assert.deepEqual(result, { ok: true });
    assert.deepEqual(listDeclarativeEntries(), [
      {
        id: "demo.main",
        surface: "player",
        group: "demo",
        title: "示例",
        target: "demo.home",
        moduleId: "demo",
      },
    ]);
  });

  it("拒绝指向未声明页面的入口，不留下半注册状态", () => {
    const result = registerDeclarativeFeature(project("demo.missing"));
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /未声明页面 demo\.missing/);
    assert.deepEqual(listDeclarativeEntries(), []);
  });

  it("旧注册返回的 cleanup 不能误删同模块的新注册", () => {
    const first = project();
    const second = project();
    assert.equal(registerDeclarativeFeature(first).ok, true);
    assert.equal(registerDeclarativeFeature(second).ok, true);
    assert.deepEqual(
      unregisterDeclarativeFeature("demo", first.feature),
      { ok: false },
    );
    assert.equal(listDeclarativeEntries().length, 1);
  });
});
