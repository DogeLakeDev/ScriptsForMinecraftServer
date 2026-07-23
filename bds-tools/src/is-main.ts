/**
 * is-main.ts — ESM 下判断当前模块是否为进程入口
 *
 * package.json 声明 "type": "module" 后，`require` 不存在，
 * 不能再用 `require.main === module`。
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 判断 metaUrl 对应模块是否为 node 进程主入口。
 * 替代 CommonJS 的 `require.main === module`。
 */
export function isMainModule(metaUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    const thisFile = path.resolve(fileURLToPath(metaUrl));
    const entryFile = path.resolve(entry);
    return process.platform === "win32"
      ? thisFile.toLowerCase() === entryFile.toLowerCase()
      : thisFile === entryFile;
  } catch {
    return false;
  }
}
