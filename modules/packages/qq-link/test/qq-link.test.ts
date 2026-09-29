/**
 * test/qq-link.test.ts — qq-link 纯逻辑与元数据校验
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  BIND_GATE_PROMPT,
  heldRoleFromLevel,
  movedTooFar,
  permissionCommand,
  shouldPrompt,
} from "../sapi/src/play-gate-policy.ts";
import { formatConfirmError } from "../sapi/src/util.ts";

const MANIFEST_PATH = fileURLToPath(new URL("../sapi/manifest.json", import.meta.url));

function readManifest(): {
  id: string;
  configKey: string;
  permissions?: string[];
} {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as {
    id: string;
    configKey: string;
    permissions?: string[];
  };
}

describe("qq-link metadata & logic", () => {
  it("manifest 契约声明校验", () => {
    const manifest = readManifest();
    assert.equal(manifest.id, "feature-qq-link");
    assert.equal(manifest.configKey, "qq_link");
    assert.match(manifest.id, /^feature-[a-z][a-z0-9]*(-[a-z0-9]+)*$/);
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
