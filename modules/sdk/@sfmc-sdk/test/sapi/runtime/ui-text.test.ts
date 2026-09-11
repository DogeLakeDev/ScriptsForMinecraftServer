import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { stripDduiButtonFormatting } from "../../../src/sapi/runtime/ui-text.ts";

describe("DDUI 按钮文字", () => {
  it("移除颜色、样式和重置格式码", () => {
    assert.equal(stripDduiButtonFormatting("§l§e综合服务 §7[打开]§r"), "综合服务 [打开]");
  });

  it("保留普通文字与符号", () => {
    assert.equal(stripDduiButtonFormatting("← 回到上一级"), "← 回到上一级");
  });
});
