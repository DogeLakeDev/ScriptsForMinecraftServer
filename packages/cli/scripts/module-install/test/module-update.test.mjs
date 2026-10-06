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
import { DEFAULT_MODULE_UPDATE_CONFIG } from "../lib/module-update-config.mjs";
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
  const unknownHost = decideModuleUpdate({ ...base, sdkRange: ">=0.3.0", hostSdk: null });
  assert.equal(unknownHost.action, "skip");
  assert.equal(unknownHost.reason, "sdk");
  assert.match(unknownHost.detail, /未知/);
  assert.equal(decideModuleUpdate({ ...base, sdkRange: null, hostSdk: null }).action, "upgrade");
  assert.equal(decideModuleUpdate({ ...base, sdkRange: "", hostSdk: null }).action, "upgrade");
  assert.equal(decideModuleUpdate({ ...base, sdkRange: "*", hostSdk: null }).action, "upgrade");
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

/** 写一份已安装的 chat 目录，版本固定为 1.0.0。使用场景：计划测试需要磁盘上的包和 manifest。 */
function writeInstalledChat(root) {
  const pkg = path.join(root, "modules", "packages", "chat");
  fs.mkdirSync(path.join(pkg, "sapi"), { recursive: true });
  fs.writeFileSync(path.join(pkg, "package.json"), JSON.stringify({ name: "@sfmc-bds/module-chat", version: "1.0.0" }));
  fs.writeFileSync(
    path.join(pkg, "sapi", "manifest.json"),
    JSON.stringify({ id: "chat", configKey: "chat", requires: [] })
  );
}

test("auto 关闭时不升级，但跳过记录带上索引版本", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-mod-auto-off-"));
  writeInstalledChat(root);
  writePins(root, {
    version: 1,
    modules: {
      chat: {
        source: "npm",
        channel: "index",
        spec: "npm:@sfmc-bds/module-chat@1.0.0",
        installedVersion: "1.0.0",
        manifestId: "chat",
        auto: false,
        autoLocked: false,
        autoSetBy: "user",
        lastCheckedAt: null,
        lastAppliedAt: null,
        lastError: null,
      },
    },
  });
  let distTagCalls = 0;
  const plan = await planModuleUpdates({
    root,
    hostSdk: "0.2.5",
    ids: ["chat"],
    fetchIndex: async () => ({
      index: { chat: { npm: "@sfmc-bds/module-chat", version: "1.2.0", sdk: ">=0.2.2" } },
      offline: false,
    }),
    fetchDistTag: async () => {
      distTagCalls += 1;
      return "9.9.9";
    },
  });
  assert.equal(plan.upgrades.length, 0);
  const skipped = plan.skipped.find((item) => item.id === "chat");
  assert.ok(skipped);
  assert.equal(skipped.reason, "auto-off");
  assert.equal(skipped.toVersion, "1.2.0");
  assert.equal(skipped.fromVersion, "1.0.0");
  assert.equal(distTagCalls, 0);
});

test("本地链接不为查版本请求 dist-tag", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-mod-local-"));
  writeInstalledChat(root);
  writePins(root, {
    version: 1,
    modules: {
      chat: {
        source: "link",
        channel: "none",
        spec: "",
        installedVersion: "1.0.0",
        manifestId: "chat",
        auto: false,
        autoLocked: true,
        autoSetBy: "default",
        lastCheckedAt: null,
        lastAppliedAt: null,
        lastError: null,
      },
    },
  });
  let distTagCalls = 0;
  const plan = await planModuleUpdates({
    root,
    hostSdk: "0.2.5",
    fetchIndex: async () => ({
      index: { chat: { npm: "@sfmc-bds/module-chat", version: "1.2.0", sdk: ">=0.2.2" } },
      offline: false,
    }),
    fetchDistTag: async () => {
      distTagCalls += 1;
      return "9.9.9";
    },
  });
  assert.equal(plan.upgrades.length, 0);
  assert.equal(distTagCalls, 0);
  const skipped = plan.skipped.find((item) => item.id === "chat");
  assert.equal(skipped?.reason, "local-source");
});

