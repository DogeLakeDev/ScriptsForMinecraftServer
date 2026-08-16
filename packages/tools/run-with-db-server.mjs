#!/usr/bin/env node
// @ts-check
/**
 * 拉起 db-server，等 /api/health，再跑子命令（CI / 本地 ad-hoc）
 *
 * @deprecated 平台 CI 请用 verify.mjs；本脚本保留给需要自定义子命令的场景。
 */
import { spawn } from "node:child_process";
import process from "node:process";
import { findMonorepoRoot } from "@sfmc-bds/sdk/node/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withDbServer } from "./lib/verify/db-harness.mjs";
import { TOOLS_PKG_DIR } from "./lib/paths.mjs";

const REPO_ROOT = findMonorepoRoot(TOOLS_PKG_DIR) ?? path.resolve(TOOLS_PKG_DIR, "..", "..");

/**
 * @param {string[]} argv
 */
function parseChildArgs(argv) {
  const rest = argv[0] === "--" ? argv.slice(1) : argv;
  if (rest.length === 0) {
    console.error("用法: run-with-db-server.mjs [--] <cmd> [args...]");
    process.exit(2);
  }
  const cmd = rest[0] ?? "";
  if (cmd === "node" || cmd === "node.exe") {
    return [process.execPath, ...rest.slice(1)];
  }
  return rest;
}

/**
 * @param {string[]} childArgs
 * @param {number} port
 */
function spawnChild(childArgs, port) {
  const [cmd, ...args] = childArgs;
  const isNpm = cmd === "npm" || cmd === "npm.cmd" || cmd === "npm.exe";
  return spawn(cmd ?? "", args, {
    cwd: REPO_ROOT,
    env: { ...process.env, DB_PORT: String(port) },
    stdio: "inherit",
    shell: isNpm && process.platform === "win32",
  });
}

async function main() {
  const port = parseInt(process.env.DB_PORT || "3001", 10);
  const childArgs = parseChildArgs(process.argv.slice(2));
  const dataRoot = process.env.SFMC_ROOT || REPO_ROOT;

  let exitCode = 1;
  try {
    await withDbServer({ dataRoot, port, cwd: REPO_ROOT }, async (readyPort) => {
      const child = spawnChild(childArgs, readyPort);
      exitCode = await new Promise((resolve) => {
        child.on("error", (err) => {
          console.error(`[run-with-db-server] 子进程启动失败: ${err.message}`);
          resolve(1);
        });
        child.on("close", (code) => resolve(code ?? 1));
      });
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[run-with-db-server] ERROR: ${message}`);
    exitCode = 1;
  }
  process.exit(exitCode);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((e) => {
    console.error("[run-with-db-server] ERROR:", e);
    process.exit(1);
  });
}
