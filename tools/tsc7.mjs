#!/usr/bin/env node
/**
 * 调用 TypeScript 7 原生 tsc（权威入口）。
 *
 * 双轨安装：
 * - `typescript` → `@typescript/typescript6`（供 ESLint / typescript-eslint API，bin 为 tsc6）
 * - `@typescript/native` → `typescript@7`（类型检查 / emit）
 *
 * 各包 typecheck、.d.ts emit 应走本入口（或 bin `tsc7`），不要依赖 `.bin/tsc` 的链接胜出方。
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

function tryRealpath(filePath) {
  try {
    return fs.realpathSync.native(filePath);
  } catch {
    return filePath;
  }
}

/** 解析 @typescript/native 包内 tsc 脚本路径 */
export function resolveNativeTsc() {
  let pkgJson;
  try {
    pkgJson = require.resolve("@typescript/native/package.json");
  } catch {
    throw new Error("未找到 @typescript/native（TypeScript 7）。请在仓库根目录执行 npm install。");
  }
  return path.join(path.dirname(pkgJson), "bin", "tsc");
}

/**
 * 以当前 Node 进程调用 TS7 tsc。
 * @param {string[]} args tsc CLI 参数
 * @param {{ stdio?: import("node:child_process").StdioOptions }} [opts]
 * @returns {number} 进程退出码
 */
export function runTsc7(args, opts = {}) {
  const tscPath = resolveNativeTsc();
  const result = spawnSync(process.execPath, [tscPath, ...args], {
    stdio: opts.stdio ?? "inherit",
  });
  if (result.error) throw result.error;
  return result.status === null ? 1 : result.status;
}

/** 经 node_modules/.bin/tsc7 符号链接调用时也须识别为主入口 */
function isMainModule() {
  const entry = process.argv[1];
  if (!entry) return false;
  const entryReal = tryRealpath(path.resolve(entry));
  const selfReal = tryRealpath(fileURLToPath(import.meta.url));
  return entryReal === selfReal;
}

if (isMainModule()) {
  process.exit(runTsc7(process.argv.slice(2)));
}
