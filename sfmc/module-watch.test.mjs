// @ts-check
/**
 * module-watch.test.mjs — sfmc mod watch 的纯函数表驱动
 * 仅覆盖 resolveLocalModuleRoot 规则（其它都是 fs.watch 行为，留 e2e 验证）。
 */
import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import os from "node:os";
import { resolveLocalModuleRoot } from "./dist/module-watch.js";

const CWD = os.tmpdir();

test("--from 缺省 / 空 → cwd", () => {
  assert.equal(resolveLocalModuleRoot({ from: null, cwd: CWD }), CWD);
  assert.equal(resolveLocalModuleRoot({ from: "", cwd: CWD }), CWD);
});

test("--from local (无路径) → cwd", () => {
  assert.equal(resolveLocalModuleRoot({ from: "local", cwd: CWD }), CWD);
});

test("--from local:./relative → 相对 cwd 解析为绝对路径", () => {
  const r = resolveLocalModuleRoot({ from: "local:./foo", cwd: CWD });
  assert.equal(r, path.resolve(CWD, "./foo"));
});

test("--from local:绝对路径 → 原样绝对路径", () => {
  const abs = "D:/work/my-module";
  assert.equal(resolveLocalModuleRoot({ from: `local:${abs}`, cwd: CWD }), path.resolve(abs));
});

test("--from dir:<path> → 兼容旧写法（相对路径）", () => {
  assert.equal(
    resolveLocalModuleRoot({ from: "dir:./foo", cwd: CWD }),
    path.resolve(CWD, "./foo")
  );
});

test("--from dir:<path> → 兼容旧写法（绝对路径）", () => {
  const abs = process.platform === "win32" ? "D:\\work\\my-module" : "/tmp/somewhere";
  assert.equal(resolveLocalModuleRoot({ from: `dir:${abs}`, cwd: CWD }), path.resolve(abs));
});
