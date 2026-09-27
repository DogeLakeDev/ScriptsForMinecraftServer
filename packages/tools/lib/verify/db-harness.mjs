// @ts-check
/**
 * 拉起 db-server，等 /api/health，执行回调后清理
 */
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import fs from "node:fs";
import process from "node:process";
import path from "node:path";
import { waitHealth } from "../http.mjs";
import { killProc } from "../proc.mjs";
import { DB_SERVER_DIST, ROOT } from "../paths.mjs";
import { exists } from "../io.mjs";

/**
 * @typedef {object} WithDbOpts
 * @property {string} [dataRoot]
 * @property {number} [port]
 * @property {string} [dbDist]
 * @property {string} [cwd]
 * @property {number} [healthTimeoutMs]
 */

/**
 * @param {WithDbOpts} opts
 * @param {(port: number) => Promise<void>} fn
 */
export async function withDbServer(opts, fn) {
  const tempRoot = path.join(ROOT, "tmp");
  fs.mkdirSync(tempRoot, { recursive: true });
  const dataRoot = fs.mkdtempSync(path.join(tempRoot, "sfmc-db-verify-"));
  const port = opts.port ?? (await findFreePort());
  const dbDist = opts.dbDist ?? DB_SERVER_DIST;
  const cwd = opts.cwd ?? ROOT;
  const healthTimeoutMs = opts.healthTimeoutMs ?? 20_000;

  if (!exists(dbDist)) {
    fs.rmSync(dataRoot, { recursive: true, force: true });
    throw new Error(`缺少 ${dbDist} — 先 pnpm run build`);
  }

  writeVerifyRoot(dataRoot, port);
  /** @type {import("node:child_process").ChildProcess | null} */
  let dbProc = null;
  try {
    dbProc = spawn(process.execPath, [dbDist], {
      cwd,
      env: { ...process.env, SFMC_ROOT: dataRoot, DB_PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const ready = await waitHealth(port, healthTimeoutMs);
    if (!ready || dbProc.exitCode !== null) throw new Error(`db-server 未就绪 (port=${port})`);
    await fn(port);
  } finally {
    if (dbProc) await killProc(dbProc.pid);
    await new Promise((r) => setTimeout(r, 600));
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("无法分配 db-server 自检端口")));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

function writeVerifyRoot(root, port) {
  fs.mkdirSync(path.join(root, "configs"), { recursive: true });
  fs.mkdirSync(path.join(root, "data"), { recursive: true });
  fs.mkdirSync(path.join(root, "modules", "packages"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "configs", "db_config.json"),
    `${JSON.stringify({ db_port: port, dbDir: "data/sfmc_data.db", modulesDir: "modules" }, null, 2)}\n`
  );
  fs.writeFileSync(path.join(root, "configs", "qq_config.json"), "{}\n");
  fs.writeFileSync(path.join(root, "configs", "permissions.json"), "[]\n");
  fs.writeFileSync(
    path.join(root, "modules", "catalog.json"),
    `${JSON.stringify(
      {
        version: 1,
        modules: [
          {
            id: "verify-fixture",
            configKey: "verify_fixture",
            name: "Verify fixture",
            description: "Temporary read-only API contract fixture",
            enabledByDefault: true,
            canDisable: false,
            requires: [],
            entry: { kind: "sapi", path: "modules/packages/verify-fixture/sapi/src/index.ts" },
          },
        ],
      },
      null,
      2
    )}\n`
  );
  fs.writeFileSync(path.join(root, "modules", "module-lock.json"), '{"version":1,"modules":{}}\n');
}
