/**
 * 模块自动更新的纯逻辑与失败还原。
 * 不访问网络，索引和 dist-tag 都由测试注入。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { compareSemver, isMajorBump, satisfiesSdk } from "../lib/semver.mjs";
import { decideModuleUpdate, orderUpgrades, applyModuleUpgrades, planModuleUpdates } from "../lib/module-update.mjs";
import {
  inferPinDraft,
  reconcileDefaultAuto,
  setModulePinAuto,
  shouldPreserveLock,
  writePins,
} from "../lib/pins.mjs";

test("semver 比较与 SDK 范围", () => {
  assert.equal(compareSemver("1.2.3", "1.2.4"), -1);
  assert.equal(compareSemver("1.2.3", "1.2.3"), 0);
  assert.equal(compareSemver("1.2.3", "1.2.3-beta.1"), 1);
  assert.equal(isMajorBump("1.2.0", "2.0.0"), true);
  assert.equal(isMajorBump("0.2.0", "0.3.0"), false);
  assert.equal(satisfiesSdk("0.2.5", ">=0.2.2"), true);
  assert.equal(satisfiesSdk("0.2.1", ">=0.2.2"), false);
  assert.equal(satisfiesSdk("0.2.5", "^0.2.3"), true);
  assert.equal(satisfiesSdk("0.3.0", "^0.2.3"), false);
});

test("decideModuleUpdate 按来源和版本取舍", () => {
  const base = {
    auto: true,
    autoLocked: false,
    source: "npm",
    installedVersion: "1.2.0",
    targetVersion: "1.3.0",
    allowMajor: false,
    sdkRange: null,
    hostSdk: "0.2.5",
    offline: false,
    targetReason: null,
  };
  assert.equal(decideModuleUpdate(base).action, "upgrade");
  assert.equal(decideModuleUpdate({ ...base, targetVersion: "2.0.0" }).reason, "major");
  assert.equal(decideModuleUpdate({ ...base, targetVersion: "2.0.0", allowMajor: true }).action, "upgrade");
  assert.equal(decideModuleUpdate({ ...base, auto: false }).reason, "auto-off");
  assert.equal(decideModuleUpdate({ ...base, source: "link", autoLocked: true }).reason, "local-source");
  assert.equal(decideModuleUpdate({ ...base, targetVersion: "1.2.0" }).reason, "up-to-date");
  assert.equal(decideModuleUpdate({ ...base, offline: true, targetVersion: null }).reason, "registry-offline");
  assert.equal(
    decideModuleUpdate({ ...base, sdkRange: ">=0.3.0", hostSdk: "0.2.5" }).reason,
    "sdk"
  );
});

test("升级顺序让被依赖的模块先走", () => {
  const ordered = orderUpgrades([
    { id: "chat", fromVersion: "1.0.0", toVersion: "1.1.0", spec: "npm:a@1.1.0", requires: ["economy"] },
    { id: "economy", fromVersion: "1.0.0", toVersion: "1.1.0", spec: "npm:b@1.1.0", requires: [] },
  ]);
  assert.deepEqual(ordered.map((item) => item.id), ["economy", "chat"]);
});

test("pin 草稿与默认 auto", () => {
  assert.equal(shouldPreserveLock(true, true), true);
  assert.equal(shouldPreserveLock(true, false), false);
  assert.equal(shouldPreserveLock(false, true), false);
  const linked = inferPinDraft("dir:D:/mod", true);
  assert.equal(linked.autoLocked, true);
  assert.equal(linked.auto, false);
  const versioned = inferPinDraft("npm:@sfmc-bds/module-chat@0.2.2", false);
  assert.equal(versioned.auto, false);
  assert.equal(versioned.channel, "index");
  const opened = reconcileDefaultAuto(
    {
      ...versioned,
      installedVersion: "0.2.2",
      manifestId: "chat",
      autoSetBy: "default",
      lastCheckedAt: null,
      lastAppliedAt: null,
      lastError: null,
    },
    { npm: "@sfmc-bds/module-chat", version: "0.2.3" }
  );
  assert.equal(opened.auto, true);
  assert.equal(opened.channel, "index");
  const kept = reconcileDefaultAuto({ ...opened, auto: false, autoSetBy: "user" }, {
    npm: "@sfmc-bds/module-chat",
    version: "0.2.3",
  });
  assert.equal(kept.auto, false);
});

test("计划只升级索引里更高的补丁，并跳过 major", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-mod-update-"));
  const pkg = path.join(root, "modules", "packages", "chat");
  fs.mkdirSync(path.join(pkg, "sapi"), { recursive: true });
  fs.writeFileSync(path.join(pkg, "package.json"), JSON.stringify({ name: "@sfmc-bds/module-chat", version: "1.0.0" }));
  fs.writeFileSync(
    path.join(pkg, "sapi", "manifest.json"),
    JSON.stringify({ id: "chat", configKey: "chat", requires: [] })
  );
  const plan = await planModuleUpdates({
    root,
    hostSdk: "0.2.5",
    fetchIndex: async () => ({
      index: { chat: { npm: "@sfmc-bds/module-chat", version: "1.1.0", sdk: ">=0.2.2" } },
      offline: false,
    }),
    fetchDistTag: async () => {
      throw new Error("indexed module should not query dist-tag");
    },
  });
  assert.equal(plan.upgrades.length, 1);
  assert.equal(plan.upgrades[0].toVersion, "1.1.0");
  assert.equal(plan.upgrades[0].spec, "npm:@sfmc-bds/module-chat@1.1.0");

  const major = await planModuleUpdates({
    root,
    hostSdk: "0.2.5",
    fetchIndex: async () => ({
      index: { chat: { npm: "@sfmc-bds/module-chat", version: "2.0.0", sdk: ">=0.2.2" } },
      offline: false,
    }),
    fetchDistTag: async () => null,
  });
  assert.equal(major.upgrades.length, 0);
  assert.equal(major.skipped.some((item) => item.reason === "major"), true);
});

test("换包失败时还原原来的目录", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-mod-restore-"));
  const pkg = path.join(root, "modules", "packages", "demo");
  fs.mkdirSync(pkg, { recursive: true });
  fs.writeFileSync(path.join(pkg, "marker.txt"), "old");
  const result = await applyModuleUpgrades(
    [{ id: "demo", fromVersion: "1.0.0", toVersion: "1.1.0", spec: "npm:x@1.1.0", requires: [] }],
    {
      root,
      failMode: "continue",
      install: async (id) => {
        const dir = path.join(root, "modules", "packages", id);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "marker.txt"), "new");
        throw new Error("boom");
      },
    }
  );
  assert.equal(result.failed.length, 1);
  assert.equal(fs.readFileSync(path.join(pkg, "marker.txt"), "utf8"), "old");
});

test("本地 pin 不能打开自动更新", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-mod-pin-"));
  fs.mkdirSync(path.join(root, "modules", "packages", "demo"), { recursive: true });
  writePins(root, {
    version: 1,
    modules: {
      demo: {
        source: "link",
        channel: "none",
        spec: "",
        installedVersion: "1.0.0",
        manifestId: "demo",
        auto: false,
        autoLocked: true,
        autoSetBy: "default",
        lastCheckedAt: null,
        lastAppliedAt: null,
        lastError: null,
      },
    },
  });
  const locked = setModulePinAuto(root, "demo", true);
  assert.equal(locked.ok, false);
  assert.equal(locked.code, "locked");
  const off = setModulePinAuto(root, "demo", false);
  assert.equal(off.ok, true);
});
