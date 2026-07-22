/**
 * SEA dispatcher —— 单 exe 多路分发入口。
 *
 * 子服务(db/qq/update/manager/pack-manager)**不打包进 SEA**:
 * SEA exe 只能跑 ESM bundle 内的代码,不能直接 require 外部 .js 文件。
 * 所以 SEA supervisor 通过 `runtime.ts#spawnService` 用**系统 node**
 * spawn 根目录下的子服务入口脚本,SEA bundle 只包含 supervisor 自己。
 *
 * 同一个 sfmc.exe 默认跑 supervisor (main.ts);子服务走外部 node 进程
 * —— SEA exe 在这里不重入,避免 SEA 重复 inline 子服务代码。
 */

import { ensureSeaTerminalProfile } from "./terminal.js";

ensureSeaTerminalProfile();

if (process.env.SFMC_SERVICE) {
  /* 子服务不在 SEA 内运行;supervisor 用系统 node spawn 它们。
   * 这里只是兜底:如果有人误把 SFMC_SERVICE 设上后直接跑 sfmc.exe,
   * 提示并退出,而不是错误地执行 main。 */
  console.error(`[sfmc] service "${process.env.SFMC_SERVICE}" must be launched by the supervisor, not directly.`);
  process.exit(1);
}

/* 未设 SFMC_SERVICE 时,落到 ./main.js 末尾的 main() 自执行。 */
await import("./main.js");