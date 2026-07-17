/**
 * theme.ts — One Half Dark 色板
 *
 */

export type Color = string;

export const T = {
  // 灰阶层
  bg: "#282c34", // 全局底色
  panel: "#21252b", // 卡片 / 侧栏（比 bg 略深一档）
  surface: "#2c313c", // 普通行背景
  surfaceHi: "#3e4452", // 选中行 / 输入框 / 焦点（最亮）

  // 文字
  text: "#abb2bf", // 主体文字（白色为主，占比 >= 70%） #dcdfe4
  muted: "#5c6370", // 副文字 / 时间戳
  subtle: "#4b5263", // 占位符 / 暗分隔

  // 语义色（One Half Dark 调色板）
  red: "#e06c75",
  green: "#98c379",
  yellow: "#e5c07b",
  blue: "#61afef",
  cyan: "#56b6c2",
  purple: "#c678dd",
  orange: "#d19a66",

  // 兼容别名（部分视图仍用旧名）
  inverse: "#282c34",
  primary: "#61afef",
  accent: "#c678dd",
  info: "#61afef",
  success: "#98c379",
  warning: "#e5c07b",
  error: "#e06c75",

  // 服务状态语义
  serviceRunning: "#98c379",
  serviceStopped: "#5c6370",
  serviceStale: "#e5c07b",
} as const;

/**
 * 日志等级前缀符号 + 配色。
 * 输出时每条日志以 "{prefix} {content}" 形式渲染，
 * prefix 用对应 color 染色，content 走 highlighter 分词。
 */
export type Level = "info" | "success" | "warning" | "error" | "debug";

export const LEVEL_PREFIX: Record<Level, string> = {
  info: "[*]",
  success: "[+]",
  warning: "[!]",
  error: "[x]",
  debug: "[?]",
};

export const LEVEL_COLOR: Record<Level, Color> = {
  info: T.blue,
  success: T.green,
  warning: T.yellow,
  error: T.red,
  debug: T.muted,
};

/** 等级排序（用于过滤弹层） */
export const LEVEL_ORDER: Level[] = ["error", "warning", "success", "info", "debug"];
