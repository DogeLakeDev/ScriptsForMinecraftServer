/**
 * qq-link.test.ts — 平台 QQ 绑定纯逻辑单测
 *
 * 原 modules/packages/qq-link/test 迁入；不依赖 @minecraft/server。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BIND_GATE_PROMPT,
  heldRoleFromLevel,
  movedTooFar,
  permissionCommand,
  shouldPrompt,
} from "./play-gate-policy.js";
import { formatConfirmError } from "./util.js";
import { isRetiredPlatformModule } from "../../../contracts/platform-capabilities.js";

describe("platform qq-link logic", () => {
  it("qq-link / feature-qq-link 已列入退役清单", () => {
    assert.equal(isRetiredPlatformModule("qq-link"), true);
    assert.equal(isRetiredPlatformModule("feature-qq-link"), true);
    assert.equal(isRetiredPlatformModule("monitor"), true);
    assert.equal(isRetiredPlatformModule("afk"), false);
  });

  it("formatConfirmError 覆盖常见码", () => {
    assert.match(formatConfirmError("invalid_code"), /无效/);
    assert.match(formatConfirmError("code_expired"), /过期/);
    assert.match(formatConfirmError("qq_already_bound"), /已绑定/);
    assert.match(formatConfirmError("player_already_bound"), /已绑定/);
    assert.match(formatConfirmError("network_error"), /无法连接/);
    assert.equal(formatConfirmError("unknown_x"), "绑定失败，请稍后重试");
  });

  it("绑定白名单：操作员还原，其余成员，未绑定提示与走位阈值", () => {
    assert.equal(heldRoleFromLevel(2), "operator");
    assert.equal(heldRoleFromLevel(1), "member");
    assert.equal(heldRoleFromLevel(0), "member");
    assert.equal(permissionCommand('Steve "x"', "visitor"), 'permission set "Steve x" visitor');
    assert.equal(permissionCommand("Alex", "operator"), 'permission set "Alex" operator');
    assert.equal(shouldPrompt(0, 14_999), false);
    assert.equal(shouldPrompt(0, 15_000), true);
    assert.equal(movedTooFar(0.1, 0, 0), false);
    assert.equal(movedTooFar(0.3, 0, 0), true);
    assert.match(BIND_GATE_PROMPT, /\/c:bind/);
    assert.match(BIND_GATE_PROMPT, /访客/);
  });
});
