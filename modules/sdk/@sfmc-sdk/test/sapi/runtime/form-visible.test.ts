import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeSectionVisible } from "../../../src/sapi/runtime/form-visible.ts";

describe("节可见性与控件 visible 合并", () => {
  it("控件显式隐藏时整项隐藏，避免盖掉节切换", () => {
    assert.equal(mergeSectionVisible("section", false), false);
  });

  it("控件未声明或为 true 时沿用节可见性", () => {
    assert.equal(mergeSectionVisible("section", undefined), "section");
    assert.equal(mergeSectionVisible("section", true), "section");
  });
});
