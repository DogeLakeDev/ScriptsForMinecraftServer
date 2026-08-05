// @ts-check
/**
 * debug-command.test.mjs — BDS variables.json / secrets.json 读写
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

function setupSfmcRoot(bdsRoot) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-debug-"));
  fs.mkdirSync(path.join(root, "configs"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "configs", "bds_updater.json"),
    JSON.stringify({ bds_path: bdsRoot.replace(/\\/g, "/") }, null, 2)
  );
  return root;
}

test("isDebugTruthy 与 SDK 契约一致", async () => {
  const { isDebugTruthy } = await import("./dist/debug-command.js");
  assert.equal(isDebugTruthy(true), true);
  assert.equal(isDebugTruthy(1), true);
  assert.equal(isDebugTruthy("yes"), true);
  assert.equal(isDebugTruthy("on"), true);
  assert.equal(isDebugTruthy(false), false);
  assert.equal(isDebugTruthy("no"), false);
});

test("debug enable/disable/status 写 BDS variables.json", async () => {
  const bdsRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-bds-"));
  const sfmcRoot = setupSfmcRoot(bdsRoot);
  const prev = process.env.SFMC_ROOT;
  process.env.SFMC_ROOT = sfmcRoot;

  try {
    const { cmdDebug } = await import("./dist/debug-command.js");
    const variablesPath = path.join(bdsRoot, "config", "default", "variables.json");

    await cmdDebug(["enable"]);
    const afterEnable = JSON.parse(fs.readFileSync(variablesPath, "utf8"));
    assert.equal(afterEnable.sfmc_debug, true);

    const statusOn = await cmdDebug(["status"]);
    assert.match(statusOn, /sfmc_debug/i);

    await cmdDebug(["disable"]);
    const afterDisable = JSON.parse(fs.readFileSync(variablesPath, "utf8"));
    assert.equal(afterDisable.sfmc_debug, false);
  } finally {
    if (prev === undefined) delete process.env.SFMC_ROOT;
    else process.env.SFMC_ROOT = prev;
  }
});

test("debug sentry on/off 写 BDS secrets.json", async () => {
  const bdsRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-bds-"));
  const sfmcRoot = setupSfmcRoot(bdsRoot);
  const prev = process.env.SFMC_ROOT;
  process.env.SFMC_ROOT = sfmcRoot;

  try {
    const { cmdDebug } = await import("./dist/debug-command.js");
    const secretsPath = path.join(bdsRoot, "config", "default", "secrets.json");
    const dsn = "https://example@o123.ingest.sentry.io/456";

    await cmdDebug(["sentry", "on", "--dsn", dsn]);
    const afterOn = JSON.parse(fs.readFileSync(secretsPath, "utf8"));
    assert.equal(afterOn.SENTRY_DSN, dsn);

    await cmdDebug(["sentry", "off"]);
    const afterOff = JSON.parse(fs.readFileSync(secretsPath, "utf8"));
    assert.equal("SENTRY_DSN" in afterOff, false);
  } finally {
    if (prev === undefined) delete process.env.SFMC_ROOT;
    else process.env.SFMC_ROOT = prev;
  }
});

test("debug sentry on 缺 --dsn 报错", async () => {
  const bdsRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-bds-"));
  const sfmcRoot = setupSfmcRoot(bdsRoot);
  const prev = process.env.SFMC_ROOT;
  process.env.SFMC_ROOT = sfmcRoot;

  try {
    const { cmdDebug } = await import("./dist/debug-command.js");
    const out = await cmdDebug(["sentry", "on"]);
    assert.match(out, /--dsn|required|需要/i);
  } finally {
    if (prev === undefined) delete process.env.SFMC_ROOT;
    else process.env.SFMC_ROOT = prev;
  }
});
