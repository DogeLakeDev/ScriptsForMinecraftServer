#!/usr/bin/env node
// @ts-check
/**
 * tools/run-with-db-server.mjs — 拉起 db-server，等 /api/health，再跑子命令
 *
 * CI / 本地冒烟共用（Windows / Linux / macOS）。子命令结束后必杀 db-server。
 *
 * 用法:
 *   node packages/tools/run-with-db-server.mjs [--] <cmd> [args...]
 *   node packages/tools/run-with-db-server.mjs node packages/tools/smoke-modules.mjs
 *
 * 环境: SFMC_ROOT、DB_PORT（默认 3001）
 */
import { findMonorepoRoot } from "@sfmc-bds/sdk/node/config";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { waitHealth } from "./lib/http.mjs";
import { exists } from "./lib/io.mjs";
import { TOOLS_PKG_DIR } from "./lib/paths.mjs";
import { killProc } from "./lib/proc.mjs";

/** 可执行文件在仓库/安装树，与 SFMC_ROOT（数据根）解耦 — DIP */
const REPO_ROOT = findMonorepoRoot(TOOLS_PKG_DIR) ?? path.resolve(TOOLS_PKG_DIR, "..", "..");
const DB_SERVER_DIST = path.join(REPO_ROOT, "packages", "db-server", "dist", "index.js");

const HEALTH_TIMEOUT_MS = 20_000;
const LOG_CAP = 32_000;

/**
 * @param {string[]} argv
 * @returns {string[]}
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
  if (!exists(DB_SERVER_DIST)) {
    console.error(`[run-with-db-server] 缺少 ${DB_SERVER_DIST} — 先 npm run build`);
    process.exit(1);
  }

  const port = parseInt(process.env.DB_PORT || "3001", 10);
  const childArgs = parseChildArgs(process.argv.slice(2));
  const dataRoot = process.env.SFMC_ROOT || REPO_ROOT;

  /** @type {string} */
  let errLog = "";
  let dbExit = /** @type {number | null} */ (null);
  const dbProc = spawn(process.execPath, [DB_SERVER_DIST], {
    cwd: REPO_ROOT,
    env: { ...process.env, SFMC_ROOT: dataRoot, DB_PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  dbProc.stderr?.on("data", (chunk) => {
    const s = String(chunk);
    process.stderr.write(s);
    if (errLog.length < LOG_CAP) errLog += s;
  });
  dbProc.on("exit", (code) => {
    dbExit = code;
  });

  let exitCode = 1;
  try {
    const ready = await waitHealth(port, HEALTH_TIMEOUT_MS);
    if (!ready) {
      console.error(
        `[run-with-db-server] db-server 未就绪 (port=${port}` +
          (dbExit !== null ? `, exit=${dbExit}` : "") +
          ")"
      );
      if (errLog) console.error(errLog.slice(0, LOG_CAP));
      exitCode = 1;
    } else {
      const child = spawnChild(childArgs, port);
      exitCode = await new Promise((resolve) => {
        child.on("error", (err) => {
          console.error(`[run-with-db-server] 子进程启动失败: ${err.message}`);
          resolve(1);
        });
        child.on("close", (code) => resolve(code ?? 1));
      });
    }
  } finally {
    await killProc(dbProc.pid);
  }
  process.exit(exitCode);
}

main().catch((e) => {
  console.error("[run-with-db-server] ERROR:", e);
  process.exit(1);
});
