// @ts-check
/**
 * 拉起 db-server，等 /api/health，执行回调后清理
 */
import { spawn } from "node:child_process";
import process from "node:process";
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
  const dataRoot = opts.dataRoot ?? ROOT;
  const port = opts.port ?? parseInt(process.env.DB_PORT || "3001", 10);
  const dbDist = opts.dbDist ?? DB_SERVER_DIST;
  const cwd = opts.cwd ?? ROOT;
  const healthTimeoutMs = opts.healthTimeoutMs ?? 20_000;

  if (!exists(dbDist)) {
    throw new Error(`缺少 ${dbDist} — 先 npm run build`);
  }

  /** @type {import("node:child_process").ChildProcess | null} */
  let dbProc = null;
  try {
    dbProc = spawn(process.execPath, [dbDist], {
      cwd,
      env: { ...process.env, SFMC_ROOT: dataRoot, DB_PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const ready = await waitHealth(port, healthTimeoutMs);
    if (!ready) throw new Error(`db-server 未就绪 (port=${port})`);
    await fn(port);
  } finally {
    if (dbProc) await killProc(dbProc.pid);
    await new Promise((r) => setTimeout(r, 600));
  }
}
