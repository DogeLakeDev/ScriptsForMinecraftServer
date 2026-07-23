#!/usr/bin/env node
/**
 * 调用 TypeScript 7 原生 tsc。
 * 双轨安装下 `typescript` 解析为 @typescript/typescript6（ESLint API），
 * 其依赖 @typescript/old 会占用 node_modules/.bin/tsc，故 typecheck/emit 需显式走本入口。
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const pkgDir = path.dirname(require.resolve("@typescript/native/package.json"));
const tscPath = path.join(pkgDir, "bin", "tsc");
const result = spawnSync(process.execPath, [tscPath, ...process.argv.slice(2)], {
  stdio: "inherit",
});
process.exit(result.status === null ? 1 : result.status);
