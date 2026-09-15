/**
 * UI Studio 本地静态服务单测。
 *
 * 固定默认端口：IndexedDB 按 origin（含端口）隔离，随机端口会导致工程丢失。
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  startUiStudioServer,
  UI_STUDIO_DEFAULT_PORT,
} from "../../dist/esm/ui-studio/index.js";

async function makeWebRoot(): Promise<string> {
  const webRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ui-studio-web-"));
  await fs.writeFile(path.join(webRoot, "index.html"), "<!doctype html><title>studio</title>", "utf8");
  return webRoot;
}

test("server: 默认端口常量固定为 3003", () => {
  assert.equal(UI_STUDIO_DEFAULT_PORT, 3003);
});

test("server: 未指定 port 时监听 127.0.0.1:3003", async () => {
  const webRoot = await makeWebRoot();
  const handle = await startUiStudioServer({ webRoot });
  try {
    assert.equal(handle.port, UI_STUDIO_DEFAULT_PORT);
    assert.equal(handle.url, `http://127.0.0.1:${UI_STUDIO_DEFAULT_PORT}/`);
  } finally {
    await handle.close();
    await fs.rm(webRoot, { recursive: true, force: true });
  }
});

test("server: 端口占用时给出面向用户的中文错误", async () => {
  const webRoot = await makeWebRoot();
  const blocker = createServer();
  await new Promise<void>((resolve, reject) => {
    blocker.once("error", reject);
    blocker.listen(0, "127.0.0.1", () => resolve());
  });
  const address = blocker.address();
  assert.ok(address && typeof address === "object");
  try {
    await assert.rejects(
      () => startUiStudioServer({ webRoot, port: address.port }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /已被占用/);
        assert.match(error.message, new RegExp(String(address.port)));
        return true;
      },
    );
  } finally {
    await new Promise<void>((resolve, reject) => {
      blocker.close((err) => (err ? reject(err) : resolve()));
    });
    await fs.rm(webRoot, { recursive: true, force: true });
  }
});

test("server: 显式 port 0 仍可覆盖为随机端口", async () => {
  const webRoot = await makeWebRoot();
  const handle = await startUiStudioServer({ webRoot, port: 0 });
  try {
    assert.notEqual(handle.port, 0);
    assert.equal(handle.url, `http://127.0.0.1:${handle.port}/`);
  } finally {
    await handle.close();
    await fs.rm(webRoot, { recursive: true, force: true });
  }
});
