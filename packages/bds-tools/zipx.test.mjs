/**
 * zipx 安全路径 + 解压单测（zip-slip）
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import JSZip from "jszip";
import { extractZipBufferToDir, resolveSafeZipEntryPath } from "./dist/zipx.js";

test("resolveSafeZipEntryPath rejects .. and absolute", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-zipx-"));
  assert.throws(() => resolveSafeZipEntryPath(root, "../evil.txt"));
  assert.throws(() => resolveSafeZipEntryPath(root, "foo/../../evil.txt"));
  assert.throws(() => resolveSafeZipEntryPath(root, "/etc/passwd"));
  const ok = resolveSafeZipEntryPath(root, "pack/manifest.json");
  assert.equal(ok, path.resolve(root, "pack", "manifest.json"));
  fs.rmSync(root, { recursive: true, force: true });
});

test("extractZipBufferToDir rejects zip-slip entries", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-zipx-"));
  const zip = new JSZip();
  zip.file("../../escape.txt", "pwned");
  const buf = await zip.generateAsync({ type: "nodebuffer" });
  await assert.rejects(() => extractZipBufferToDir(buf, root), /unsafe zip entry|escapes/);
  assert.equal(fs.existsSync(path.join(root, "escape.txt")), false);
  fs.rmSync(root, { recursive: true, force: true });
});

test("extractZipBufferToDir writes nested safe entries", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-zipx-"));
  const zip = new JSZip();
  zip.file("inner/manifest.json", '{"ok":true}');
  const buf = await zip.generateAsync({ type: "nodebuffer" });
  await extractZipBufferToDir(buf, root);
  const text = fs.readFileSync(path.join(root, "inner", "manifest.json"), "utf8");
  assert.match(text, /"ok"\s*:\s*true/);
  fs.rmSync(root, { recursive: true, force: true });
});
