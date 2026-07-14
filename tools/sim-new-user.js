#!/usr/bin/env node
/**
 * sim-new-user.js — 模拟"全新用户从零使用"
 *
 * 流程:
 *  1. 备份真实 configs/、modules/module-lock.json、panel-state.json 到 .sim-workspace.bak/
 *  2. 复制一份"干净"工作根到 .sim-workspace/（仅含 catalog/QQ 配置）
 *  3. 创建伪 BDS / LLBot 可执行文件，让 /setup/check 通过
 *  4. 启动 db-server 指向 .sim-workspace（通过 SFMC_ROOT 环境变量）
 *  5. 验证 /setup/state 返回 initialized=false
 *  6. 调用 /setup/init 模拟新用户提交
 *  7. 验证 panel-state.json / configs/ / module-lock.json 全部落地
 *  8. 调用 /setup/reset 验证回滚
 *  9. 退出后自动还原用户真实配置
 *
 * 用法:
 *   node tools/sim-new-user.js          # 跑完整模拟
 *   node tools/sim-new-user.js --keep   # 保留 .sim-workspace 供调试
 *   node tools/sim-new-user.js --no-restore  # 不还原真实配置（用于排查）
 */
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { spawn, execSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const SIM_DIR = path.join(ROOT, "tools", ".sim-workspace");
const BAK_DIR = path.join(ROOT, "tools", ".sim-workspace.bak");

const KEEP = process.argv.includes("--keep");
const NO_RESTORE = process.argv.includes("--no-restore");

const FILES_TO_BACKUP = [
  "configs/db_config.json",
  "configs/bds_updater.json",
  "configs/qq_config.json",
  "configs/settings.json",
  "configs/areas.json",
  "configs/grids.json",
  "configs/permissions.json",
  "configs/banned_items.json",
  "configs/clean.json",
  "configs/peace_filters.json",
  "configs/questions.json",
  "modules/module-lock.json",
  "modules/lock.json",
  "panel-state.json",
  "db-server/sfmc_data.db",
  "db-server/sfmc_data.db-shm",
  "db-server/sfmc_data.db-wal",
];

function exists(p) { try { fs.accessSync(p, fs.constants.F_OK); return true; } catch { return false; } }
function rmrf(p) { if (!exists(p)) return; fs.rmSync(p, { recursive: true, force: true }); }
function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function log(stage, msg) {
  console.log(`[sim:${stage}] ${msg}`);
}

function backup() {
  log("backup", `→ ${path.relative(ROOT, BAK_DIR)}`);
  rmrf(BAK_DIR);
  fs.mkdirSync(BAK_DIR, { recursive: true });
  for (const f of FILES_TO_BACKUP) {
    const src = path.join(ROOT, f);
    if (exists(src)) copyFile(src, path.join(BAK_DIR, f));
  }
}

function restore() {
  log("restore", `← ${path.relative(ROOT, BAK_DIR)}`);
  for (const f of FILES_TO_BACKUP) {
    const dest = path.join(ROOT, f);
    const src = path.join(BAK_DIR, f);
    if (exists(src)) copyFile(src, dest);
    else if (exists(dest)) fs.unlinkSync(dest);
  }
  rmrf(SIM_DIR);
  rmrf(BAK_DIR);
}

function buildSimWorkspace() {
  log("init", `构建 ${path.relative(ROOT, SIM_DIR)}`);
  rmrf(SIM_DIR);
  fs.mkdirSync(SIM_DIR, { recursive: true });

  // 必须保留的源数据
  fs.mkdirSync(path.join(SIM_DIR, "modules"), { recursive: true });
  copyFile(path.join(ROOT, "modules", "catalog.json"), path.join(SIM_DIR, "modules", "catalog.json"));
  fs.mkdirSync(path.join(SIM_DIR, "db-server"), { recursive: true });

  // 纯净 configs/（仅 db_config，其余按需 init 写入）
  fs.mkdirSync(path.join(SIM_DIR, "configs"), { recursive: true });
  const simPort = 3091;
  const cleanDbConfig = { db_port: simPort };
  fs.writeFileSync(path.join(SIM_DIR, "configs", "db_config.json"), JSON.stringify(cleanDbConfig, null, 2) + "\n");

  // 伪 BDS 安装目录
  const fakeBdsPath = path.join(SIM_DIR, "fake-bds");
  fs.mkdirSync(fakeBdsPath, { recursive: true });
  fs.writeFileSync(path.join(fakeBdsPath, "bedrock_server.exe"), "FAKE_BDS_FOR_SIM\n");

  // 伪 LLBot
  const fakeLlbotDir = path.join(SIM_DIR, "fake-llbot");
  fs.mkdirSync(fakeLlbotDir, { recursive: true });
  fs.writeFileSync(path.join(fakeLlbotDir, "llbot.exe"), "FAKE_LLBOT_FOR_SIM\n");

  // 干净 panel-state.json（_initialized=false）
  const cleanState = {
    version: 1,
    _initialized: false,
    _initializedAt: null,
    owner: "",
    ui: {
      defaultModules: ["money", "chat", "afk", "shop", "land", "tps"],
      defaultServices: ["db", "qq"],
      skipGuidedSetup: false,
    },
    tokens: { dbAuthToken: "", bridgeAuthToken: "" },
    paths: {
      bdsPath: fakeBdsPath,
      llbotPath: path.join(fakeLlbotDir, "llbot.exe"),
      llbotCwd: fakeLlbotDir,
      dbPort: simPort,
    },
    locale: "zh-CN",
  };
  fs.writeFileSync(path.join(SIM_DIR, "panel-state.json"), JSON.stringify(cleanState, null, 2) + "\n");

  // 干净 modules/module-lock.json
  fs.writeFileSync(path.join(SIM_DIR, "modules", "module-lock.json"), JSON.stringify({ version: 1, modules: {} }, null, 2) + "\n");


  return { fakeBdsPath, fakeLlbotDir, fakeLlbotPath: path.join(fakeLlbotDir, "llbot.exe") };
}

function startDbServer(workspace) {
  log("db", "启动 db-server (指向工作根, 独立端口)");
  const simPort = 3091;
  const child = spawn(process.execPath, [path.join(ROOT, "db-server", "index.js")], {
    cwd: ROOT,
    env: {
      ...process.env,
      SFMC_ROOT: workspace,
      SFMC_DB_PATH: path.join(workspace, "db-server", "sfmc_data.db"),
      SFMC_MODULES_DIR: path.join(workspace, "modules"),
      DB_PORT: String(simPort),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (d) => process.stdout.write(`[db] ${d}`));
  child.stderr.on("data", (d) => process.stderr.write(`[db] ${d}`));
  child._simPort = simPort;
  return child;
}

function waitForPort(port, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function tick() {
      const req = http.request({ hostname: "127.0.0.1", port, path: "/api/health", timeout: 500 }, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) return reject(new Error("db-server 启动超时"));
        setTimeout(tick, 200);
      });
      req.on("timeout", () => req.destroy(new Error("timeout")));
      req.end();
    })();
  });
}

