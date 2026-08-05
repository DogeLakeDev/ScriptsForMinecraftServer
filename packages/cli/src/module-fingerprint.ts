/**
 * module-fingerprint.ts — 模块目录 canonical SHA-256
 * (与原先 module-commands 内 dirFingerprint 算法一致,供 catalog / verify 共用)。
 */

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

/** Compute the canonical SHA-256 of a module directory (POSIX `find ... | sha256sum` compatible). */
export async function dirFingerprint(rootDir: string): Promise<string> {
  const hash = createHash("sha256");
  const entries: string[] = [];
  async function walk(rel: string): Promise<void> {
    const full = path.join(rootDir, rel);
    const items = await fs.readdir(full, { withFileTypes: true });
    const sorted = items.sort((a, b) => a.name.localeCompare(b.name));
    for (const it of sorted) {
      const child = rel ? `${rel}/${it.name}` : it.name;
      if (it.isDirectory()) await walk(child);
      else if (it.isFile()) entries.push(child);
    }
  }
  await walk("");
  entries.sort();
  for (const rel of entries) {
    const data = await fs.readFile(path.join(rootDir, rel));
    hash.update(rel.replaceAll("\\", "/"));
    hash.update("\n");
    hash.update(data);
    hash.update("\n");
  }
  return hash.digest("hex");
}
