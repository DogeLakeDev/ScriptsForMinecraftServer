/**
 * 解析 Node.js 版本字符串，提取主版本号、次版本号和补丁号。
 * @param version - 版本字符串（可选），例如 "v14.17.0" 或 "14.17.0"。默认为 process.versions.node。
 * @returns 包含 major, minor, patch 的对象，若格式无效则返回 null。
 */
import { log } from "./log.js";

export function parseNodeVersion(version: string = process.versions.node): {
  major: number;
  minor: number;
  patch: number;
} | null {
  const match = String(version).match(/^v?(\d+)\.(\d+)\.(\d+)/);
  return match ? { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) } : null;
}

/**
 * 校验当前 Node.js 版本是否满足最低要求。
 *
 * 默认下限 22.13 —— `node:sqlite`（db-server 的核心依赖）在 22.5.0–22.12.x
 * 仍需 `--experimental-sqlite` CLI 参数才能加载，未带参数时会在 import 阶段
 * 直接抛出 `ERR_UNKNOWN_BUILTIN_MODULE`；该模块从 22.13.0 起默认可用（仍标记为
 * experimental）。注意：由于 ESM 静态 import 会在本文件被调用之前完成解析，
 * 这里的检查无法拦截 `./lib/sqlite.ts` 自身的 import 崩溃，只能作为其余场景
 * 的兜底防线与版本要求的单一事实来源。
 *
 * @param {number} [minMajor=22]
 * @param {number} [minMinor=13]
 * @return {*}  {boolean}
 */
export function assertNodeVersion(minMajor: number = 22, minMinor: number = 13): boolean {
  const actual = parseNodeVersion();
  if (!actual || actual.major < minMajor || (actual.major === minMajor && actual.minor < minMinor)) {
    log.error(`[Runtime] Node.js ${minMajor}.${minMinor}+ is required; found ${process.versions.node}`);
    process.exitCode = 2;
    return false;
  }
  return true;
}
