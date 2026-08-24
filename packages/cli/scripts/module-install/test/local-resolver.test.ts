/**
 * local-resolver `--from local` 路径解析表驱动
 */
import assert from "node:assert/strict";
import path from "node:path";
import process from "node:process";
import test from "node:test";

/** 镜像 fetch-module.mjs#resolveLocalPath */
function resolveLocalPath(tail: string | undefined): string {
  const p = String(tail ?? "").trim();
  if (!p || p === "." || p === "./") return path.resolve(process.cwd());
  return path.isAbsolute(p) ? path.resolve(p) : path.resolve(process.cwd(), p);
}

const CWD = process.cwd();

test("空 → cwd", () => assert.equal(resolveLocalPath(""), path.resolve(CWD)));
test("undefined → cwd", () => assert.equal(resolveLocalPath(undefined), path.resolve(CWD)));
test(". → cwd", () => assert.equal(resolveLocalPath("."), path.resolve(CWD)));
test("./ → cwd", () => assert.equal(resolveLocalPath("./"), path.resolve(CWD)));

test("相对 ./foo → 相对 cwd 解析", () => {
  assert.equal(resolveLocalPath("./foo"), path.resolve(CWD, "foo"));
});

test("相对无点 foo", () => {
  assert.equal(resolveLocalPath("foo"), path.resolve(CWD, "foo"));
});

test("绝对路径原样", () => {
  const abs = process.platform === "win32" ? "D:\\work\\my-mod" : "/tmp/my-mod";
  assert.equal(resolveLocalPath(abs), path.resolve(abs));
});

test("绝对路径 .tgz", () => {
  const abs = process.platform === "win32" ? "D:\\work\\foo-1.0.0.tgz" : "/tmp/foo-1.0.0.tgz";
  assert.equal(resolveLocalPath(abs), path.resolve(abs));
});

test("绝对路径 .zip", () => {
  const abs = process.platform === "win32" ? "D:\\work\\foo.zip" : "/tmp/foo.zip";
  assert.equal(resolveLocalPath(abs), path.resolve(abs));
});