test("升级成功后删除这次备份", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-mod-backup-ok-"));
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
      },
    }
  );
  assert.equal(result.failed.length, 0);
  assert.equal(result.applied.length, 1);
  assert.equal(fs.readFileSync(path.join(pkg, "marker.txt"), "utf8"), "new");
  const trash = path.join(root, "modules", "_trash");
  const leftovers = fs.existsSync(trash) ? fs.readdirSync(trash) : [];
  assert.deepEqual(leftovers, []);
});

test("还原失败时错误信息带上备份路径", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-mod-restore-fail-"));
  const pkg = path.join(root, "modules", "packages", "demo");
  fs.mkdirSync(pkg, { recursive: true });
  fs.writeFileSync(path.join(pkg, "marker.txt"), "old");
  const result = await applyModuleUpgrades(
    [{ id: "demo", fromVersion: "1.0.0", toVersion: "1.1.0", spec: "npm:x@1.1.0", requires: [] }],
    {
      root,
      failMode: "continue",
      install: async () => {
        fs.rmSync(path.join(root, "modules", "_trash"), { recursive: true, force: true });
        throw new Error("boom");
      },
    }
  );
  assert.equal(result.failed.length, 1);
  assert.match(result.failed[0].message, /boom/);
  assert.ok(result.failed[0].message.includes(path.join(root, "modules", "_trash")));
});

test("GitHub pin 不能打开自动更新，关闭仍然允许", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-mod-pin-gh-"));
  fs.mkdirSync(path.join(root, "modules", "packages", "demo"), { recursive: true });
  writePins(root, {
    version: 1,
    modules: {
      demo: {
        source: "github",
        channel: "none",
        spec: "github:owner/repo",
        installedVersion: "1.0.0",
        manifestId: "demo",
        auto: false,
        autoLocked: false,
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
  assert.equal(locked.id, "demo");
  const off = setModulePinAuto(root, "demo", false);
  assert.equal(off.ok, true);
  if (off.ok) assert.equal(off.auto, false);
});

/**
 * 允许自动更新的 npm pin。
 * 使用场景：目录实际是开发链接时，pin 仍写成可升级，确认计划以目录类型为准。
 * @param {string} pkgName
 * @param {string} version
 * @param {string} manifestId
 * @param {"index" | "dist-tag"} channel
 */
function openNpmPin(pkgName, version, manifestId, channel) {
  return {
    source: "npm",
    channel,
    spec: channel === "index" ? `npm:${pkgName}@${version}` : `npm:${pkgName}`,
    installedVersion: version,
    manifestId,
    auto: true,
    autoLocked: false,
    autoSetBy: "user",
    lastCheckedAt: null,
    lastAppliedAt: null,
    lastError: null,
  };
}

/**
 * 把独立源目录链到 packages/<id>。
 * 使用场景：在临时目录里造 junction / symlink，避免动仓库外的服务器。
 * @param {string} root
 * @param {string} id
 * @param {"junction" | "dir"} type
 */
function linkModulePackage(root, id, type) {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), `sfmc-mod-src-${id}-`));
  fs.mkdirSync(path.join(source, "sapi"), { recursive: true });
  fs.writeFileSync(
    path.join(source, "package.json"),
    JSON.stringify({ name: `@sfmc-bds/module-${id}`, version: "1.0.0" })
  );
  fs.writeFileSync(
    path.join(source, "sapi", "manifest.json"),
    JSON.stringify({ id, configKey: id, requires: [] })
  );
  fs.writeFileSync(path.join(source, "marker.txt"), "source");
  const dest = path.join(root, "modules", "packages", id);
  fs.symlinkSync(source, dest, type);
  return dest;
}

