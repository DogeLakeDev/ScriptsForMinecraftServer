/**
 * ANSI 颜色常量与工具函数
 * 色彩命名参考 opencode 语义：success/error/warning/info/primary/muted
 */

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[90m',
  // opencode 语义色
  primary: '\x1b[96m',   // 青色 - 重点/链接/焦点
  success: '\x1b[92m',   // 绿色 - 成功/运行中
  error: '\x1b[91m',     // 红色 - 错误/停止
  warning: '\x1b[93m',   // 黄色 - 警告
  info: '\x1b[94m',      // 蓝色 - 信息
  muted: '\x1b[90m',     // 灰色 - 次要信息
  accent: '\x1b[95m',    // 紫色 - 强调
  // 向后兼容别名
  cyan: '\x1b[96m',
  green: '\x1b[92m',
  red: '\x1b[91m',
  yellow: '\x1b[93m',
  blue: '\x1b[94m',
  magenta: '\x1b[95m',
  gray: '\x1b[90m',
  clear: '\x1b[2J',
  home: '\x1b[H',
  cll: '\x1b[K',
};

function strip(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

function pad(s, w) {
  const len = strip(s).length;
  return len >= w ? s.slice(0, Math.max(w - 1, 0)) : s + ' '.repeat(w - len);
}

function truncate(s, w) {
  const clean = strip(s);
  return clean.length > w ? clean.slice(0, w - 1) + '…' : s;
}

function dim(s) { return `${C.muted}${s}${C.reset}`; }
function success(s) { return `${C.success}${s}${C.reset}`; }
function error(s) { return `${C.error}${s}${C.reset}`; }
function warning(s) { return `${C.warning}${s}${C.reset}`; }
function info(s) { return `${C.info}${s}${C.reset}`; }
function primary(s) { return `${C.primary}${s}${C.reset}`; }
function bold(s) { return `${C.bold}${s}${C.reset}`; }
function accent(s) { return `${C.accent}${s}${C.reset}`; }
// 向后兼容
const cyan = primary;
const green = success;
const red = error;
const yellow = warning;
const blue = info;
const gray = dim;

module.exports = {
  C, strip, pad, truncate,
  dim, success, error, warning, info, primary, bold, accent,
  cyan, green, red, yellow, blue, gray,
};
