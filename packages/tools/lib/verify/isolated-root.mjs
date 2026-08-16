// @ts-check
/**
 * 隔离 SFMC_ROOT：验证路径解析不依赖 monorepo 仓根
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { bdsExeName } from "@sfmc-bds/bds-tools/host-platform";
import { requestJson, waitHealth } from "../http.mjs";
import { exists } from "../io.mjs";
import { killProc } from "../proc.mjs";
import { DB_SERVER_DIST, ROOT } from "../paths.mjs";

const DEFAULT_SIM_PORT = 3091;

/**
 * @param {object} [opts]
 * @param {boolean} [opts.keep]
 * @param {boolean} [opts.noRestore]
 * @param {number} [opts.port]
 */
export async function runIsolatedRootSimulation(opts = {}) {
  const keep = opts.keep ?? false;
  const noRestore = opts.noRestore ?? false;
  const port = opts.port ?? DEFAULT_SIM_PORT;

  if (!exists(DB_SERVER_DIST)) {
    throw new Error(`缺少 ${DB_SERVER_DIST}`);
  }

  const simDir = path.join(ROOT, "tmp", `sim-${Date.now()}`);
  fs.mkdirSync(path.join(simDir, "BDS"), { recursive: true });
  fs.writeFileSync(path.join(simDir, "BDS", bdsExeName()), "");
  fs.mkdirSync(path.join(simDir, "LLBot"), { recursive: true });
  const llbotBin = process.platform === "win32" ? "llbot.exe" : "llbot";
  fs.writeFileSync(path.join(simDir, "LLBot", llbotBin), "");

  fs.mkdirSync(path.join(simDir, "modules", "packages"), { recursive: true });
  fs.copyFileSync(path.join(ROOT, "modules", "catalog.json"), path.join(simDir, "modules", "catalog.json"));
  fs.writeFileSync(
    path.join(simDir, "modules", "module-lock.json"),
    `${JSON.stringify({ version: 1, modules: {} }, null, 2)}\n`
  );

  fs.mkdirSync(path.join(simDir, "configs"), { recursive: true });
  fs.writeFileSync(
    path.join(simDir, "configs", "db_config.json"),
    `${JSON.stringify({ db_port: port, modulesDir: "modules" })}\n`
  );
  fs.writeFileSync(
    path.join(simDir, "configs", "bds_updater.json"),
    `${JSON.stringify({ bds_path: path.join(simDir, "BDS") })}\n`
  );
  fs.writeFileSync(path.join(simDir, "configs", "qq_config.json"), "{}\n");
  fs.writeFileSync(path.join(simDir, "configs", "permissions.json"), "[]\n");
  fs.mkdirSync(path.join(simDir, "data"), { recursive: true });

  const dbProc = spawn(process.execPath, [DB_SERVER_DIST], {
    cwd: ROOT,
    env: { ...process.env, SFMC_ROOT: simDir, DB_PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    const ok = await waitHealth(port, 15_000);
    if (!ok) throw new Error(`db-server 未就绪 (port ${port})`);

    const mods = await requestJson({ port, method: "GET", path: "/api/sfmc/modules" });
    if (mods.status !== 200 || !Array.isArray(mods.body.modules)) {
      throw new Error("GET /api/sfmc/modules 异常");
    }

    const catalog = await requestJson({ port, method: "GET", path: "/api/sfmc/modules/catalog" });
    if (catalog.status !== 200 || !Array.isArray(catalog.body.modules)) {
      throw new Error("GET /api/sfmc/modules/catalog 异常");
    }
    if (mods.body.modules.length !== catalog.body.modules.length) {
      throw new Error("隔离环境模块列表与 catalog 数量不一致");
    }

    const health = await requestJson({ port, method: "GET", path: "/api/health" });
    if (health.status !== 200) throw new Error("GET /api/health 非 200");
  } finally {
    await killProc(dbProc.pid);
  }

  if (!noRestore && !keep) {
    fs.rmSync(simDir, { recursive: true, force: true });
  }

  return { simDir: noRestore || keep ? simDir : null };
}
