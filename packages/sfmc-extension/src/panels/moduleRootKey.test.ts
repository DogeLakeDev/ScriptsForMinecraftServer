/**
 * resolveSandboxModuleRoot 路径规范化单测（不依赖 vscode）
 */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

/** 与 commands.ts normalizeModuleRootKey 同逻辑 */
function normalizeModuleRootKey(p: string): string {
  return path.resolve(p).replace(/\\/g, "/").toLowerCase();
}

test("normalizeModuleRootKey 对 Windows 路径大小写与斜杠不敏感", () => {
  const a = normalizeModuleRootKey("D:\\Work\\MyMod");
  const b = normalizeModuleRootKey("d:/Work/MyMod");
  assert.equal(a, b);
});

test("normalizeModuleRootKey 区分不同目录", () => {
  const a = normalizeModuleRootKey(path.join("D:", "Work", "a"));
  const b = normalizeModuleRootKey(path.join("D:", "Work", "b"));
  assert.notEqual(a, b);
});
