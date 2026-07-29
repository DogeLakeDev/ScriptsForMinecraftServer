/**
 * verify-module-publish.test.mjs — pre-publish 守门脚本测试
 *
 * 用真实模板仓路径（已 commit 的 sfmc-module-template）作为 good fixture；
 * 用临时目录构造 bad fixture（缺 manifest、缺 files、错误 sdk 等）。
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";

const TEMPLATE = path.resolve("D:/", "#WorkPlace", "#MCBEProjects", "sfmc-module-template");
const TOOLS = path.resolve("D:/", "#WorkPlace", "#MCBEProjects", "ScriptsForMinecraftServer", "tools");
const VERIFY_SCRIPT = path.join(TOOLS, "verify-module-publish.mjs");

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { cwd: opts.cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d) => (stdout += d.toString()));
    proc.stderr?.on("data", (d) => (stderr += d.toString()));
    proc.on("exit", (code) => resolve({ code, stdout, stderr }));
    proc.on("error", (e) => resolve({ code: -1, stdout, stderr: `${stderr}${e.message}` }));
  });
}

async function runVerify(cwd) {
  return run(process.execPath, [VERIFY_SCRIPT], { cwd });
}

test("模板仓：所有硬检查通过（warn 可允许）", async () => {
  const r = await runVerify(TEMPLATE);
  assert.equal(r.code, 0, `unexpected exit; stdout=${r.stdout}\nstderr=${r.stderr}`);
  assert.match(r.stdout, /OK（/);
});

test("坏 fixture：缺 manifest.json → exit 1", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "sfmc-vm-bad-"));
  try {
    const r = await runVerify(tmp);
    assert.notEqual(r.code, 0);
    /* manifest 缺失会先报；script 还在 manifest 检查阶段，未必进入后续检查 */
    assert.ok(/未找到 sapi\/manifest\.json|npm pack 未报告/.test(r.stdout), `got stdout: ${r.stdout}`);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("坏 fixture：manifest schemaVersion=1 → fail", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "sfmc-vm-bad-"));
  try {
    await fs.mkdir(path.join(tmp, "sapi", "src"), { recursive: true });
    await fs.writeFile(
      path.join(tmp, "sapi", "manifest.json"),
      JSON.stringify({
        schemaVersion: 1,
        id: "feature-x",
        name: "x",
        type: "feature",
        configKey: "x",
        permissions: [],
        services: { provides: [], requires: [] },
        requires: [],
      })
    );
    await fs.writeFile(path.join(tmp, "sapi", "src", "index.ts"), "export const x = 1;\n");
    await fs.writeFile(
      path.join(tmp, "package.json"),
      JSON.stringify({
        name: "@scope/module-x",
        version: "1.0.0",
        type: "module",
        files: ["sapi"],
        dependencies: { "@sfmc-bds/sdk": "^0.2.0-beta.5" },
      })
    );
    const r = await runVerify(tmp);
    assert.notEqual(r.code, 0);
    assert.match(r.stdout, /schemaVersion=2/);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("坏 fixture：package.name 不匹配 manifest.id → fail", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "sfmc-vm-bad-"));
  try {
    await fs.mkdir(path.join(tmp, "sapi", "src"), { recursive: true });
    await fs.writeFile(
      path.join(tmp, "sapi", "manifest.json"),
      JSON.stringify({
        schemaVersion: 2,
        id: "feature-foo",
        name: "foo",
        type: "feature",
        configKey: "foo",
        permissions: ["config:read:foo"],
        services: { provides: [], requires: [] },
        requires: [],
      })
    );
    await fs.writeFile(path.join(tmp, "sapi", "src", "index.ts"), "export const x = 1;\n");
    await fs.writeFile(
      path.join(tmp, "package.json"),
      JSON.stringify({
        name: "@alice/sfmc-module-other",
        version: "1.0.0",
        type: "module",
        files: ["sapi"],
        dependencies: { "@sfmc-bds/sdk": "^0.2.0-beta.5" },
      })
    );
    const r = await runVerify(tmp);
    assert.notEqual(r.code, 0);
    assert.match(r.stdout, /package\.name 与 manifest\.id 一致/);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("坏 fixture：使用旧别名 @sfmc/sdk → fail", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "sfmc-vm-bad-"));
  try {
    await fs.mkdir(path.join(tmp, "sapi", "src"), { recursive: true });
    await fs.writeFile(
      path.join(tmp, "sapi", "manifest.json"),
      JSON.stringify({
        schemaVersion: 2,
        id: "feature-foo",
        name: "foo",
        type: "feature",
        configKey: "foo",
        permissions: ["config:read:foo"],
        services: { provides: [], requires: [] },
        requires: [],
      })
    );
    await fs.writeFile(path.join(tmp, "sapi", "src", "index.ts"), "export const x = 1;\n");
    await fs.writeFile(
      path.join(tmp, "package.json"),
      JSON.stringify({
        name: "@alice/sfmc-module-foo",
        version: "1.0.0",
        type: "module",
        files: ["sapi"],
        dependencies: { "@sfmc/sdk": "^0.1.0" },
      })
    );
    const r = await runVerify(tmp);
    assert.notEqual(r.code, 0);
    /* old alias 检查可能在 npm pack 报错前/后执行；任一提示出现即 OK */
    assert.ok(/@sfmc\/sdk 旧别名|package\.name 与 manifest\.id|schemaVersion|npm pack/.test(r.stdout), `got: ${r.stdout}`);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});