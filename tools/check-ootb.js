#!/usr/bin/env node
/**
 * check-ootb.js — 开箱即用（Out-of-the-box）自检
 *
 * 校验:
 *   1. 仓库可发现必需文件 (.env / catalog.json / configs/)
 *   2. 工具脚本存在 (check-catalog / lock / install-module / smoke / sim)
 *   3. db-server 可启动 + 模块 API + setup API 正常
 *   4. SAPI 依赖版本匹配 manifest
 *   5. sim-new-user 流程可跑通
 *   6. 主入口 CLI/TUI/help 子命令可被发现
 *
 * 用法: node tools/check-ootb.js
 */
const fs = require("node:fs");
const path = require("node:path");
const { spawn, execSync } = require("node:child_process");
const http = require("node:http");

async function main() {

const ROOT = path.resolve(__dirname, "..");
const errors = [];
const passed = [];

function pass(name) { passed.push(name); console.log(`[ootb] PASS: ${name}`); }
function fail(name, why) { errors.push({ name, why }); console.error(`[ootb] FAIL: ${name} — ${why}`); }
function exists(p) { try { fs.accessSync(p, fs.constants.F_OK); return true; } catch { return false; } }

function fileContains(p, needle) {
  if (!exists(p)) return false;
  return fs.readFileSync(p, "utf-8").includes(needle);
}

// 1) 仓库必需文件
{
  const required = [
    ".gitignore",
    "AGENTS.md",
    "README.md",
    "modules/catalog.json",
    "modules/module-lock.json",
    "modules/README.md",
    "configs/modules.json",
    "configs/db_config.json",
    "configs/bds_updater.json",
    "configs/qq_config.json",
    "scriptsforminecraftserver/package.json",
    "scriptsforminecraftserver/tsconfig.json",
    "scriptsforminecraftserver/scripts/main.ts",
    "scriptsforminecraftserver/scripts/entry.ts",
    "db-server/index.js",
    "qq-bridge/index.js",
    "panel/index.js",
    "panel/package.json",
  ];
  let missing = [];
  for (const f of required) {
    if (!exists(path.join(ROOT, f))) missing.push(f);
  }
  if (missing.length === 0) pass("必备仓库文件齐全");
  else fail("必备仓库文件齐全", "缺失: " + missing.join(", "));
}

// 2) 工具脚本
{
  const tools = ["check-catalog.js", "install-module.js", "lock.js", "smoke-modules.js", "sim-new-user.js"];
  let missing = [];
  for (const f of tools) {
    if (!exists(path.join(ROOT, "tools", f))) missing.push(f);
  }
  if (missing.length === 0) pass("工具脚本齐全");
  else fail("工具脚本齐全", "缺失: " + missing.join(", "));
}

// 3) check-catalog 通过
{
  const r = spawnSyncSafe(process.execPath, [path.join(ROOT, "tools", "check-catalog.js")], { cwd: ROOT });
  if (r.status === 0) pass("check-catalog 通过");
  else fail("check-catalog 通过", r.stderr || r.stdout || `exit ${r.status}`);
}

// 4) .env 检查（可选，但若缺 .env 给出建议）
{
  const envPath = path.join(ROOT, "scriptsforminecraftserver", ".env");
  if (exists(envPath)) pass("scriptsforminecraftserver/.env 存在");
  else console.log("[ootb] WARN: scriptsforminecraftserver/.env 不存在，首次 build 需手动创建");
}

// 5) manifest 与 package.json 关键依赖一致性
{
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "scriptsforminecraftserver", "behavior_packs", "ScriptsForMinecraftServer", "manifest.json"), "utf-8"));
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "scriptsforminecraftserver", "package.json"), "utf-8"));
  const manifestModules = new Set((manifest.dependencies || []).map((d) => d.module_name));
  const pkgDeps = Object.keys(pkg.dependencies || {});
  // 关键模块必须在 manifest 与 package.json 中都存在
  const critical = ["@minecraft/server"];
  const missing = critical.filter((m) => !manifestModules.has(m) || !pkgDeps.includes(m));
  if (missing.length === 0) pass("manifest 关键依赖 @minecraft/server 一致");
  else fail("manifest 关键依赖一致", `缺失: ${missing.join(", ")}`);
}

