/**
 * is-main.ts — ESM 下判断当前模块是否为进程入口
 *
 * package.json 声明 "type": "module" 后，`require` 不存在，
 * 不能再用 `require.main === module`。
 *
 * 契约（与历史 endsWith 行为对齐，满足 LSP）：
 * 1. process.argv[1] 与本文件 realpath 相同 → true
 * 2. 根目录 shim（如 recovery.js → dist/recovery.js）同 stem → true
 * 3. 被其他入口 import 时（argv stem 不同）→ false
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function normPath(p: string): string {
  return process.platform === "win32" ? p.toLowerCase() : p;
}

/** 去掉 .js/.ts/.mjs/.cjs 等扩展，得到入口 stem */
function entryStem(filePath: string): string {
  return path.basename(filePath).replace(/\.(c|m)?(js|ts)$/i, "");
}

function tryRealpath(filePath: string): string {
  try {
    return fs.realpathSync.native(filePath);
  } catch {
    return filePath;
  }
}

/**
 * 判断 metaUrl 对应模块是否为 node 进程主入口。
 * 替代 CommonJS 的 `require.main === module`。
 */
export function isMainModule(metaUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    const thisFile = tryRealpath(path.resolve(fileURLToPath(metaUrl)));
    const entryFile = tryRealpath(path.resolve(entry));
    if (normPath(thisFile) === normPath(entryFile)) return true;
    // shim 兼容：入口与本模块同 stem（recovery.js 加载 dist/recovery.js）
    return normPath(entryStem(thisFile)) === normPath(entryStem(entryFile));
  } catch {
    return false;
  }
}
