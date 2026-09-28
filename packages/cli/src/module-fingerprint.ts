/**
 * module-fingerprint.ts — 模块目录 canonical SHA-256
 * (与原先 module-commands 内 dirFingerprint 算法一致,供 catalog / verify 共用)。
 */

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * 模块目录扫描时要跳过的名字。
 * 使用场景：指纹和体积统计共用。map-server/data 是地图快照，扫进去会让 CLI 启动卡死。
 */
export function shouldSkipModuleEntry(parentDirName: string, name: string): boolean {
  if (name.startsWith(".") || name === "node_modules" || name === "dist") return true;
  return name === "data" && parentDirName === "map-server";
}

/** Compute the canonical SHA-256 of a module directory (POSIX `find ... | sha256sum` compatible). */
export async function dirFingerprint(rootDir: string): Promise<string> {
  const hash = createHash("sha256");
  const entries: string[] = [];
  async function walk(rel: string): Promise<void> {
    const full = path.join(rootDir, rel);
    const items = await fs.readdir(full, { withFileTypes: true });
    const sorted = items.sort((a, b) => a.name.localeCompare(b.name));
    for (const it of sorted) {
      if (shouldSkipModuleEntry(path.posix.basename(rel), it.name)) continue;
      const child = rel ? `${rel}/${it.name}` : it.name;
      if (it.isDirectory()) await walk(child);
      else if (it.isFile()) entries.push(child);
    }
  }
  await walk("");
  entries.sort();
  for (const rel of entries) {
    let data: Buffer;
    try {
      data = await fs.readFile(path.join(rootDir, rel));
    } catch {
      // 单个文件打不开时跳过，避免整次启动失败
      continue;
    }
    hash.update(rel.replaceAll("\\", "/"));
    hash.update("\n");
    hash.update(data);
    hash.update("\n");
  }
  return hash.digest("hex");
}
