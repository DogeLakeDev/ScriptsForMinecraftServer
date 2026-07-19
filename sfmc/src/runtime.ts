import { spawn, spawnSync, type SpawnOptions, type SpawnSyncOptions } from "node:child_process";
import { isSea } from "node:sea";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { resolveRuntimeRoot } from "@sfmc/config";

/**
 * 运行模式抽象层 —— 同一份源码在 npm 与 SEA 两种产物下都能跑。
 *
 * - npm 模式: process.execPath = node.exe, 子服务 = spawn(node, ["<script>", ...args])
 * - SEA 模式: process.execPath = sfmc.exe, 子服务 = spawn(self, args, { env: SFMC_SERVICE })
 *   dispatcher 顶部读 SFMC_SERVICE 决定入口, argv 透传给子服务自身的参数解析。
 *
 * 子服务进程通过 SFMC_ROOT env 拿到项目根 (SEA=exe 同目录, npm=源码树根),
 * 各 workspace 入口优先读 SFMC_ROOT 定位 configs/data, 避免 import.meta.url 在 SEA CJS bundle 里失效。
 *
 * node:sea 在 Node 21.7+/22+ 可用;db-server 依赖 node:sqlite 已要求 Node 22.5+,
 * 因此这里可直接顶层 import,无需降级。
 */

export const IS_SEA: boolean = typeof isSea === "function" && isSea();

const defaultRoot: string = IS_SEA
  ? path.dirname(process.execPath)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const ROOT: string = resolveRuntimeRoot(defaultRoot);

export type ServiceId = "db" | "qq" | "update" | "manager";

const SERVICE_SCRIPT: Record<ServiceId, string> = {
  db: "db-server/dist/index.js",
  qq: "qq-bridge/dist/index.js",
  update: "bds-tools/dist/check-update.js",
  manager: "bds-tools/dist/bds-manager.js",
};

/**
 * 启动一个子服务。SEA 模式自重入同一 exe,npm 模式用 node 跑对应 dist 脚本。
 * args 透传给子服务自身的 argv 解析(如 check-update 的 --channel/--force)。
 * SFMC_ROOT env 让子服务定位 configs/data, 不依赖 import.meta.url (SEA CJS bundle 里失效)。
 */
export function spawnService(service: ServiceId, args: string[] = [], opts: SpawnOptions = {}) {
  const env = { ...process.env, ...opts.env, SFMC_SERVICE: service, SFMC_ROOT: ROOT };
  if (IS_SEA) {
    return spawn(process.execPath, args, { ...opts, env });
  }
  return spawn(process.execPath, [path.join(ROOT, SERVICE_SCRIPT[service]), ...args], { ...opts, env });
}

/** spawnService 的同步版本,用于 wizard 等需要等子进程结束的场景。 */
export function spawnServiceSync(service: ServiceId, args: string[] = [], opts: SpawnSyncOptions = {}) {
  const env = { ...process.env, ...opts.env, SFMC_SERVICE: service, SFMC_ROOT: ROOT };
  if (IS_SEA) {
    return spawnSync(process.execPath, args, { ...opts, env });
  }
  return spawnSync(process.execPath, [path.join(ROOT, SERVICE_SCRIPT[service]), ...args], { ...opts, env });
}
