// @ts-check
/**
 * module-publish.test.mjs — sfmc mod publish 纯函数表驱动
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  parsePublishFlags,
  bumpSemver,
  translateNpmPublishError,
  defaultScopeFor,
  runPrecheck,
  splitOwnerRepo,
  indexEntryFor,
  patchIndexFile,
  openIndexPr,
  DEFAULT_GH_REPO,
} from "./dist/module-publish.js";

test("parsePublishFlags 默认", () => {
  const f = parsePublishFlags([]);
  assert.equal(f.dryRun, false);
  assert.equal(f.bump, null);
  assert.equal(f.scope, null);
  assert.equal(f.skipIndexPr, false);
  assert.equal(f.tag, "latest");
  assert.equal(f.access, "public");
  assert.equal(f.ghRepo, DEFAULT_GH_REPO);
  assert.equal(f.ghPush, false);
});

test("parsePublishFlags 全开", () => {
  const f = parsePublishFlags(["--dry-run", "--bump", "patch", "--scope", "@alice", "--skip-index-pr", "--tag", "beta", "--access", "restricted", "--gh-repo", "me/repo", "--gh-push", "--gh-fork-remote", "myfork"]);
  assert.equal(f.dryRun, true);
  assert.equal(f.bump, "patch");
  assert.equal(f.scope, "@alice");
  assert.equal(f.skipIndexPr, true);
  assert.equal(f.tag, "beta");
  assert.equal(f.access, "restricted");
  assert.equal(f.ghRepo, "me/repo");
  assert.equal(f.ghPush, true);
  assert.equal(f.ghForkRemote, "myfork");
});

test("parsePublishFlags 等号写法", () => {
  const f = parsePublishFlags(["--bump=major", "--access=public", "--gh-repo=foo/bar"]);
  assert.equal(f.bump, "major");
  assert.equal(f.access, "public");
  assert.equal(f.ghRepo, "foo/bar");
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
  const r = translateNpmPublishError("@a/foo", "something weird");
  assert.match(r, /\[publish\]/);
  assert.match(r, /something weird/);
});

test("defaultScopeFor 去掉 @ 前缀", () => {
  assert.equal(defaultScopeFor("@alice"), "alice");
  assert.equal(defaultScopeFor("alice"), "alice");
});

test("splitOwnerRepo 解析合法/非法", () => {
  assert.deepEqual(splitOwnerRepo("Tanya7z/sfmc-modules"), ["Tanya7z", "sfmc-modules"]);
  assert.deepEqual(splitOwnerRepo("foo.bar/baz-qux"), ["foo.bar", "baz-qux"]);
  assert.equal(splitOwnerRepo("no-slash"), null);
  assert.equal(splitOwnerRepo("a/b/c"), null);
});

test("indexEntryFor 派生 id 兼容 module-/sfmc-module-", () => {
  const a = indexEntryFor("@sfmc-bds/module-land", "1.2.3");
  assert.equal(a.id, "land");
  assert.equal(a.npm, "@sfmc-bds/module-land");
  assert.equal(a.version, "1.2.3");
  assert.equal(a.sdk, ">=0.2.0");

  const b = indexEntryFor("@alice/sfmc-module-foo", "2.0.0");
  assert.equal(b.id, "foo");
  assert.equal(b.npm, "@alice/sfmc-module-foo");

  const c = indexEntryFor("@scope/land", "0.1.0");
  assert.equal(c.id, "land");
  assert.equal(c.npm, "@scope/land");
});

test("patchIndexFile 缺文件 → 创建 map", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "sfmc-idx-"));
  const file = path.join(tmp, "index.json");
  const r = await patchIndexFile(file, indexEntryFor("@sfmc-bds/module-land", "1.0.0"));
  assert.equal(r.ok, true);
  const json = JSON.parse(await fs.readFile(file, "utf8"));
  assert.equal(json.version, 2);
  assert.equal(json.modules.land.npm, "@sfmc-bds/module-land");
  assert.equal(json.modules.land.version, "1.0.0");
  await fs.rm(tmp, { recursive: true, force: true });
});

test("patchIndexFile 追加并按 id 排序", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "sfmc-idx-"));
  const file = path.join(tmp, "index.json");
  await patchIndexFile(file, indexEntryFor("@sfmc-bds/module-land", "1.0.0"));
  await patchIndexFile(file, indexEntryFor("@sfmc-bds/module-afk", "0.9.0"));
  await patchIndexFile(file, indexEntryFor("@sfmc-bds/module-zoo", "2.0.0"));
  const json = JSON.parse(await fs.readFile(file, "utf8"));
  assert.deepEqual(Object.keys(json.modules), ["afk", "land", "zoo"]);
  await fs.rm(tmp, { recursive: true, force: true });
});

test("patchIndexFile 重复 id 报错", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "sfmc-idx-"));
  const file = path.join(tmp, "index.json");
  await patchIndexFile(file, indexEntryFor("@sfmc-bds/module-land", "1.0.0"));
  const r2 = await patchIndexFile(file, indexEntryFor("@sfmc-bds/module-land", "1.0.1"));
  assert.equal(r2.ok, false);
  assert.match(r2.error, /已在 index.json 中存在/);
  await fs.rm(tmp, { recursive: true, force: true });
});

test("patchIndexFile 保留既有 github 条目", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "sfmc-idx-"));
  const file = path.join(tmp, "index.json");
  await fs.writeFile(
    file,
    JSON.stringify({
      version: 2,
      modules: { afk: { repo: "Tanya7z/sfmc-modules", tag: "modules-v0.4.0" } },
    })
  );
  await patchIndexFile(file, indexEntryFor("@alice/sfmc-module-foo", "1.0.0"));
  const json = JSON.parse(await fs.readFile(file, "utf8"));
  assert.equal(json.modules.afk.repo, "Tanya7z/sfmc-modules");
  assert.equal(json.modules.foo.npm, "@alice/sfmc-module-foo");
  await fs.rm(tmp, { recursive: true, force: true });
});

test("openIndexPr dry-run 默认打印意图", async () => {
  const r = await openIndexPr("@sfmc-bds/module-land", "1.0.0", {
    dryRun: true,
    skipIndexPr: false,
    ghPush: false,
    ghRepo: "Tanya7z/sfmc-modules",
    ghForkRemote: "sfmc-modules-fork",
  });
  assert.equal(r.ok, true);
  assert.equal(r.skipped, false);
  assert.ok(r.intent.length > 0);
  assert.match(r.intent[0], /gh repo fork/);
  assert.match(r.intent[r.intent.length - 1], /gh pr create/);
  assert.match(r.message, /dry-run/);
});

test("openIndexPr --skip-index-pr 直接跳过", async () => {
  const r = await openIndexPr("@sfmc-bds/module-land", "1.0.0", {
    dryRun: false,
    skipIndexPr: true,
    ghPush: true,
    ghRepo: "Tanya7z/sfmc-modules",
    ghForkRemote: "sfmc-modules-fork",
  });
  assert.equal(r.skipped, true);
  assert.equal(r.ok, true);
});

test("openIndexPr 非法 --gh-repo 报错", async () => {
  const r = await openIndexPr("@sfmc-bds/module-land", "1.0.0", {
    dryRun: false,
    skipIndexPr: false,
    ghPush: false,
    ghRepo: "no-slash",
    ghForkRemote: "x",
  });
  assert.equal(r.ok, false);
  assert.match(r.message, /--gh-repo 非法/);
});

test("runPrecheck shape 验证", async () => {
  const cwd = path.resolve("..", "..");
  const r = await runPrecheck(cwd);
  assert.ok(Array.isArray(r.warnings));
  assert.ok(Array.isArray(r.errors));
  assert.ok(Array.isArray(r.tarballFiles));
  assert.equal(typeof r.ok, "boolean");
});