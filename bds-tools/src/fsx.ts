/**
 * fsx.ts — 异步/流式文件操作 (避免大文件加载进内存)
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pipeline } from "node:stream/promises";

/**
 * 流式计算文件哈希 (sha1 / sha256)，
 * 用于大文件 (例如 bedrock_server.exe ~80MB)，不会 OOM。
 */
export async function hashFileAsync(filePath: string, algo: "sha1" | "sha256" = "sha256"): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash(algo);
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk: Buffer | string) => {
      h.update(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    });
    stream.on("end", () => resolve(h.digest("hex").toLowerCase()));
    stream.on("error", reject);
  });
}

/** 同步版本（用于小文件） */
export function hashFileSync(filePath: string, algo: "sha1" | "sha256" = "sha256"): string {
  try {
    const h = crypto.createHash(algo);
    h.update(fs.readFileSync(filePath));
    return h.digest("hex").toLowerCase();
  } catch {
    return "";
  }
}

/** 同步流式拷贝单文件 (复制中) */
export async function copyFileAsync(src: string, dest: string): Promise<void> {
  await pipeline(fs.createReadStream(src), fs.createWriteStream(dest));
}

/** 同步目录复制 (递归) */
export function copyDirSync(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    if (fs.statSync(srcPath).isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/** 异步目录复制 (基于流) */
export async function copyDirAsync(src: string, dest: string): Promise<void> {
  fs.mkdirSync(dest, { recursive: true });
  await Promise.all(
    fs.readdirSync(src).map(async (entry) => {
      const srcPath = path.join(src, entry);
      const destPath = path.join(dest, entry);
      const stat = fs.statSync(srcPath);
      if (stat.isDirectory()) {
        await copyDirAsync(srcPath, destPath);
      } else {
        await copyFileAsync(srcPath, destPath);
      }
    })
  );
}

/** 计算目录大小 (字节) */
export function getDirSize(dir: string): number {
  let total = 0;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) total += getDirSize(full);
      else if (entry.isFile()) total += fs.statSync(full).size;
    }
  } catch {}
  return total;
}

/** 强制清空目录内容 (但保留目录本身) */
export function emptyDirSync(dir: string): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    try {
      const stat = fs.statSync(full);
      if (stat.isDirectory()) fs.rmSync(full, { recursive: true, force: true });
      else fs.unlinkSync(full);
    } catch (e) {
      // 忽略: 顶层仍保留目录，即使部分子项无法删除
    }
  }
}

/** 安全删除整个目录 */
export function rmSafe(path: string): void {
  try {
    fs.rmSync(path, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

/** 安全写文件 (原子: 写临时文件 → rename) */
export function writeFileSafe(filePath: string, data: string | Buffer): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, filePath);
}
