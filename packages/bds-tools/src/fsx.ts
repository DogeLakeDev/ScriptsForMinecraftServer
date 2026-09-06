/**
 * fsx.ts — 异步/流式文件操作 (避免大文件加载进内存)
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";

/**
 * 流式计算文件哈希 (sha1 / sha256)，
 * 用于大文件 (例如 BDS 可执行文件 ~80MB)，不会 OOM。
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

/** 排除无需备份/复制的仓库与系统垃圾元数据 */
export const DEFAULT_COPY_IGNORE = new Set([
  ".git",
  ".svn",
  ".hg",
  "node_modules",
  ".DS_Store",
  "Thumbs.db",
  "desktop.ini",
]);

/**
 * Windows 兼容的安全单文件拷贝。
 * 若目标文件已存在且处于只读状态（例如 git objects 属性为只读），先赋写权限并覆写，
 * 并确保拷贝后的目标文件具有可写权限，避免后续重复备份报错。
 */
export function copyFileSyncSafe(src: string, dest: string): void {
  try {
    fs.copyFileSync(src, dest);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "EPERM" || code === "EACCES") {
      try {
        if (fs.existsSync(dest)) {
          fs.chmodSync(dest, 0o666);
          fs.unlinkSync(dest);
        }
        fs.copyFileSync(src, dest);
      } catch {
        throw err;
      }
    } else {
      throw err;
    }
  }
  try {
    fs.chmodSync(dest, 0o666);
  } catch {
    /* ignore */
  }
}

/** 同步流式拷贝单文件，目标只读时自动解除并覆写 */
export async function copyFileAsync(src: string, dest: string): Promise<void> {
  try {
    await pipeline(fs.createReadStream(src), fs.createWriteStream(dest));
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "EPERM" || code === "EACCES") {
      try {
        if (fs.existsSync(dest)) {
          fs.chmodSync(dest, 0o666);
          fs.unlinkSync(dest);
        }
        await pipeline(fs.createReadStream(src), fs.createWriteStream(dest));
      } catch {
        throw err;
      }
    } else {
      throw err;
    }
  }
  try {
    fs.chmodSync(dest, 0o666);
  } catch {
    /* ignore */
  }
}

/** 同步目录复制 (递归)，默认排除 .git / node_modules 等元数据 */
export function copyDirSync(
  src: string,
  dest: string,
  ignore: Set<string> = DEFAULT_COPY_IGNORE
): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    if (ignore.has(entry)) continue;
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    if (fs.statSync(srcPath).isDirectory()) {
      copyDirSync(srcPath, destPath, ignore);
    } else {
      copyFileSyncSafe(srcPath, destPath);
    }
  }
}

/** 异步目录复制 (基于流)，默认排除 .git / node_modules 等元数据 */
export async function copyDirAsync(
  src: string,
  dest: string,
  ignore: Set<string> = DEFAULT_COPY_IGNORE
): Promise<void> {
  fs.mkdirSync(dest, { recursive: true });
  await Promise.all(
    fs.readdirSync(src).map(async (entry) => {
      if (ignore.has(entry)) return;
      const srcPath = path.join(src, entry);
      const destPath = path.join(dest, entry);
      const stat = fs.statSync(srcPath);
      if (stat.isDirectory()) {
        await copyDirAsync(srcPath, destPath, ignore);
      } else {
        await copyFileAsync(srcPath, destPath);
      }
    })
  );
}

/** 计算目录大小 (字节)，默认排除 .git / node_modules 等元数据 */
export function getDirSize(dir: string, ignore: Set<string> = DEFAULT_COPY_IGNORE): number {
  let total = 0;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ignore.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) total += getDirSize(full, ignore);
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

/**
 * 读 JSON 文件（utf8）。
 * 若文件以 UTF-8 BOM（U+FEFF）开头则剥离后再解析（记事本「UTF-8 with BOM」）。
 */
export function readJsonFile<T = unknown>(filePath: string): T {
  let text = fs.readFileSync(filePath, "utf8");
  if (text.length > 0 && text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }
  return JSON.parse(text) as T;
}
