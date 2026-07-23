/**
 * zipx.ts — JSZip 安全解压（防 zip-slip / 绝对路径 / Windows `\`）
 * 单一权威，供 world-packs / check-update 复用（DRY）。
 */
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";

/**
 * 将 zip 条目名解析为 destRoot 下的绝对路径。
 * 拒绝 `..`、绝对路径（含前导 `/`、盘符）、以及 resolve 后逃逸 destRoot 的条目。
 */
export function resolveSafeZipEntryPath(destRoot: string, entryName: string): string {
  const raw = String(entryName ?? "").replace(/\\/g, "/");
  // 先于去前导斜杠检查：避免 `/etc/passwd` 被剥成相对路径静默写入 dest
  if (!raw || raw.includes("..") || raw.startsWith("/") || /^[a-zA-Z]:/.test(raw)) {
    throw new Error(`unsafe zip entry path: ${entryName}`);
  }
  const parts = raw.replace(/\/$/, "").split("/").filter(Boolean);
  if (parts.length === 0) {
    throw new Error(`unsafe zip entry path: ${entryName}`);
  }
  const rootResolved = path.resolve(destRoot);
  const out = path.resolve(rootResolved, ...parts);
  const rootPrefix = rootResolved.endsWith(path.sep) ? rootResolved : rootResolved + path.sep;
  if (out !== rootResolved && !out.startsWith(rootPrefix)) {
    throw new Error(`zip entry escapes dest: ${entryName}`);
  }
  return out;
}

/** 将 zip Buffer 解压到 destDir（已存在则写入其下）。 */
export async function extractZipBufferToDir(data: Buffer, destDir: string): Promise<void> {
  const zip = await JSZip.loadAsync(data);
  await fs.promises.mkdir(destDir, { recursive: true });
  for (const name of Object.keys(zip.files)) {
    const entry = zip.files[name];
    if (!entry) continue;
    const out = resolveSafeZipEntryPath(destDir, name);
    if (entry.dir || name.endsWith("/") || name.endsWith("\\")) {
      await fs.promises.mkdir(out, { recursive: true });
      continue;
    }
    await fs.promises.mkdir(path.dirname(out), { recursive: true });
    const buf = await entry.async("nodebuffer");
    await fs.promises.writeFile(out, buf);
  }
}

/** 从磁盘 zip 文件解压到 destDir。 */
export async function extractZipFileToDir(zipPath: string, destDir: string): Promise<void> {
  const abs = path.resolve(zipPath);
  if (!fs.existsSync(abs)) throw new Error(`archive not found: ${abs}`);
  const data = await fs.promises.readFile(abs);
  await extractZipBufferToDir(data, destDir);
}
