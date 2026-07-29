// @ts-check
/**
 * link-local.test.mjs — normalizeLinkFrom 表驱动
 */
import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { normalizeLinkFrom } from "./lib/link-from.mjs";

const CWD = process.cwd();

test("local 无路径 → dir:cwd", () => {
  const r = normalizeLinkFrom("local", CWD);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.from, `dir:${path.resolve(CWD)}`);
});

test("local:相对目录 → dir:绝对路径", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-link-rel-"));
  const rel = path.relative(CWD, tmp) || ".";
  const r = normalizeLinkFrom(`local:${rel}`, CWD);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.from, `dir:${path.resolve(CWD, rel)}`);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("local:file.tgz + link → 拒绝", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-link-"));
  const tgz = path.join(tmp, "x.tgz");
  fs.writeFileSync(tgz, "");
  const r = normalizeLinkFrom(`local:${tgz}`, CWD);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /tgz|zip|--link/i);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("dir: 原样通过", () => {
  const r = normalizeLinkFrom("dir:D:/mods/foo", CWD);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.from, "dir:D:/mods/foo");
});
