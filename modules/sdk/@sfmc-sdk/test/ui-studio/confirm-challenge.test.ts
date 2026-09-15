/**
 * 危险确认 challenge 的匹配口径。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  confirmChallengeMatches,
  effectiveConfirmChallenge,
} from "../../src/ui-studio/shared/confirm-challenge.ts";

test("空串与空白视为未启用 challenge", () => {
  assert.equal(effectiveConfirmChallenge(""), undefined);
  assert.equal(effectiveConfirmChallenge("   "), undefined);
  assert.equal(effectiveConfirmChallenge(undefined), undefined);
  assert.equal(effectiveConfirmChallenge("确认退出"), "确认退出");
  assert.equal(effectiveConfirmChallenge("  确认退出  "), "确认退出");
});

test("匹配两端 trim，区分大小写", () => {
  assert.equal(confirmChallengeMatches("确认退出", "确认退出"), true);
  assert.equal(confirmChallengeMatches("  确认退出  ", "确认退出"), true);
  assert.equal(confirmChallengeMatches("确认退出", "  确认退出  "), true);
  assert.equal(confirmChallengeMatches("Confirm", "confirm"), false);
  assert.equal(confirmChallengeMatches("确认", "确认退出"), false);
});
