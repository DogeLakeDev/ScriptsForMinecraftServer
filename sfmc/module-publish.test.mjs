/**
 * module-publish.test.mjs — sfmc mod publish 纯函数表驱动
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  parsePublishFlags,
  bumpSemver,
  translateNpmPublishError,
  defaultScopeFor,
  runPrecheck,
} from "./dist/module-publish.js";

test("parsePublishFlags 默认", () => {
  const f = parsePublishFlags([]);
  assert.equal(f.dryRun, false);
  assert.equal(f.bump, null);
  assert.equal(f.scope, null);
  assert.equal(f.skipIndexPr, false);
  assert.equal(f.tag, "latest");
  assert.equal(f.access, "public");
});

test("parsePublishFlags 全开", () => {
  const f = parsePublishFlags(["--dry-run", "--bump", "patch", "--scope", "@alice", "--skip-index-pr", "--tag", "beta", "--access", "restricted"]);
  assert.equal(f.dryRun, true);
  assert.equal(f.bump, "patch");
  assert.equal(f.scope, "@alice");
  assert.equal(f.skipIndexPr, true);
  assert.equal(f.tag, "beta");
  assert.equal(f.access, "restricted");
});

test("parsePublishFlags 等号写法", () => {
  const f = parsePublishFlags(["--bump=major", "--access=public"]);
  assert.equal(f.bump, "major");
  assert.equal(f.access, "public");
});

test("bumpSemver 三级", () => {
  assert.equal(bumpSemver("1.2.3", "patch", null), "1.2.4");
  assert.equal(bumpSemver("1.2.3", "minor", null), "1.3.0");
  assert.equal(bumpSemver("1.2.3", "major", null), "2.0.0");
  assert.equal(bumpSemver("0.0.9", "patch", null), "0.0.10");
});

test("bumpSemver custom + 含预发布", () => {
  assert.equal(bumpSemver("1.2.3", "custom", "2.0.0-rc.1"), "2.0.0-rc.1");
  assert.throws(() => bumpSemver("1.2.3", "custom", "not-semver"), /invalid custom version/);
});

test("translateNpmPublishError 主要场景", () => {
  assert.match(translateNpmPublishError("@a/foo", "ENEEDAUTH Not logged in"), /未登录 npm/);
  assert.match(translateNpmPublishError("@a/foo", "EOTP"), /2FA 码/);
  assert.match(translateNpmPublishError("@a/foo", "Confirm email address"), /邮箱确认/);
  assert.match(translateNpmPublishError("@a/foo", "You do not have permission to publish"), /无权限/);
  assert.match(translateNpmPublishError("@a/foo", "402 Payment Required"), /私有包需要付费/);
  assert.match(translateNpmPublishError("@a/foo", "Package name too similar"), /包名太接近/);
  assert.match(translateNpmPublishError("@a/foo", "ERESOLVE"), /依赖冲突/);
  assert.match(translateNpmPublishError("@a/foo", "ETIMEDOUT"), /npm 网络错误/);
  /* 未知错误 → 透传 */
  const r = translateNpmPublishError("@a/foo", "something weird");
  assert.match(r, /\[publish\]/);
  assert.match(r, /something weird/);
});

test("runPrecheck 给完整包打分", async () => {
  const cwd = await import("node:path").then((m) => m.resolve("..", ".."));
  /* 用真实模板仓路径会触发 npm 失败；这里只断言 runPrecheck 不抛错 + 返回 shape */
  const r = await runPrecheck(cwd);
  assert.ok(Array.isArray(r.warnings));
  assert.ok(Array.isArray(r.errors));
  assert.ok(Array.isArray(r.tarballFiles));
  assert.equal(typeof r.ok, "boolean");
});

test("defaultScopeFor 去掉 @ 前缀", () => {
  assert.equal(defaultScopeFor("@alice"), "alice");
  assert.equal(defaultScopeFor("alice"), "alice");
});