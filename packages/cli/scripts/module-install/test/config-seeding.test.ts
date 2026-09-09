import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { mergeMissing, seedModuleConfig } from "../lib/config-seeding.mjs";

function fixture(defaults?: unknown, current?: unknown) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-config-seeding-"));
  const moduleRoot = path.join(root, "module");
  const projectRoot = path.join(root, "project");
  fs.mkdirSync(path.join(moduleRoot, "configs-default"), { recursive: true });
  if (defaults !== undefined) {
    const body = typeof defaults === "string" ? defaults : JSON.stringify(defaults);
    fs.writeFileSync(path.join(moduleRoot, "configs-default", "demo.json"), body);
  }
  if (current !== undefined) {
    fs.mkdirSync(path.join(projectRoot, "configs"), { recursive: true });
    const body = typeof current === "string" ? current : JSON.stringify(current);
    fs.writeFileSync(path.join(projectRoot, "configs", "demo.json"), body);
  }
  return { root, moduleRoot, projectRoot, target: path.join(projectRoot, "configs", "demo.json") };
}

test("mergeMissing 递归补缺且不覆盖或修改输入", () => {
  const current = { enabled: false, nested: { keep: 1 }, list: ["user"], extra: true };
  const defaults = { enabled: true, nested: { keep: 0, added: 2 }, list: ["default"], fresh: "x" };
  const before = structuredClone(current);
  const result = mergeMissing(current, defaults);
  assert.deepEqual(current, before);
  assert.deepEqual(result.value, {
    enabled: false,
    nested: { keep: 1, added: 2 },
    list: ["user"],
    extra: true,
    fresh: "x",
  });
  assert.deepEqual(result.addedPaths, ["fresh", "nested.added"]);
});

test("seedModuleConfig 创建、补缺与无变化", () => {
  const f = fixture({ enabled: true, nested: { first: 1 } });
  const created = seedModuleConfig({ ...f, configKey: "demo" });
  assert.equal(created.status, "created");
  assert.deepEqual(JSON.parse(fs.readFileSync(f.target, "utf8")), {
    enabled: true,
    nested: { first: 1 },
  });

  fs.writeFileSync(f.target, JSON.stringify({ enabled: false, nested: { first: 9 } }));
  fs.writeFileSync(
    path.join(f.moduleRoot, "configs-default", "demo.json"),
    JSON.stringify({ enabled: true, nested: { first: 1, second: 2 }, list: ["default"] })
  );
  const updated = seedModuleConfig({ ...f, configKey: "demo" });
  assert.equal(updated.status, "updated");
  assert.deepEqual(updated.addedPaths, ["list", "nested.second"]);
  assert.deepEqual(JSON.parse(fs.readFileSync(f.target, "utf8")), {
    enabled: false,
    nested: { first: 9, second: 2 },
    list: ["default"],
  });
  assert.equal(seedModuleConfig({ ...f, configKey: "demo" }).status, "unchanged");
  fs.rmSync(f.root, { recursive: true, force: true });
});

test("seedModuleConfig 缺失默认文件时保持兼容", () => {
  const f = fixture();
  assert.equal(seedModuleConfig({ ...f, configKey: "demo" }).status, "missing-defaults");
  assert.equal(fs.existsSync(f.target), false);
  fs.rmSync(f.root, { recursive: true, force: true });
});

test("seedModuleConfig 拒绝与 configKey 不一致的默认文件名", () => {
  const f = fixture();
  fs.writeFileSync(path.join(f.moduleRoot, "configs-default", "other.json"), "{}");
  assert.throws(() => seedModuleConfig({ ...f, configKey: "demo" }), /文件名必须为/);
  fs.rmSync(f.root, { recursive: true, force: true });
});

test("seedModuleConfig 拒绝损坏 JSON、非对象与非法 configKey", () => {
  const brokenDefault = fixture("{");
  assert.throws(() => seedModuleConfig({ ...brokenDefault, configKey: "demo" }), /默认配置.*解析失败/);
  fs.rmSync(brokenDefault.root, { recursive: true, force: true });

  const scalar = fixture([]);
  assert.throws(() => seedModuleConfig({ ...scalar, configKey: "demo" }), /顶层必须是 JSON 对象/);
  fs.rmSync(scalar.root, { recursive: true, force: true });

  const brokenUser = fixture({ ok: true }, "{broken");
  const before = fs.readFileSync(brokenUser.target);
  assert.throws(() => seedModuleConfig({ ...brokenUser, configKey: "demo" }), /用户配置.*解析失败/);
  assert.deepEqual(fs.readFileSync(brokenUser.target), before);
  fs.rmSync(brokenUser.root, { recursive: true, force: true });

  const invalid = fixture({});
  assert.throws(() => seedModuleConfig({ ...invalid, configKey: "../escape" }), /invalid configKey/);
  fs.rmSync(invalid.root, { recursive: true, force: true });
});
