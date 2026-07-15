#!/usr/bin/env node

/**
 * bds-manager — BDS 进程管理器
 *
 * 启动/停止/监护 BDS
 *
 * 用法:
 *   node bds-manager.js start          启动 BDS
 *   node bds-manager.js stop           停止（发送 stop 命令）
 *   node bds-manager.js restart        重启
 *   node bds-manager.js status         检查状态
 *   node bds-manager.js send <cmd>     发送命令到 BDS
 *   node bds-manager.js watch          监护（崩溃自动重启）
 *
 */

const { spawn, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { EventEmitter } = require("events");

const SCRIPT_DIR = __dirname;
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const CFG_PATH = path.join(ROOT_DIR, "configs", "bds_updater.json");
const PID_FILE = path.join(SCRIPT_DIR, ".bds.pid");

let cfg = {};
try {
  cfg = JSON.parse(fs.readFileSync(CFG_PATH, "utf-8"));
} catch {}

const BDS_PATH = path.resolve(cfg.bds_path || process.cwd());
const BDS_EXE = path.join(BDS_PATH, "bedrock_server.exe");
const CRASH_RESTART = cfg.crash_restart !== false;
const CRASH_DELAY = (cfg.crash_restart_delay || 5) * 1000;

let bdsProcess = null;
let isManualStop = false;
const events = new EventEmitter();
events.setMaxListeners(100);

function log(msg) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.log(`[${ts}] [BDSManager] ${msg}`);
}

// ────────── PID 文件管理 ──────────

function readPid() {
  try {
    return parseInt(fs.readFileSync(PID_FILE, "utf-8").trim(), 10);
  } catch {
    return 0;
  }
}

function writePid(pid) {
  try {
    fs.writeFileSync(PID_FILE, String(pid));
  } catch {}
}

function clearPid() {
  try {
    fs.unlinkSync(PID_FILE);
  } catch {}
}

function isProcessAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// ────────── 发送命令到 BDS stdin ──────────

function sendCommand(cmd) {
  const pid = readPid();
  if (!pid || !isProcessAlive(pid)) {
    log("BDS 未运行");
    return false;
  }
  // 通过 stdin 方式发送命令需要子进程的 stdin 引用。
  // 如果 bds-manager 是本进程启动的 BDS，直接写 stdin。
  if (bdsProcess && bdsProcess.pid === pid && bdsProcess.stdin) {
    bdsProcess.stdin.write(cmd + "\n");
    log(`已发送命令: ${cmd}`);
    return true;
  }
  // 如果 BDS 不是由本进程启动的（外部启动），
  // 可以通过管道写 stdin。但 stdin 无法跨进程写入，
  // 因此 fallback 到临时文件方式（BDS 不支持标准命令行写入方式）
  log("BDS 由外部启动，无法发送命令到 stdin");
  return false;
}

// ────────── stop ──────────

async function stop() {
  const pid = readPid();
  if (!pid || !isProcessAlive(pid)) {
    log("BDS 未运行");
    clearPid();
    return;
  }

  // 如果是本进程启动的 BDS，通过 stdin 发 stop
  if (bdsProcess && bdsProcess.pid === pid && bdsProcess.stdin) {
    isManualStop = true;
    log("正在关闭 BDS...");
    bdsProcess.stdin.write("stop\n");

    // 等待最多 30s
    await Promise.race([
      new Promise((r) => bdsProcess.on("exit", r)),
      new Promise((r) =>
        setTimeout(() => {
          log("30s 超时，强制终止...");
          try {
            bdsProcess.kill("SIGTERM");
          } catch {}
          setTimeout(r, 5000);
        }, 30000)
      ),
    ]);

    if (bdsProcess && bdsProcess.exitCode === null) {
      log("强制结束进程...");
      try {
        bdsProcess.kill("SIGKILL");
      } catch {}
    }
  } else {
    // 外部启动的 BDS — 尝试 taskkill（无 stdin 管道的 fallback）
    log("BDS 由外部启动，使用 taskkill...");
    try {
      execSync(`taskkill /f /im bedrock_server.exe`, { stdio: "ignore" });
    } catch {}
  }

  clearPid();
  bdsProcess = null;
  log("BDS 已停止");
}

// ────────── start ──────────

async function start() {
  const existing = readPid();
  if (existing && isProcessAlive(existing)) {
    log("BDS 已在运行中");
    return;
  }

  if (!fs.existsSync(BDS_EXE)) {
    log(`未找到 ${BDS_EXE}`);
    process.exit(1);
  }

  log("正在启动 BDS...");
  bdsProcess = spawn(BDS_EXE, [], {
    cwd: BDS_PATH,
    stdio: ["pipe", "pipe", "pipe"],
  });

  writePid(bdsProcess.pid);
  log(`BDS 已启动 (PID: ${bdsProcess.pid})`);

  bdsProcess.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    events.emit("output", text);
    // CLI 模式也输出到控制台
    if (require.main === module) process.stdout.write(text);
  });

  bdsProcess.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    events.emit("output", `[STDERR] ${text}`);
    if (require.main === module) process.stderr.write(text);
  });

  bdsProcess.on("exit", (code) => {
    log(`BDS 已退出 (code: ${code})`);
    clearPid();
    bdsProcess = null;

    // 崩溃自动重启
    if (!isManualStop && CRASH_RESTART && !module.parent) {
      log(`BDS 意外退出，${CRASH_DELAY / 1000}s 后自动重启...`);
      setTimeout(() => start(), CRASH_DELAY);
    }
    isManualStop = false;
  });
}

// ────────── status ──────────

function status() {
  const pid = readPid();
  const alive = pid && isProcessAlive(pid);
  if (alive) {
    console.log(`BDS 运行中 (PID: ${pid})`);
  } else {
    console.log("BDS 未运行");
    clearPid();
  }
  return !!alive;
}

// ────────── watch（监护模式） ──────────

async function watch() {
  log("启动监护模式...");
  while (true) {
    const pid = readPid();
    if (!pid || !isProcessAlive(pid)) {
      await start();
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
}

// ────────── CLI ──────────

const args = process.argv.slice(2);
const cmd = args[0];

if (require.main === module) {
  switch (cmd) {
    case "start":
      start().catch((e) => log(`启动失败: ${e.message}`));
      break;
    case "stop":
      stop().catch((e) => log(`停止失败: ${e.message}`));
      break;
    case "restart":
      stop()
        .then(() => start())
        .catch((e) => log(`重启失败: ${e.message}`));
      break;
    case "status":
      status();
      break;
    case "send":
      if (args[1]) sendCommand(args.slice(1).join(" "));
      else console.log("用法: node bds-manager.js send <command>");
      break;
    case "watch":
      watch().catch((e) => log(`监护异常: ${e.message}`));
      break;
    default:
      console.log(`用法:
  start         启动 BDS
  stop          停止
  restart       重启
  status        检查状态
  send <cmd>    发送命令
  watch         监护模式（崩溃自动重启）`);
  }
}

// ────────── 模块导出 ──────────

module.exports = { start, stop, status, sendCommand, events };