function request(method, urlPath, payload, portOverride) {
  return new Promise((resolve, reject) => {
    const data = payload ? JSON.stringify(payload) : '';
    const req = http.request({
      hostname: '127.0.0.1',
      port: portOverride || 3091,
      path: urlPath,
      method,
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {},
      timeout: 5000,
    }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, body }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function expect(cond, msg) {
  if (!cond) { console.error(`[sim] FAIL: ${msg}`); process.exitCode = 1; throw new Error(msg); }
  console.log(`[sim] PASS: ${msg}`);
}

async function main() {
  backup();
  const { fakeBdsPath, fakeLlbotPath, fakeLlbotDir } = buildSimWorkspace();

  const db = startDbServer(SIM_DIR);
  let dbStopped = false;
  async function stopDb() {
    if (dbStopped) return;
    dbStopped = true;
    try {
      if (process.platform === "win32") {
        execSync(`taskkill /F /PID ${db.pid} /T 2>nul`, { stdio: "ignore" });
      } else {
        try { db.kill("SIGTERM"); } catch {}
      }
    } catch {}
  }
  process.on("exit", () => { try { stopDb(); } catch {} });
  process.on("SIGINT", () => { try { stopDb(); } catch {}; process.exit(130); });

  try {
    await waitForPort(3091);
    log("db", "已就绪 (port 3091)");

    // 1) /setup/state 应返回 _initialized=false
    const st1 = await request("GET", "/api/sfmc/setup/state");
    expect(st1.status === 200, "GET /setup/state → 200");
    expect(st1.body.initialized === false, "新工作根: initialized=false");

    // 2) /setup/check 验证依赖
    const ck = await request("POST", "/api/sfmc/setup/check", {
      db: { port: 3001 },
      bds: { path: fakeBdsPath },
      qq: { llbot_path: fakeLlbotPath, llbot_cwd: fakeLlbotDir },
    });
    expect(ck.status === 200 && Array.isArray(ck.body.checks), "/setup/check 返回 checks");
    expect(ck.body.checks.every((c) => c.ok), "/setup/check 全绿: " + ck.body.checks.map((c) => c.label).join("; "));

    // 3) /setup/init 模拟用户提交
    const initPayload = {
      paths: {
        bdsPath: fakeBdsPath,
        llbotPath: fakeLlbotPath,
        llbotCwd: fakeLlbotDir,
        dbPort: 3001,
      },
      tokens: { dbAuthToken: "", bridgeAuthToken: "" },
      ui: {
        defaultModules: ["money", "chat", "afk", "shop", "land", "tps"],
        defaultServices: ["db", "qq"],
        skipGuidedSetup: false,
      },
      locale: "zh-CN",
    };
    const init = await request("POST", "/api/sfmc/setup/init", initPayload);
    expect(init.status === 200 && init.body.success === true, "/setup/init 成功");
    expect(init.body.state._initialized === true, "init 后 state._initialized=true");
    expect(init.body.written.includes("panel-state.json"), "panel-state.json 已写入");

    // 4) 检查落盘内容
    const statePath = path.join(SIM_DIR, "panel-state.json");
    const stateOnDisk = JSON.parse(fs.readFileSync(statePath, "utf-8"));
    expect(stateOnDisk._initialized === true, "盘上 panel-state.json._initialized=true");
    expect(stateOnDisk.paths.bdsPath === fakeBdsPath, "盘上 bdsPath 与提交一致");

    const moduleLock = JSON.parse(fs.readFileSync(path.join(SIM_DIR, "modules", "module-lock.json"), "utf-8"));
    for (const k of initPayload.ui.defaultModules) {
      const module = JSON.parse(fs.readFileSync(path.join(SIM_DIR, "modules", "catalog.json"), "utf-8")).modules.find((m) => m.configKey === k);
      expect(module && moduleLock.modules[module.id]?.enabled === true, `module-lock.${k}.enabled = true`);
    }

    // 5) /setup/state2
    const st2 = await request("GET", "/api/sfmc/setup/state");
    expect(st2.body.initialized === true, "再次 GET /setup/state → initialized=true");

    // 6) /setup/reset 模拟回滚
    const rst = await request("POST", "/api/sfmc/setup/reset", {});
    expect(rst.status === 200, "/setup/reset → 200");
    expect(rst.body.state._initialized === false, "reset 后 _initialized=false");

    const st3 = await request("GET", "/api/sfmc/setup/state");
    expect(st3.body.initialized === false, "reset 后 state.initialized=false");

    // 7) 二次 init 模拟"再次配置"
    const reinit = await request("POST", "/api/sfmc/setup/init", initPayload);
    expect(reinit.status === 200 && reinit.body.success === true, "再次 init 成功");

    log("result", "全部模拟通过");
  } finally {
    await stopDb();
  }

  if (NO_RESTORE) {
    log("done", `--no-restore: 工作根保留在 ${path.relative(ROOT, SIM_DIR)}`);
    return;
  }
  if (!KEEP) {
    restore();
    log("done", "用户真实配置已还原");
  } else {
    log("done", `--keep: 工作根保留 ${path.relative(ROOT, SIM_DIR)}`);
  }
}

main().catch((e) => { console.error("[sim] ERROR:", e.message); process.exitCode = 1; });
