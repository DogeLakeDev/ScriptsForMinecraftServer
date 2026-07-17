import { mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname } from "path";

/**
 *
 *
 * @export
 * @template T
 * @param {string} filePath
 * @param {T} fallback
 * @return {*}  {T}
 */
export function readJsonFile<T>(filePath: string, fallback: T): T;
export function readJsonFile<T>(filePath: string): T | undefined;
export function readJsonFile<T>(filePath: string, fallback?: T): T | undefined {
  try {
    const content = readFileSync(filePath, "utf8");
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

/**
 * 原子性地将 JSON 数据写入文件（先写临时文件，再重命名）
 * @param filePath 目标文件路径
 * @param value 要序列化的数据（任意 JSON 可序列化类型）
 */
export function writeJsonFile<T>(filePath: string, value: T): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.tmp`;
  writeFileSync(tempPath, JSON.stringify(value, null, 2) + "\n");
  renameSync(tempPath, filePath);
}
