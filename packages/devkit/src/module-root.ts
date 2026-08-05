/**
 * 有效模块根判定（扩展与 CLI 共用权威）
 */

import fs from "node:fs";
import path from "node:path";

export type ModuleRootInfo = {
  root: string;
  id: string;
  name?: string;
  schemaVersion: number;
};

/** 目录是否为有效 SFMC 模块根：package.json + sapi/manifest.json schemaVersion===2 + 非空 id */
export function isValidModuleRoot(dir: string): boolean {
  return readModuleRootInfo(dir) !== null;
}

export function readModuleRootInfo(dir: string): ModuleRootInfo | null {
  const pkg = path.join(dir, "package.json");
  const manifestPath = path.join(dir, "sapi", "manifest.json");
  if (!fs.existsSync(pkg) || !fs.existsSync(manifestPath)) return null;
  try {
    const m = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
      schemaVersion?: number;
      id?: string;
      name?: string;
    };
    if (m.schemaVersion !== 2) return null;
    if (typeof m.id !== "string" || !m.id.trim()) return null;
    return {
      root: path.resolve(dir),
      id: m.id.trim(),
      name: typeof m.name === "string" ? m.name : undefined,
      schemaVersion: 2,
    };
  } catch {
    return null;
  }
}

/** 自 filePath 向上找最近有效模块根；找不到返回 null */
export function findModuleRootFromFile(filePath: string): string | null {
  let cur = path.dirname(path.resolve(filePath));
  const root = path.parse(cur).root;
  while (true) {
    if (isValidModuleRoot(cur)) return cur;
    if (cur === root) return null;
    const parent = path.dirname(cur);
    if (parent === cur) return null;
    cur = parent;
  }
}
