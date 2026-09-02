/**
 * ansi.ts — 纯 ANSI 颜色码工具
 *
 */

/** ANSI 转义码常量（One Dark 风格配色）。 */
export const ansi = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
} as const;

/**
 * 移除字符串中包含的所有 ANSI 转义码。
 *
 * @param s 原始字符串。
 * @returns 去除 ANSI 转义序列后的纯文本字符串。
 */
export function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * 计算字符串的终端可见字符长度（自动排除 ANSI 颜色与样式转义码）。
 *
 * @param s 待计算的字符串。
 * @returns 实际可见字符宽度。
 */
export function visibleLen(s: string): number {
  return stripAnsi(s).length;
}

/**
 * 检测输出流是否支持彩色输出（遵循 NO_COLOR 与 FORCE_COLOR 环境变量行业规范）。
 *
 * @param stream 目标输出流对象（如 process.stdout）。
 * @returns 是否支持色彩输出。
 */
export function supportsColor(stream: { isTTY?: boolean }): boolean {
  if (process.env["NO_COLOR"]) return false;
  if (process.env["FORCE_COLOR"]) return true;
  return stream.isTTY === true;
}

/**
 * 使用指定的 ANSI 颜色样式包裹目标字符串。
 *
 * @param color 颜色名称键。
 * @param s 待着色的字符串。
 * @returns 着色并重置样式的字符串。
 */
export function wrap(color: keyof typeof ansi, s: string): string {
  return `${ansi[color]}${s}${ansi.reset}`;
}

