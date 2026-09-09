import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { validateDefaultConfig } from "../check-modules.mjs";

function moduleFixture(files: Record<string, string> = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-check-config-"));
  const dir = path.join(root, "configs-default");
  if (Object.keys(files).length > 0) fs.mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), body);
  return root;
}

test("validateDefaultConfig 接受标准对象配置", () => {
  const root = moduleFixture({ "demo.json": '{"enabled":true}' });
  assert.deepEqual(validateDefaultConfig(root, "demo"), { ok: true });
  fs.rmSync(root, { recursive: true, force: true });
});

test("validateDefaultConfig 对缺失默认配置给出警告", () => {
  const root = moduleFixture();
  const result = validateDefaultConfig(root, "demo");
  assert.equal(result.ok, true);
  if (result.ok) assert.match(result.warning ?? "", /未提供默认配置/);
  fs.rmSync(root, { recursive: true, force: true });
});

test("validateDefaultConfig 拒绝错名、损坏及非对象配置", () => {
  const wrong = moduleFixture({ "other.json": "{}" });
  assert.deepEqual(validateDefaultConfig(wrong, "demo").ok, false);
  fs.rmSync(wrong, { recursive: true, force: true });

  const broken = moduleFixture({ "demo.json": "{" });
  const brokenResult = validateDefaultConfig(broken, "demo");
  assert.equal(brokenResult.ok, false);
  if (!brokenResult.ok) assert.match(brokenResult.error, /解析失败/);
  fs.rmSync(broken, { recursive: true, force: true });

  const array = moduleFixture({ "demo.json": "[]" });
  const arrayResult = validateDefaultConfig(array, "demo");
  assert.equal(arrayResult.ok, false);
  if (!arrayResult.ok) assert.match(arrayResult.error, /顶层必须是 JSON 对象/);
  fs.rmSync(array, { recursive: true, force: true });
});
