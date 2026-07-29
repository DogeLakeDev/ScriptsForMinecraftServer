// @ts-check
/**
 * install-resolver.test.mjs — npm 包名解析表驱动
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveNpmPackageName,
  folderFromNpmPackageName,
  normalizeNpmPackageName,
} from "./lib/npm-resolver.mjs";

test("短 id → @sfmc-bds/module-<id>", () => {
  assert.equal(resolveNpmPackageName("land"), "@sfmc-bds/module-land");
  assert.equal(resolveNpmPackageName("my-mod"), "@sfmc-bds/module-my-mod");
});

test("logical id (feature-* / core-*) → @sfmc-bds/module-<folder>", () => {
  assert.equal(resolveNpmPackageName("feature-land"), "@sfmc-bds/module-land");
  assert.equal(resolveNpmPackageName("core-data-backup"), "@sfmc-bds/module-data-backup");
});

test("已带 scope 原样透传", () => {
  assert.equal(resolveNpmPackageName("@alice/sfmc-module-foo"), "@alice/sfmc-module-foo");
  assert.equal(resolveNpmPackageName("@sfmc-bds/module-land"), "@sfmc-bds/module-land");
});

test("非 kebab 报错", () => {
  assert.throws(() => resolveNpmPackageName("NotKebab"), /invalid module id/);
  assert.throws(() => resolveNpmPackageName("feature-"), /invalid module id/);
});

test("@ 但无 / → invalid scoped package name", () => {
  assert.throws(() => resolveNpmPackageName("@orphan"), /invalid scoped package name/);
});

test("folderFromNpmPackageName 反向解析", () => {
  assert.equal(folderFromNpmPackageName("@sfmc-bds/module-land"), "land");
  assert.equal(folderFromNpmPackageName("@alice/sfmc-module-foo"), "foo");
  assert.equal(folderFromNpmPackageName("@alice/sfmc-module-my-mod"), "my-mod");
  assert.equal(folderFromNpmPackageName("@alice/random"), null);
});

test("normalizeNpmPackageName 兼容两种前缀", () => {
  assert.equal(normalizeNpmPackageName("@sfmc-bds/module-land"), "land");
  assert.equal(normalizeNpmPackageName("@alice/sfmc-module-foo"), "foo");
  assert.equal(normalizeNpmPackageName("@alice/module-bar"), "bar");
});