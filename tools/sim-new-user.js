#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const BASE = path.join(ROOT, "modules", "catalog.json");

const SIM_DIR = path.join(ROOT, "tmp", `sim-${Date.now()}`);
const NO_RESTORE = process.argv.includes("--no-restore");
const KEEP = process.argv.includes("--keep");
const DB_PORT = 3091;

function log(tag, msg) {
  console.log(`[${tag}] ${msg}`);
}

function fail(msg) {
  console.error(`[FAIL] ${msg}`);
  process.exit(1);
}

function expect(cond, msg) {
  if (cond) log("PASS", msg);
  else fail(msg);
}

let dbProc = null;

function startDb(simDir) {
  const env = { ...process.env, SFMC_ROOT: simDir, DB_PORT: String(DB_PORT) };
  dbProc = spawn(process.execPath, [path.join(ROOT, "db-server", "index.js")], {
    cwd: ROOT,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let buf = "";
  dbProc.stdout.on("data", (d) => { buf += d.toString(); });
  dbProc.stderr.on("data", (d) => { buf += d.toString(); });
  return dbProc;
}

function stopDb() {
  if (!dbProc || dbProc.killed) return;
  try {
    if (process.platform === "win32") {
      require("child_process").execSync(`taskkill /F /PID ${dbProc.pid} /T 2>nul`, { stdio: "ignore" });
    } else {
      dbProc.kill("SIGTERM");
    }
  } catch {}
}

function request(method, reqPath, payload) {
  return new Promise((resolve, reject) => {
    const data = payload ? JSON.stringify(payload) : "";
    const r = http.request(
      { hostname: "127.0.0.1", port: DB_PORT, path: reqPath, method, timeout: 3000,
        headers: data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {},
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
          catch { resolve({ status: res.statusCode, body }); }
        });
      },
    );
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}

function waitForPort(port, timeoutMs = 10000) {
  const net = require("net");
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tryConnect = () => {
      const sock = net.connect(port, "127.0.0.1", () => { sock.destroy(); resolve(); });
      sock.on("error", () => {
        sock.destroy();
        if (Date.now() - start > timeoutMs) reject(new Error("timeout"));
        else setTimeout(tryConnect, 200);
      });
    };
    tryConnect();
  });
}

function cloneRecursive(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(d, { recursive: true });
      cloneRecursive(s, d);
    } else if (entry.isFile()) {
      fs.copyFileSync(s, d);
    }
  }
}

async function main() {
  const fakeBdsPath = path.join(SIM_DIR, "BDS");
  const fakeLlbotPath = path.join(SIM_DIR, "LLBot", "llbot.exe");
  const fakeLlbotDir = path.join(SIM_DIR, "LLBot");

  fs.mkdirSync(fakeBdsPath, { recursive: true });
  fs.writeFileSync(path.join(fakeBdsPath, "bedrock_server.exe"), "");
  fs.mkdirSync(fakeLlbotDir, { recursive: true });
  fs.writeFileSync(fakeLlbotPath, "");

  fs.mkdirSync(path.join(SIM_DIR, "modules"), { recursive: true });
  fs.cpSync(path.join(ROOT, "modules", "catalog.json"), path.join(SIM_DIR, "modules", "catalog.json"));
  fs.cpSync(path.join(ROOT, "modules", "module-lock.json"), path.join(SIM_DIR, "modules", "module-lock.json"));

  fs.mkdirSync(path.join(SIM_DIR, "configs"), { recursive: true });
  fs.writeFileSync(path.join(SIM_DIR, "configs", "db_config.json"), JSON.stringify({ db_port: DB_PORT }));
  fs.writeFileSync(path.join(SIM_DIR, "configs", "bds_updater.json"), JSON.stringify({ bds_path: fakeBdsPath }));
  fs.writeFileSync(path.join(SIM_DIR, "configs", "qq_config.json"), JSON.stringify({}));

  startDb(SIM_DIR);

  process.on("exit", () => { try { stopDb(); } catch {} });
  process.on("SIGINT", () => { try { stopDb(); } catch {}; process.exit(130); });

  try {
    await waitForPort(3091);
    log("db", "已就绪 (port 3091)");

    const mods = await request("GET", "/api/sfmc/modules");
    expect(mods.status === 200 && Array.isArray(mods.body.modules), "GET /api/sfmc/modules 返回模块列表");

    const catalog = await request("GET", "/api/sfmc/modules/catalog");
    expect(catalog.status === 200 && catalog.body.modules.length > 0, "GET /api/sfmc/modules/catalog 返回模块");
    expect(mods.body.modules.length === catalog.body.modules.length, "模块列表与 catalog 数量一致");

    const moduleLock = JSON.parse(fs.readFileSync(path.join(SIM_DIR, "modules", "module-lock.json"), "utf-8"));
    const catData = JSON.parse(fs.readFileSync(path.join(SIM_DIR, "modules", "catalog.json"), "utf-8"));

    log("result", "全部模拟通过");
  } finally {
    await stopDb();
  }

  if (NO_RESTORE) {
    log("done", `--no-restore: 工作根保留在 ${path.relative(ROOT, SIM_DIR)}`);
    return;
  }
  if (!KEEP) {
    fs.rmSync(SIM_DIR, { recursive: true, force: true });
    log("done", `临时目录已清理: ${SIM_DIR}`);
  } else {
    log("done", `--keep: 工作根保留在 ${path.relative(ROOT, SIM_DIR)}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
