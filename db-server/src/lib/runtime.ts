/**
 * 解析 Node.js 版本字符串，提取主版本号、次版本号和补丁号。
 * @param version - 版本字符串（可选），例如 "v14.17.0" 或 "14.17.0"。默认为 process.versions.node。
 * @returns 包含 major, minor, patch 的对象，若格式无效则返回 null。
 */
export function parseNodeVersion(version: string = process.versions.node): {
  major: number;
  minor: number;
  patch: number;
} | null {
  const match = String(version).match(/^v?(\d+)\.(\d+)\.(\d+)/);
  return match ? { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) } : null;
}

/**
 *
 *
 * @param {number} [minMajor=22]
 * @param {number} [minMinor=5]
 * @return {*}  {boolean}
 */
export function assertNodeVersion(minMajor: number = 22, minMinor: number = 5): boolean {
  const actual = parseNodeVersion();
  if (!actual || actual.major < minMajor || (actual.major === minMajor && actual.minor < minMinor)) {
    console.error(`[Runtime] Node.js ${minMajor}.${minMinor}+ is required; found ${process.versions.node}`);
    process.exitCode = 2;
    return false;
  }
  return true;
}