test("开发链接跳过且 apply 不调用 install，普通目录仍可升级", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-mod-devlink-"));
  writeInstalledChat(root);
  /** @type {{ id: string, channel: "index" | "dist-tag" }[]} */
  const links = [{ id: "via-symlink", channel: "dist-tag" }];
  if (process.platform === "win32") links.unshift({ id: "via-junction", channel: "index" });
  for (const link of links) {
    const type = link.id === "via-junction" ? "junction" : "dir";
    linkModulePackage(root, link.id, type);
  }
  writePins(root, {
    version: 1,
    modules: {
      chat: openNpmPin("@sfmc-bds/module-chat", "1.0.0", "chat", "index"),
      ...Object.fromEntries(
        links.map((link) => [
          link.id,
          openNpmPin(`@sfmc-bds/module-${link.id}`, "1.0.0", link.id, link.channel),
        ])
      ),
    },
  });
  let distTagCalls = 0;
  const plan = await planModuleUpdates({
    root,
    hostSdk: "0.2.5",
    fetchIndex: async () => ({
      index: {
        chat: { npm: "@sfmc-bds/module-chat", version: "1.1.0", sdk: ">=0.2.2" },
        "via-junction": { npm: "@sfmc-bds/module-via-junction", version: "1.1.0", sdk: ">=0.2.2" },
      },
      offline: false,
    }),
    fetchDistTag: async () => {
      distTagCalls += 1;
      return "9.9.9";
    },
  });
  assert.equal(plan.upgrades.some((item) => item.id === "chat"), true);
  assert.equal(plan.upgrades.some((item) => item.spec.startsWith("npm:@sfmc-bds/module-chat@")), true);
  assert.equal(distTagCalls, 0);
  for (const link of links) {
    assert.equal(plan.upgrades.some((item) => item.id === link.id), false);
    const skipped = plan.skipped.find((item) => item.id === link.id);
    assert.equal(skipped?.reason, "local-source");
  }

  let installCalls = 0;
  const applied = await applyModuleUpgrades(
    links.map((link) => ({
      id: link.id,
      fromVersion: "1.0.0",
      toVersion: "1.1.0",
      spec: `npm:@sfmc-bds/module-${link.id}@1.1.0`,
      requires: [],
    })),
    {
      root,
      failMode: "abort",
      install: async () => {
        installCalls += 1;
        throw new Error("must not install over a dev link");
      },
    }
  );
  assert.equal(installCalls, 0);
  assert.equal(applied.applied.length, 0);
  assert.equal(applied.failed.length, 0);
  const trash = path.join(root, "modules", "_trash");
  assert.equal(fs.existsSync(trash) ? fs.readdirSync(trash).length : 0, 0);
  for (const link of links) {
    assert.equal(applied.skipped.find((item) => item.id === link.id)?.reason, "local-source");
    const dest = path.join(root, "modules", "packages", link.id);
    assert.equal(fs.lstatSync(dest).isSymbolicLink(), true);
    assert.equal(fs.readFileSync(path.join(dest, "marker.txt"), "utf8"), "source");
  }
});

test("新播种的更新配置在开服时不自动应用，已有文件保持原值", async () => {
  assert.equal(DEFAULT_MODULE_UPDATE_CONFIG.applyOnBdsStart, false);
  const fresh = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-mod-seed-"));
  writeInstalledChat(fresh);
  const seeded = await planModuleUpdates({
    root: fresh,
    startup: true,
    hostSdk: "0.2.5",
    fetchIndex: async () => ({ index: null, offline: true }),
    fetchDistTag: async () => {
      throw new Error("seeded plan should not query dist-tag");
    },
  });
  assert.equal(seeded.applyOnStart, false);
  const seededFile = path.join(fresh, "configs", "module-update.json");
  const seededBody = JSON.parse(fs.readFileSync(seededFile, "utf8"));
  assert.equal(seededBody.applyOnBdsStart, false);

  const kept = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-mod-keep-"));
  const keptFile = path.join(kept, "configs", "module-update.json");
  fs.mkdirSync(path.dirname(keptFile), { recursive: true });
  const existing = {
    enabled: true,
    checkOnBdsStart: true,
    applyOnBdsStart: true,
    allowMajor: false,
    failMode: "continue",
    distTag: "latest",
  };
  fs.writeFileSync(keptFile, `${JSON.stringify(existing, null, 2)}\n`);
  const before = fs.readFileSync(keptFile, "utf8");
  const keptPlan = await planModuleUpdates({
    root: kept,
    startup: true,
    hostSdk: "0.2.5",
    fetchIndex: async () => ({ index: null, offline: true }),
    fetchDistTag: async () => {
      throw new Error("existing config plan should not query dist-tag");
    },
  });
  assert.equal(keptPlan.applyOnStart, true);
  assert.equal(fs.readFileSync(keptFile, "utf8"), before);
});

