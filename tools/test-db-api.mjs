#!/usr/bin/env node
/**
 * tools/test-db-api.mjs — 平台 API 烟测(v2)
 *
 * 覆盖 health / modules / configs。允许 0 模块。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { ROOT, DB_SERVER_DIST, CONFIGS_DEFAULT_DIR, CONFIGS_DIR } from "./lib/paths.mjs";
import { exists } from "./lib/io.mjs";
import { requestJson, waitHealth } from "./lib/http.mjs";
import { killProc } from "./lib/proc.mjs";

const PORT = 3191;
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-db-api-"));
const dbPath = path.join(workspace, "sfmc_data.db");

function copy(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`[db-api] PASS: ${message}`);
}

async function main() {
  if (!exists(DB_SERVER_DIST)) throw new Error(`缺少 ${DB_SERVER_DIST}`);

  copy(path.join(ROOT, "modules", "catalog.json"), path.join(workspace, "modules", "catalog.json"));
  copy(
    path.join(ROOT, "modules", "module-lock.json"),
    path.join(workspace, "modules", "module-lock.json")
  );

  const packagesSrc = path.join(ROOT, "modules", "packages");
  const packagesDst = path.join(workspace, "modules", "packages");
  if (exists(packagesSrc)) {
    fs.cpSync(packagesSrc, packagesDst, { recursive: true });
  } else {
    fs.mkdirSync(packagesDst, { recursive: true });
  }

  fs.mkdirSync(path.join(workspace, "data"), { recursive: true });
  fs.mkdirSync(path.join(workspace, "configs"), { recursive: true });
  fs.writeFileSync(
    path.join(workspace, "configs", "db_config.json"),
    JSON.stringify({ db_port: PORT, dbDir: "./data/sfmc_data.db", modulesDir: "modules" }) + "\n"
  );
  for (const name of ["qq_config.json", "settings.json", "permissions.json"]) {
    if (exists(path.join(CONFIGS_DIR, name))) {
      copy(path.join(CONFIGS_DIR, name), path.join(workspace, "configs", name));
    } else if (exists(path.join(CONFIGS_DEFAULT_DIR, name))) {
      copy(path.join(CONFIGS_DEFAULT_DIR, name), path.join(workspace, "configs", name));
    }
  }

  const child = spawn(process.execPath, [DB_SERVER_DIST], {
    cwd: ROOT,
    env: {
      ...process.env,
      SFMC_ROOT: workspace,
      SFMC_DB_PATH: dbPath,
      SFMC_MODULES_DIR: path.join(workspace, "modules"),
      DB_PORT: String(PORT),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  try {
    const ok = await waitHealth(PORT, 10000);
    if (!ok) throw new Error("db-server 启动超时");

    const health = await requestJson({ port: PORT, method: "GET", path: "/api/health" });
    assert(health.body.status === "ok" || health.status === 200, "health 路由返回 ok");

    const catalog = await requestJson({
      port: PORT,
      method: "GET",
      path: "/api/sfmc/modules/catalog",
    });
    assert(catalog.status === 200 && Array.isArray(catalog.body.modules), "modules/catalog 返回数组");

    const modules = await requestJson({ port: PORT, method: "GET", path: "/api/sfmc/modules" });
    assert(
      modules.status === 200 && modules.body.modules.length === catalog.body.modules.length,
      `模块列表与 catalog 数量一致 (n=${catalog.body.modules.length})`
    );

    const configsAll = await requestJson({
      port: PORT,
      method: "GET",
      path: "/api/sfmc/configs/all",
    });
    assert(configsAll.status === 200, "configs/all 可访问");

    const missing = await requestJson({
      port: PORT,
      method: "GET",
      path: "/api/does-not-exist",
    });
    assert(missing.status === 404, "未知路由返回 404");

    console.log("[db-api] 全部通过");
  } catch (err) {
    console.error("[db-api] FAIL:", err.message);
    if (stderr) console.error(stderr);
    process.exitCode = 1;
  } finally {
    await killProc(child.pid);
    try {
      fs.rmSync(workspace, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

main();
