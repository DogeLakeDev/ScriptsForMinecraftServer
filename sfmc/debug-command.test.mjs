/**
 * debug-command.test.mjs — debug 子命令集成测试（用临时 SFMC_ROOT 隔离）
 *
 * cmdDebug 依赖 resolveBdsContext() 读 ROOT/configs/bds_updater.json#bds_path，
 * 在测试运行时通过 SFMC_ROOT env 指向临时目录即可隔离。
 *
 * 测试矩阵:
 *   - enable / disable 写 sfmc_debug;浅合并保留其它字段
 *   - sentry on/off 写 SENTRY_DSN;浅合并保留其它字段
 *   - status 正确读取并显示
 *   - 未知子命令 / 缺 --dsn 返回友好错误
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { before, test } from "node:test";

let tmpRoot;
let bdsRoot;

before(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "sfmc-debug-test-"));
  bdsRoot = join(tmpRoot, "bds-root");
  // bds_updater.json#bds_path 必须绝对路径（resolveBdsContext 直接拼）
  mkdirSync(join(tmpRoot, "configs"), { recursive: true });
  mkdirSync(join(bdsRoot, "config", "default"), { recursive: true });
  writeFileSync(
    join(tmpRoot, "configs", "bds_updater.json"),
    JSON.stringify({ bds_path: bdsRoot }),
    "utf8"
  );
  writeFileSync(join(bdsRoot, "server.properties"), "level-name=Bedrock\n", "utf8");
  writeFileSync(
    join(bdsRoot, "config", "default", "variables.json"),
    JSON.stringify({ existing_var: "preserved" }),
    "utf8"
  );
  writeFileSync(
    join(bdsRoot, "config", "default", "secrets.json"),
    JSON.stringify({ OTHER_SECRET: "keep-me" }),
    "utf8"
  );
});

process.on("exit", () => {
  if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
});

function run(args) {
  return execFileSync(
    process.execPath,
    [join(import.meta.dirname, "dist", "main.js"), ...args],
    {
      env: { ...process.env, SFMC_ROOT: tmpRoot, SFMC_LOCALE: "en" },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
}

function readVariables() {
  return JSON.parse(readFileSync(join(bdsRoot, "config", "default", "variables.json"), "utf8"));
}
function readSecrets() {
  return JSON.parse(readFileSync(join(bdsRoot, "config", "default", "secrets.json"), "utf8"));
}

test("status: 初始状态 OFF", () => {
  const out = run(["debug", "status"]);
  assert.match(out, /sfmc_debug\s*:\s*OFF/);
  assert.match(out, /SENTRY_DSN\s*:\s*OFF/);
});

test("enable: 写 sfmc_debug=true,保留 existing_var", () => {
  run(["debug", "enable"]);
  const v = readVariables();
  assert.equal(v.sfmc_debug, true);
  assert.equal(v.existing_var, "preserved");
});

test("status: enable 后变 ON", () => {
  const out = run(["debug", "status"]);
  assert.match(out, /sfmc_debug\s*:\s*ON/);
});

test("sentry on --dsn: 写 SENTRY_DSN,保留 OTHER_SECRET", () => {
  run(["debug", "sentry", "on", "--dsn", "https://abc@sentry.io/123"]);
  const s = readSecrets();
  assert.equal(s.SENTRY_DSN, "https://abc@sentry.io/123");
  assert.equal(s.OTHER_SECRET, "keep-me");
});

test("sentry on (缺 --dsn): 提示并退出非零", () => {
  const out = run(["debug", "sentry", "on"]);
  assert.match(out, /--dsn <value> required/);
});

test("sentry off: 删除 SENTRY_DSN", () => {
  run(["debug", "sentry", "off"]);
  const s = readSecrets();
  assert.equal("SENTRY_DSN" in s, false);
  assert.equal(s.OTHER_SECRET, "keep-me");
});

test("sentry off (再次): already off 提示", () => {
  const out = run(["debug", "sentry", "off"]);
  assert.match(out, /SENTRY_DSN already absent/);
});

test("disable: 写 sfmc_debug=false", () => {
  run(["debug", "disable"]);
  const v = readVariables();
  assert.equal(v.sfmc_debug, false);
  assert.equal(v.existing_var, "preserved");
});

test("unknown subcommand: 友好提示", () => {
  const out = run(["debug", "bogus"]);
  assert.match(out, /Unknown debug subcommand: bogus/);
});

test("sentry unknown action: 友好提示", () => {
  const out = run(["debug", "sentry", "wat"]);
  assert.match(out, /Unknown sentry action: wat/);
});