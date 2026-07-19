/**
 * SEA dispatcher —— 单 exe 多路分发入口。
 *
 * 同一个 sfmc.exe 在不同进程里通过 SFMC_SERVICE 环境变量决定跑哪个服务。
 * supervisor (默认) 由用户直接运行; db/qq/update/manager 由 spawnService 自重入触发。
 *
 * 实现要点:
 * - 5 个 import() 都是静态字符串字面量, esbuild 单 outfile (splitting=false) 会把
 *   5 个入口全部 inline 进同一 bundle; 运行时按 env 只触发对应入口的 side-effect。
 * - 各 workspace 入口无需重构 main() —— 它们的顶层 side-effect 即启动逻辑。
 * - argv 透传: 子进程 process.argv.slice(2) 由各入口自行解析 (如 check-update 的 --channel)。
 *
 */
import process from "node:process";
import { ensureSeaTerminalProfile } from "./terminal.js";
ensureSeaTerminalProfile();
const mode = process.env.SFMC_SERVICE;
const p = mode === "db"
    ? import("../../db-server/dist/index.js")
    : mode === "qq"
        ? import("../../qq-bridge/dist/index.js")
        : mode === "update"
            ? import("../../bds-tools/dist/check-update.js")
            : mode === "manager"
                ? import("../../bds-tools/dist/bds-manager.js")
                : import("./main.js");
p.catch((e) => {
    console.error(`[dispatcher] failed to launch ${mode ?? "supervisor"}:`, e);
    process.exit(1);
});
//# sourceMappingURL=dispatcher.js.map