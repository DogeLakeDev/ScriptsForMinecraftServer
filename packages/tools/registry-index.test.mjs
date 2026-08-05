// @ts-check
import assert from "node:assert/strict";
import test from "node:test";
import { parseRegistryIndex } from "./lib/registry-index.mjs";

test("接受 npm 条目", () => {
  const idx = parseRegistryIndex({
    version: 2,
    modules: {
      land: { npm: "@sfmc-bds/module-land", version: "1.0.0", sdk: ">=0.2.0" },
    },
  });
  assert.equal(idx.land.npm, "@sfmc-bds/module-land");
  assert.equal(idx.land.version, "1.0.0");
});

test("仍接受 repo+tag", () => {
  const idx = parseRegistryIndex({
    modules: { afk: { repo: "Tanya7z/sfmc-modules", tag: "modules-v0.4.0" } },
  });
  assert.equal(idx.afk.repo, "Tanya7z/sfmc-modules");
  assert.equal(idx.afk.tag, "modules-v0.4.0");
});

test("既无 npm 也无 repo 则跳过", () => {
  const idx = parseRegistryIndex({ modules: { bad: { version: "1" } } });
  assert.equal(idx.bad, undefined);
});
