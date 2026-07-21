import { type SpawnOptions, type SpawnSyncOptions } from "node:child_process";
/**
 * 运行模式抽象层 —— 同一份源码在 npm 与 SEA 两种产物下都能跑。
 *
 * - npm 模式: process.execPath = node.exe, 子服务 = spawn(node, ["<script>", ...args])
 * - SEA 模式: process.execPath = sfmc.exe, 子服务 = spawn(self, args, { env: SFMC_SERVICE })
 *   dispatcher 顶部读 SFMC_SERVICE 决定入口, argv 透传给子服务自身的参数解析。
 *
 * ROOT 解析(两种模式):
 *   - SEA: `<exe-dir>` —— modules 与 exe 平级,用户下载 exe 后就在那里建模块目录
 *   - npm: `process.cwd()` —— 用户从项目根 `node sfmc/dist/main.js`,modules 跟随当前项目
 *     (原来用 import.meta.url 上溯两级仅对 monorepo 源码位置有效,用户从任意目录跑产物会指错)
 *
 * 子服务进程通过 SFMC_ROOT + SFMC_PACKAGES_DIR env 拿到项目根 + 模块目录,
 * db-server 据此定位 modules/packages/, 不依赖自身 __dirname(SEA-launched 时不可靠)。
 *
 * node:sea 在 Node 21.7+/22+ 可用;db-server 依赖 node:sqlite 已要求 Node 22.5+,
 * 因此这里可直接顶层 import,无需降级。
 */
export declare const IS_SEA: boolean;
export declare const ROOT: string;
export declare const PACKAGES_DIR: string;
export type ServiceId = "db" | "qq" | "update" | "manager";
/**
 * 启动一个子服务。SEA 模式自重入同一 exe,npm 模式用 node 跑对应 dist 脚本。
 * args 透传给子服务自身的 argv 解析(如 check-update 的 --channel/--force)。
 *
 * 透传给子进程的 env:
 *   - SFMC_SERVICE:  服务标识(db|qq|update|manager),SEA dispatcher 据此路由
 *   - SFMC_ROOT:     项目根,SEA=exe 同目录,npm=process.cwd()
 *   - SFMC_PACKAGES_DIR: modules/packages/ 绝对路径,db-server 据此扫模块清单
 */
export declare function spawnService(service: ServiceId, args?: string[], opts?: SpawnOptions): import("node:child_process").ChildProcess;
/** spawnService 的同步版本,用于 wizard 等需要等子进程结束的场景。 */
export declare function spawnServiceSync(service: ServiceId, args?: string[], opts?: SpawnSyncOptions): import("node:child_process").SpawnSyncReturns<string | NonSharedBuffer>;
//# sourceMappingURL=runtime.d.ts.map