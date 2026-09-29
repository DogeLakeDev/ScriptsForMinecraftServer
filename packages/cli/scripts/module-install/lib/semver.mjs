// @ts-check
/**
 * 模块版本比较。
 * 只覆盖 x.y.z 与可选预发布号，供自动更新决定能否升级。
 */

/**
 * @typedef {{ major: number, minor: number, patch: number, pre: string[] | null }} ParsedSemver
 */

/**
 * @param {string | null | undefined} input
 * @returns {ParsedSemver | null}
 */
export function parseSemver(input) {
  const match = String(input ?? "")
    .trim()
    .match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    pre: match[4] ? match[4].split(".") : null,
  };
}

/**
 * 预发布标识按 semver 规则比较：数字按数值，其余按字典序。
 * @param {string} a
 * @param {string} b
 */
function comparePreId(a, b) {
  const aNum = /^\d+$/.test(a);
  const bNum = /^\d+$/.test(b);
  if (aNum && bNum) return Number(a) - Number(b);
  if (aNum) return -1;
  if (bNum) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * @param {string[] | null} a
 * @param {string[] | null} b
 */
function comparePre(a, b) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const left = a[i];
    const right = b[i];
    if (left === undefined) return -1;
    if (right === undefined) return 1;
    const diff = comparePreId(left, right);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * 比较两个版本。无法解析时返回 null。
 * @param {string | null | undefined} left
 * @param {string | null | undefined} right
 * @returns {-1 | 0 | 1 | null}
 */
export function compareSemver(left, right) {
  const a = parseSemver(left);
  const b = parseSemver(right);
  if (!a || !b) return null;
  if (a.major !== b.major) return a.major > b.major ? 1 : -1;
  if (a.minor !== b.minor) return a.minor > b.minor ? 1 : -1;
  if (a.patch !== b.patch) return a.patch > b.patch ? 1 : -1;
  const pre = comparePre(a.pre, b.pre);
  return pre > 0 ? 1 : pre < 0 ? -1 : 0;
}

/**
 * 目标版本的主版本号是否高于已装版本。
 * @param {string | null | undefined} installed
 * @param {string | null | undefined} target
 */
export function isMajorBump(installed, target) {
  const from = parseSemver(installed);
  const to = parseSemver(target);
  if (!from || !to) return false;
  return to.major > from.major;
}

/**
 * 判断本机 SDK 版本是否满足索引里的范围。
 * 支持 *、精确版本、以及 >= > <= < ^ ~ 前缀。
 * @param {string | null | undefined} version
 * @param {string | null | undefined} range
 */
export function satisfiesSdk(version, range) {
  const raw = String(range ?? "").trim();
  if (!raw || raw === "*") return true;
  const match = raw.match(/^(>=|>|<=|<|\^|~|=)?\s*v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/);
  if (!match) return false;
  const op = match[1] || "=";
  const wanted = match[2];
  const cmp = compareSemver(version, wanted);
  if (cmp === null || !wanted) return false;
  if (op === "=") return cmp === 0;
  if (op === ">=") return cmp >= 0;
  if (op === ">") return cmp > 0;
  if (op === "<=") return cmp <= 0;
  if (op === "<") return cmp < 0;
  const current = parseSemver(version);
  const base = parseSemver(wanted);
  if (!current || !base) return false;
  if (op === "^") {
    if (cmp < 0) return false;
    if (base.major > 0) return current.major === base.major;
    if (base.minor > 0) return current.major === 0 && current.minor === base.minor;
    return current.major === 0 && current.minor === 0 && current.patch === base.patch;
  }
  if (op === "~") {
    return cmp >= 0 && current.major === base.major && current.minor === base.minor;
  }
  return false;
}
