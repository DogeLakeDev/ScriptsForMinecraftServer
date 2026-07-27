/**
 * process-probe 单元测试：PID 文件纯函数 + 可注入 exec 的探测逻辑
 * 运行: npm test -w @sfmc-bds/bds-tools（需先 build）
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const pkgRoot = path.dirname(fileURLToPath(import.meta.url));
const distProbe = path.join(pkgRoot, "dist", "process-probe.js");

async function loadProbe() {
  return import(pathToFileURL(distProbe).href);
}

describe("process-probe pid file", () => {
  let tempRoot = "";

  after(() => {
    if (tempRoot) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("read/write/clear bds.pid 在独立 temp 根目录", async () => {
    const probe = await loadProbe();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-probe-"));

    assert.equal(probe.readBdsPidFile(tempRoot), 0);

    probe.writeBdsPidFile(4242, tempRoot);
    assert.equal(probe.readBdsPidFile(tempRoot), 4242);

    probe.clearBdsPidFile(tempRoot);
    assert.equal(probe.readBdsPidFile(tempRoot), 0);
  });
});

describe("process-probe probeBdsStatus", () => {
  let tempRoot = "";
  const calls = [];

  after(async () => {
    const probe = await loadProbe();
    probe.setExecForTesting(null);
    if (tempRoot) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("managedPid + hasStdin 且进程存活 → managed", async () => {
    const probe = await loadProbe();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-probe-"));
    calls.length = 0;

    probe.setExecForTesting(async (cmd) => {
      calls.push(cmd);
      if (cmd.includes("PID eq 100")) {
        return { stdout: "bedrock_server.exe  100 Console", stderr: "" };
      }
      return { stdout: "", stderr: "" };
    });

    const result = await probe.probeBdsStatus({ managedPid: 100, hasStdin: true, rootDir: tempRoot });
    assert.deepEqual(result, { state: "managed", pid: 100 });
  });

  it("PID 文件存活但无 stdin → external", async () => {
    const probe = await loadProbe();
    probe.writeBdsPidFile(200, tempRoot);

    probe.setExecForTesting(async (cmd) => {
      if (cmd.includes("PID eq 200")) {
        return { stdout: "bedrock_server.exe  200 Console", stderr: "" };
      }
      return { stdout: "", stderr: "" };
    });

    const result = await probe.probeBdsStatus({ managedPid: 200, hasStdin: false, rootDir: tempRoot });
    assert.equal(result.state, "external");
    assert.equal(result.pid, 200);
  });

  it("无 PID 文件但有 bedrock_server 镜像 → external", async () => {
    const probe = await loadProbe();
    probe.clearBdsPidFile(tempRoot);

    probe.setExecForTesting(async (cmd) => {
      if (cmd.includes("IMAGENAME eq bedrock_server.exe")) {
        return { stdout: '"bedrock_server.exe","555","Console","1","999 K"\n', stderr: "" };
      }
      return { stdout: "", stderr: "" };
    });

    const result = await probe.probeBdsStatus({ rootDir: tempRoot });
    assert.deepEqual(result, { state: "external", pid: 555 });
  });
});
