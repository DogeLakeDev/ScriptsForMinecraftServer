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
import { BIND_CONFIRM_PATH, confirmBindWithFallback, formatConfirmError, LEGACY_QQ_CONFIRM_PATH } from "./util.js";
import { effectivePermissionLevel, nativeLevelFromBdsPermission } from "../../../contracts/permission-level.js";
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

  it("formatConfirmError 覆盖微信渠道错误码", () => {
    assert.match(formatConfirmError("wechat_already_bound"), /微信已绑定/);
    assert.match(formatConfirmError("player_already_bound_wechat"), /已绑定其他微信/);
  });

  it("confirmBindWithFallback：统一入口成功时带回渠道", async () => {
    const calls: string[] = [];
    const result = await confirmBindWithFallback(async (path) => {
      calls.push(path);
      return { ok: true, status: 200, data: { provider: "wechat" } };
    });
    assert.deepEqual(calls, [BIND_CONFIRM_PATH]);
    assert.deepEqual(result, { ok: true, provider: "wechat" });
  });

  it("confirmBindWithFallback：旧版 db-server（404 not_found / 401 unauthorized）回退 QQ 接口", async () => {
    for (const first of [
      { ok: false, status: 404, error: "not_found" },
      { ok: false, status: 401, error: "unauthorized" },
    ]) {
      const calls: string[] = [];
      const result = await confirmBindWithFallback(async (path) => {
        calls.push(path);
        return path === BIND_CONFIRM_PATH ? first : { ok: true, status: 200 };
      });
      assert.deepEqual(calls, [BIND_CONFIRM_PATH, LEGACY_QQ_CONFIRM_PATH]);
      assert.deepEqual(result, { ok: true, provider: "qq" });
    }
  });

  it("confirmBindWithFallback：业务错误不回退", async () => {
    const calls: string[] = [];
    const result = await confirmBindWithFallback(async (path) => {
      calls.push(path);
      return { ok: false, status: 400, error: "invalid_code" };
    });
    assert.deepEqual(calls, [BIND_CONFIRM_PATH]);
    assert.equal(result.ok, false);
    assert.equal(result.error, "invalid_code");
  });

  it("effectivePermissionLevel：覆盖值优先，否则映射原生等级，缺省成员", () => {
    assert.equal(effectivePermissionLevel(3, 0), 3);
    assert.equal(effectivePermissionLevel(0, 2), 0);
    assert.equal(effectivePermissionLevel(undefined, 0), 0);
    assert.equal(effectivePermissionLevel(undefined, 2), 2);
    assert.equal(effectivePermissionLevel(undefined, 3), 3);
    assert.equal(effectivePermissionLevel(undefined, undefined), 1);
    assert.equal(nativeLevelFromBdsPermission("operator"), 2);
    assert.equal(nativeLevelFromBdsPermission("VISITOR"), 0);
    assert.equal(nativeLevelFromBdsPermission("bogus"), undefined);
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
