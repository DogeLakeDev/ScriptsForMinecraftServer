import { resolveRuntimeRoot } from "@sfmc/sdk/node/config";
import { spawn, spawnSync, type SpawnOptions, type SpawnSyncOptions } from "node:child_process";
import path, { dirname } from "node:path";
import process from "node:process";
import { isSea } from "node:sea";
import { fileURLToPath } from "node:url";

export const IS_SEA: boolean = typeof isSea === "function" && isSea();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fallbackRoot: string = path.resolve(__dirname, "..", "..");

/**
 * 项目根目录。优先级:`process.env.SFMC_ROOT`(由 spawnService 注入) > fallback。
 * - SEA 模式:fallback 是 `<exe-dir>/..`(`dist/sea/sfmc.exe` 上一级 = 项目根)
 * - npm 模式:fallback 是 `sfmc/` 上一级 = 项目根
 */
export const ROOT: string = resolveRuntimeRoot(fallbackRoot);

export const PACKAGES_DIR: string = path.join(ROOT, "modules", "packages");

export type ServiceId = "db" | "qq" | "update" | "manager" | "pack-manager";

/**
 * 各服务入口脚本相对项目根的路径。
 * SEA 模式下不需要(走系统 node 直接调脚本);npm 模式下 spawn `node <root>/<script>`。
 */
const SERVICE_SCRIPT: Record<ServiceId, string> = {
  db: "db-server/dist/index.js",
  qq: "qq-bridge/dist/index.js",
  update: "bds-tools/dist/check-update.js",
  manager: "bds-tools/dist/bds-manager.js",
  "pack-manager": "bds-tools/dist/cli-pack-manager.js",
};

/**
 * SEA 模式下 process.execPath === sfmc.exe —— SEA 不能执行外部 .js 文件,
 * 所以走 system `node` 二进制跑子服务脚本。
 * npm 模式下 process.execPath 本来就是 node,走自身即可。
 */
function nodeBinary(): string {
  return IS_SEA ? "node" : process.execPath;
}

/**
 * 启动一个子服务。
 *
 * SEA 模式下 spawn system node(SEA exe 不能执行外部 CJS/ESM 脚本,
 * 子服务代码必须留在根目录源码层)。SEA bundle 因此只包含 supervisor 自己
 * —— db-server / qq-bridge / bds-tools 不再被 esbuild 静态 inline。
 *
 * npm 模式:`process.execPath` 本来就是 node,效果与 SEA 模式相同。
 *
 * 透传给子进程的 env:
 *   - SFMC_SERVICE:  服务标识(db|qq|update|manager),子服务据此路由
 *   - SFMC_ROOT:     项目根,SEA=exe 上一级,npm=process.cwd()
 *   - SFMC_PACKAGES_DIR: modules/packages/ 绝对路径,db-server 据此扫模块清单
 */
export function spawnService(service: ServiceId, args: string[] = [], opts: SpawnOptions = {}) {
  const env = {
    ...process.env,
    ...opts.env,
    SFMC_SERVICE: service,
    SFMC_ROOT: ROOT,
    SFMC_PACKAGES_DIR: PACKAGES_DIR,
  };
  const script = path.join(ROOT, SERVICE_SCRIPT[service]);
  return spawn(nodeBinary(), [script, ...args], { ...opts, env });
}

/** spawnService 的同步版本,用于 wizard 等需要等子进程结束的场景。 */
export function spawnServiceSync(service: ServiceId, args: string[] = [], opts: SpawnSyncOptions = {}) {
  const env = {
    ...process.env,
    ...opts.env,
    SFMC_SERVICE: service,
    SFMC_ROOT: ROOT,
    SFMC_PACKAGES_DIR: PACKAGES_DIR,
  };
  const script = path.join(ROOT, SERVICE_SCRIPT[service]);
  return spawnSync(nodeBinary(), [script, ...args], { ...opts, env });
}