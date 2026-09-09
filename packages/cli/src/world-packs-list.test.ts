/**
 * packs list 展示契约：未绑定更新源时不输出无意义的 src=- 列。
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldDisplayPackSourceLabel } from "./world-packs.js";

describe("packs list 更新源列", () => {
  it("隐藏未绑定占位符，保留已绑定与已停用来源", () => {
    assert.equal(shouldDisplayPackSourceLabel("src=-"), false);
    assert.equal(shouldDisplayPackSourceLabel("src=CF:farmers-delight"), true);
    assert.equal(shouldDisplayPackSourceLabel("src=CF:farmers-delight:off"), true);
  });
});
