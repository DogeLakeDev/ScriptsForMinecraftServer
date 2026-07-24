/**
 * version-policy 纯逻辑测试（无构建依赖）
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

function compareSemVer3(a, b) {
  for (let i = 0; i < 3; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

function decideVersionPolicy(localBp, remoteBp, policy) {
  const remoteNewer = compareSemVer3(remoteBp, localBp) > 0;
  const majorHigher = remoteBp[0] > localBp[0];
  let shouldBumpRp = false;
  if (remoteNewer && policy.onUpdateOverwriteBoth) {
    if (majorHigher && policy.majorHigherSkipRpBump) shouldBumpRp = false;
    else if (policy.rpBumpWhenSameMajor) shouldBumpRp = true;
  }
  return { remoteNewer, majorHigher, shouldBumpRp };
}

function nextVersionGreaterThan(current, floor, component = "patch") {
  let next =
    component === "minor"
      ? [current[0], current[1] + 1, 0]
      : [current[0], current[1], current[2] + 1];
  while (compareSemVer3(next, floor) <= 0) {
    if (component === "minor") next = [next[0], next[1] + 1, 0];
    else next = [next[0], next[1], next[2] + 1];
  }
  return next;
}

function normalizePackSearchName(name, stripFolderTags = true) {
  let s = String(name ?? "");
  s = s.replace(/§[0-9a-zA-Z]/g, "");
  if (stripFolderTags) s = s.replace(/\[[^\]]*]/g, " ");
  s = s.replace(/\.(zip|mcpack|mcaddon)$/i, "");
  return s.replace(/\s+/g, " ").trim();
}

describe("version-policy", () => {
  it("同 major 更新应 bump RP", () => {
    const d = decideVersionPolicy([1, 21, 100], [1, 21, 110], {
      onUpdateOverwriteBoth: true,
      rpBumpWhenSameMajor: true,
      majorHigherSkipRpBump: true,
    });
    assert.equal(d.remoteNewer, true);
    assert.equal(d.majorHigher, false);
    assert.equal(d.shouldBumpRp, true);
  });

  it("major 更高则不额外 bump RP", () => {
    const d = decideVersionPolicy([1, 21, 100], [2, 0, 0], {
      onUpdateOverwriteBoth: true,
      rpBumpWhenSameMajor: true,
      majorHigherSkipRpBump: true,
    });
    assert.equal(d.majorHigher, true);
    assert.equal(d.shouldBumpRp, false);
  });

  it("nextVersionGreaterThan", () => {
    assert.deepEqual(nextVersionGreaterThan([1, 0, 5], [1, 0, 8], "patch"), [1, 0, 9]);
  });

  it("normalize 去掉方括号标签", () => {
    const n = normalizePackSearchName("[BA] [玩法] Slash Blade v4 BP");
    assert.match(n, /Slash Blade/i);
    assert.ok(!n.includes("["));
  });
});
