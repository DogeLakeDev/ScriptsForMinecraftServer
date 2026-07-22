#!/usr/bin/env node
/**
 * tools/sim-new-user.mjs — 隔离 SFMC_ROOT 冒烟
 *
 * 空 catalog 合法。验证新用户目录下 db-server 能起、modules API 可用。
 *
 * 用法: node tools/sim-new-user.mjs [--keep] [--no-restore]
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { ROOT, DB_SERVER_DIST, CONFIGS_DEFAULT_DIR } from "./lib/paths.mjs";
import { exists } from "./lib/io.mjs";
import { requestJson, waitHealth } from "./lib/http.mjs";
import { killProc } from "./lib/proc.mjs";

const SIM_DIR = path.join(ROOT, "tmp", `sim-${Date.now()}`);
const KEEP = process.argv.includes("--keep");
const NO_RESTORE = process.argv.includes("--no-restore");
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

async function main() {
  if (!exists(DB_SERVER_DIST)) fail(`缺少 ${DB_SERVER_DIST}`);

  fs.mkdirSync(path.join(SIM_DIR, "BDS"), { recursive: true });
  fs.writeFileSync(path.join(SIM_DIR, "BDS", "bedrock_server.exe"), "");
  fs.mkdirSync(path.join(SIM_DIR, "LLBot"), { recursive: true });
  fs.writeFileSync(path.join(SIM_DIR, "LLBot", "llbot.exe"), "");

  fs.mkdirSync(path.join(SIM_DIR, "modules", "packages"), { recursive: true });
  fs.copyFileSync(
    path.join(ROOT, "modules", "catalog.json"),
    path.join(SIM_DIR, "modules", "catalog.json")
  );
  fs.copyFileSync(
    path.join(ROOT, "modules", "module-lock.json"),
    path.join(SIM_DIR, "modules", "module-lock.json")
  );

  fs.mkdirSync(path.join(SIM_DIR, "configs"), { recursive: true });
  fs.writeFileSync(
    path.join(SIM_DIR, "configs", "db_config.json"),
    JSON.stringify({ db_port: DB_PORT, modulesDir: "modules" }) + "\n"
  );
  fs.writeFileSync(
    path.join(SIM_DIR, "configs", "bds_updater.json"),
    JSON.stringify({ bds_path: path.join(SIM_DIR, "BDS") }) + "\n"
  );
  fs.writeFileSync(path.join(SIM_DIR, "configs", "qq_config.json"), "{}\n");
  // 可选复制 defaults
  for (const name of ["settings.json", "permissions.json"]) {
    const src = path.join(CONFIGS_DEFAULT_DIR, name);
    if (exists(src)) fs.copyFileSync(src, path.join(SIM_DIR, "configs", name));
  }
  fs.mkdirSync(path.join(SIM_DIR, "data"), { recursive: true });

  const dbProc = spawn(process.execPath, [DB_SERVER_DIST], {
    cwd: ROOT,
    env: { ...process.env, SFMC_ROOT: SIM_DIR, DB_PORT: String(DB_PORT) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    const ok = await waitHealth(DB_PORT, 15000);
    expect(ok, `db-server 就绪 (port ${DB_PORT})`);

    const mods = await requestJson({
      port: DB_PORT,
      method: "GET",
      path: "/api/sfmc/modules",
    });
    expect(mods.status === 200 && Array.isArray(mods.body.modules), "GET /api/sfmc/modules 返回数组");

    const catalog = await requestJson({
      port: DB_PORT,
      method: "GET",
      path: "/api/sfmc/modules/catalog",
    });
    expect(
      catalog.status === 200 && Array.isArray(catalog.body.modules),
      "GET /api/sfmc/modules/catalog 返回数组"
    );
    expect(
      mods.body.modules.length === catalog.body.modules.length,
      `模块列表与 catalog 数量一致 (n=${mods.body.modules.length})`
    );

    const health = await requestJson({ port: DB_PORT, method: "GET", path: "/api/health" });
    expect(health.status === 200, "GET /api/health → 200");

    log("result", "全部模拟通过");
  } finally {
    await killProc(dbProc.pid);
  }

  if (NO_RESTORE || KEEP) {
    log("done", `工作根保留在 ${path.relative(ROOT, SIM_DIR)}`);
    return;
  }
  fs.rmSync(SIM_DIR, { recursive: true, force: true });
  log("done", `临时目录已清理: ${SIM_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