// 6) db-server 启动 + 模块接口
{
  let dbProc = null;
  try {
    dbProc = spawn(process.execPath, [path.join(ROOT, "db-server", "index.js")], {
      cwd: ROOT,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const ok = await waitHealth(3001, 15000);
    if (!ok) throw new Error("db-server 不可达");
    const mods = await fetchJson("/api/sfmc/modules");
    if (mods.status !== 200) throw new Error(`modules 接口 ${mods.status}`);
    if (!Array.isArray(mods.body.modules) || mods.body.modules.length === 0) throw new Error("modules 为空");
    pass("db-server 启动 + 模块接口");

    const st = await fetchJson("/api/sfmc/setup/state");
    if (st.status === 200) pass("/api/sfmc/setup/state 可达");
    else fail("/api/sfmc/setup/state 可达", `status=${st.status}`);
  } catch (e) {
    fail("db-server 启动 + 模块接口", e.message);
  } finally {
    if (dbProc) await killProc(dbProc.pid);
    await new Promise((r) => setTimeout(r, 800));
  }
}

// 7) sim-new-user 流程
{
  const r = spawnSyncSafe(process.execPath, [path.join(ROOT, "tools", "sim-new-user.js")], { cwd: ROOT, timeout: 60000 });
  if (r.status === 0) pass("sim-new-user 全流程通过");
  else fail("sim-new-user 全流程通过", r.stderr || r.stdout || `exit ${r.status}`);
}

// 8) panel/index.js --help 应可执行
{
  const r = spawnSyncSafe(process.execPath, [path.join(ROOT, "panel", "index.js"), "--help"], { cwd: ROOT });
  if (r.status === 0 && /BDS Panel/.test(r.stdout)) pass("panel/index.js --help 可用");
  else fail("panel/index.js --help 可用", r.stderr || r.stdout || `exit ${r.status}`);
}

// 9) npm scripts 存在
{
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "scriptsforminecraftserver", "package.json"), "utf-8"));
  const required = ["build", "lint", "clean"];
  const missing = required.filter((s) => !pkg.scripts || !pkg.scripts[s]);
  if (missing.length === 0) pass("SAPI npm scripts 齐全");
  else fail("SAPI npm scripts 齐全", "缺失: " + missing.join(", "));
}

// 总结
console.log(`\n[ootb] 通过 ${passed.length} / 失败 ${errors.length}`);
if (errors.length > 0) {
  console.error(`\n[ootb] 失败项目:`);
  for (const e of errors) console.error(`  - ${e.name}: ${e.why}`);
  process.exit(1);
}
process.exit(0);
}

main().catch((e) => { console.error("[ootb] ERROR:", e); process.exit(1); });

// ============================================================
function spawnSyncSafe(cmd, args, opts = {}) {
  try {
    const stdout = execSync(`${quote(cmd)} ${args.map(quote).join(" ")}`, { ...opts, stdio: ["ignore", "pipe", "pipe"], encoding: "utf-8" });
    return { status: 0, stdout, stderr: "" };
  } catch (e) {
    return { status: typeof e.status === "number" ? e.status : 1, stdout: e.stdout || "", stderr: e.stderr || "" };
  }
}
function quote(s) { return /\s/.test(s) ? `"${s}"` : s; }

function fetchJson(urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port: 3001, path: urlPath, method: "GET", timeout: 4000 }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, body }); }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.end();
  });
}

function waitHealth(port, timeoutMs) {
  return new Promise((resolve) => {
    const start = Date.now();
    (function tick() {
      const req = http.request({ hostname: "127.0.0.1", port, path: "/api/health", timeout: 500 }, (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) return resolve(false);
        setTimeout(tick, 200);
      });
      req.on("timeout", () => req.destroy());
      req.end();
    })();
  });
}

async function killProc(pid) {
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /F /PID ${pid} /T 2>nul`, { stdio: "ignore" });
    } else {
      try { process.kill(pid, "SIGTERM"); } catch {}
    }
    await new Promise((r) => setTimeout(r, 600));
  } catch {}
}