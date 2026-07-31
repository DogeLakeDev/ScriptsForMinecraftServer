/**
 * SFMC 工作目录判定（运行时根：configs/、modules/；不是源码仓库根）
 */

import fs from "node:fs";
import path from "node:path";

/** 目录是否为有效 SFMC 工作目录（含 configs/ 与 modules/）。 */
export function isValidSfmcRoot(dir: string): boolean {
  if (!dir || !dir.trim()) return false;
  const root = path.resolve(dir);
  try {
    return (
      fs.statSync(path.join(root, "configs")).isDirectory() &&
      fs.statSync(path.join(root, "modules")).isDirectory()
    );
  } catch {
    return false;
  }
}