test("弃用模块不进入升级，依赖它的模块仍可更新", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-mod-retired-"));
  const monitor = path.join(root, "modules", "packages", "monitor");
  fs.mkdirSync(path.join(monitor, "sapi"), { recursive: true });
  fs.writeFileSync(path.join(monitor, "package.json"), JSON.stringify({ name: "@sfmc-bds/module-monitor", version: "0.2.1" }));
  fs.writeFileSync(path.join(monitor, "sapi", "manifest.json"), JSON.stringify({ id: "monitor", configKey: "monitor", requires: [] }));
  const chat = path.join(root, "modules", "packages", "chat");
  fs.mkdirSync(path.join(chat, "sapi"), { recursive: true });
  fs.writeFileSync(path.join(chat, "package.json"), JSON.stringify({ name: "@sfmc-bds/module-chat", version: "1.0.0" }));
  fs.writeFileSync(
    path.join(chat, "sapi", "manifest.json"),
    JSON.stringify({ id: "chat", configKey: "chat", requires: ["monitor"] })
  );
  const plan = await planModuleUpdates({
    root,
    hostSdk: "0.2.5",
    ids: ["monitor"],
    fetchIndex: async () => ({
      index: {
        monitor: { npm: "@sfmc-bds/module-monitor", version: "0.5.0", sdk: ">=0.2.0" },
        chat: { npm: "@sfmc-bds/module-chat", version: "1.1.0", sdk: ">=0.2.2" },
      },
      offline: false,
    }),
    fetchDistTag: async () => {
      throw new Error("retired module should not query dist-tag");
    },
  });
  assert.equal(plan.upgrades.length, 0);
  const skipped = plan.skipped.find((item) => item.id === "monitor");
  assert.equal(skipped?.reason, "retired");
  assert.equal(skipped?.fromVersion, "0.2.1");
  assert.equal(skipped?.toVersion, null);

  const withChat = await planModuleUpdates({
    root,
    hostSdk: "0.2.5",
    fetchIndex: async () => ({
      index: {
        monitor: { npm: "@sfmc-bds/module-monitor", version: "0.5.0", sdk: ">=0.2.0" },
        chat: { npm: "@sfmc-bds/module-chat", version: "1.1.0", sdk: ">=0.2.2" },
      },
      offline: false,
    }),
    fetchDistTag: async () => {
      throw new Error("indexed modules should not query dist-tag");
    },
  });
  assert.deepEqual(withChat.upgrades.map((item) => item.id), ["chat"]);
  assert.equal(withChat.skipped.some((item) => item.reason === "missing-dependency"), false);
  assert.equal(withChat.skipped.find((item) => item.id === "monitor")?.reason, "retired");

  const dependent = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-mod-retired-dep-"));
  const onlyChat = path.join(dependent, "modules", "packages", "chat");
  fs.mkdirSync(path.join(onlyChat, "sapi"), { recursive: true });
  fs.writeFileSync(path.join(onlyChat, "package.json"), JSON.stringify({ name: "@sfmc-bds/module-chat", version: "1.0.0" }));
  fs.writeFileSync(
    path.join(onlyChat, "sapi", "manifest.json"),
    JSON.stringify({ id: "chat", configKey: "chat", requires: ["monitor"] })
  );
  const dependentPlan = await planModuleUpdates({
    root: dependent,
    hostSdk: "0.2.5",
    fetchIndex: async () => ({
      index: { chat: { npm: "@sfmc-bds/module-chat", version: "1.1.0", sdk: ">=0.2.2" } },
      offline: false,
    }),
    fetchDistTag: async () => null,
  });
  assert.deepEqual(dependentPlan.upgrades.map((item) => item.id), ["chat"]);
  assert.equal(dependentPlan.skipped.some((item) => item.reason === "missing-dependency"), false);
});

test("换包阶段仍拒绝弃用模块", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-mod-retired-apply-"));
  const pkg = path.join(root, "modules", "packages", "monitor");
  fs.mkdirSync(pkg, { recursive: true });
  fs.writeFileSync(path.join(pkg, "marker.txt"), "old");
  const result = await applyModuleUpgrades(
    [{ id: "monitor", fromVersion: "0.2.1", toVersion: "0.5.0", spec: "npm:@sfmc-bds/module-monitor@0.5.0", requires: [] }],
    {
      root,
      failMode: "continue",
      install: async () => {
        throw new Error("retired module must not be installed");
      },
    }
  );
  assert.equal(result.applied.length, 0);
  assert.equal(result.failed.length, 0);
  assert.equal(result.skipped[0]?.reason, "retired");
  assert.equal(fs.readFileSync(path.join(pkg, "marker.txt"), "utf8"), "old");
});
