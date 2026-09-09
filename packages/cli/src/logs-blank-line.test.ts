/**
 * BDS 排版空行契约：剥离其自带时间戳和等级后为空的行不得进入统一日志。
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeBdsLogBody } from "./logs.js";

describe("BDS 空日志正文", () => {
  it("过滤纯空白以及仅含 BDS 前缀的行", () => {
    assert.equal(normalizeBdsLogBody("\r"), null);
    assert.equal(normalizeBdsLogBody("[2026-09-09 18:07:44:123 INFO]   \r"), null);
  });

  it("剥离前缀后保留真实正文", () => {
    assert.equal(
      normalizeBdsLogBody("[2026-09-09 18:07:44:123 WARN] [Scripting] farmersdelight:cutting_board_recipe"),
      "[Scripting] farmersdelight:cutting_board_recipe"
    );
  });
});
