/**
 * argv-parse.test.mjs
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  isModuleInstallShorthand,
  mapPacksSubAlias,
  parseGlobalArgv,
} from "./dist/argv-parse.js";

test("parseGlobalArgv 抽出 -p/--packs", () => {
  const a = parseGlobalArgv(["-p", "i", "./x.zip"]);
  assert.equal(a.packsMode, true);
  assert.deepEqual(a.args, ["i", "./x.zip"]);
  const b = parseGlobalArgv(["--packs", "list"]);
  assert.equal(b.packsMode, true);
  assert.deepEqual(b.args, ["list"]);
  const c = parseGlobalArgv(["status"]);
  assert.equal(c.packsMode, false);
});

test("mapPacksSubAlias i→install", () => {
  assert.equal(mapPacksSubAlias("i"), "install");
  assert.equal(mapPacksSubAlias("list"), "list");
});

test("isModuleInstallShorthand", () => {
  assert.equal(isModuleInstallShorthand("i"), true);
  assert.equal(isModuleInstallShorthand("install"), true);
  assert.equal(isModuleInstallShorthand("mod"), false);
});
