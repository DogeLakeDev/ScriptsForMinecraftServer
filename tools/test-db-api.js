#!/usr/bin/env node
/**
 * test-db-api.js — 轻量平台 API 烟测(v2)
 *
 * 旧版测的 lands/economy/redpacket/players HTTP 路由已随 clean-break 删除;
 * 业务写入改走 /api/sfmc/db/* + /api/sfmc/services/*。本脚本只覆盖仍保留的
 * 平台面:health / modules / configs。
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const PORT = 3191;
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-db-api-"));
const dbPath = path.join(workspace, "sfmc_data.db");

function copy(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function request(method, pathname, payload) {
  return new Promise((resolve, reject) => {
    const data = payload === undefined ? null : JSON.stringify(payload);
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: PORT,
        path: pathname,
        method,
        headers: data
          ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) }
          : {},
      },
      (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          text += chunk;
        });
        res.on("end", () => {
          let body = {};
          try {
            body = JSON.parse(text);
          } catch {
            /* ignore */
          }
          resolve({ status: res.statusCode, body });
        });
      }
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function waitForServer() {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    try {
      const result = await request("GET", "/api/health");
      if (result.status === 200) return;
    } catch {
      /* retry */
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("db-server 启动超时");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`[db-api] PASS: ${message}`);
}

async function main() {
  copy(path.join(ROOT, "modules", "catalog.json"), path.join(workspace, "modules", "catalog.json"));
  copy(path.join(ROOT, "modules", "module-lock.json"), path.join(workspace, "modules", "module-lock.json"));
  // 复制已迁 v2 的模块 manifest,供 loadManifestV2 使用
  const packagesSrc = path.join(ROOT, "modules", "packages");
  const packagesDst = path.join(workspace, "modules", "packages");
  fs.cpSync(packagesSrc, packagesDst, { recursive: true });
  fs.mkdirSync(path.join(workspace, "data"), { recursive: true });
  fs.mkdirSync(path.join(workspace, "configs"), { recursive: true });
  fs.writeFileSync(
    path.join(workspace, "configs", "db_config.json"),
    JSON.stringify({ db_port: PORT, dbDir: "./data/sfmc_data.db", modulesDir: "modules" }) + "\n"
  );
  for (const name of ["qq_config.json", "settings.json"]) {
    const src = path.join(ROOT, "configs", name);
    if (fs.existsSync(src)) copy(src, path.join(workspace, "configs", name));
    else if (fs.existsSync(path.join(ROOT, "configs-default", name))) {
      copy(path.join(ROOT, "configs-default", name), path.join(workspace, "configs", name));
    }
  }

  const child = spawn(process.execPath, [path.join(ROOT, "db-server", "dist", "index.js")], {
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
    await waitForServer();
    const health = await request("GET", "/api/health");
    assert(health.body.status === "ok", "health 路由返回 ok");

    const catalog = await request("GET", "/api/sfmc/modules/catalog");
    assert(catalog.status === 200 && Array.isArray(catalog.body.modules), "modules/catalog 返回数组");
    assert(catalog.body.modules.length >= 1, "catalog 至少有一个模块");

    const modules = await request("GET", "/api/sfmc/modules");
    assert(
      modules.status === 200 && modules.body.modules.length === catalog.body.modules.length,
      "模块列表与 catalog 数量一致"
    );

    const configsAll = await request("GET", "/api/sfmc/configs/all");
    assert(configsAll.status === 200, "configs/all 可访问");

    const missing = await request("GET", "/api/does-not-exist");
    assert(missing.status === 404 && missing.body.error === "not_found", "未知路由返回 404");

    console.log("[db-api] 全部通过");
  } catch (err) {
    console.error("[db-api] FAIL:", err.message);
    if (stderr) console.error(stderr);
    process.exitCode = 1;
  } finally {
    child.kill("SIGTERM");
    try {
      fs.rmSync(workspace, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

main();
