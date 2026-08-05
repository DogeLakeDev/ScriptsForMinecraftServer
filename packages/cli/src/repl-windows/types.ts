/**
 * repl-windows/types.ts — REPL 类窗口契约（Host 只依赖本接口）
 */
import type { UnifiedLog } from "../logs.js";
import type { ServiceName } from "../services.js";

export type WindowKeyResult =
  | { action: "none" }
  | { action: "back" }
  | { action: "redraw" }
  | { action: "handled" };

/** 简化按键：由 readLine 翻译后传入 */
export type WindowKeyEvent =
  | { type: "escape" }
  | { type: "char"; ch: string }
  | { type: "ctrl"; code: string };

export type WindowChrome = {
  showsInput: boolean;
  /** 无输入时底部 shortcut 条（已着色） */
  footerShortcuts: string;
  title: string;
};

export interface ReplWindow {
  readonly id: string;
  readonly title: string;
  /** 是否绘制 ❯ 输入行 */
  readonly showsInput: boolean;
  /** 无输入时的 shortcut 文案（已着色） */
  footerShortcuts: string;
  /** 服务窗绑定的发送目标；非服务窗为 undefined */
  readonly serviceName?: ServiceName;
  /** 是否接收并展示该条日志 */
  acceptLog(log: UnifiedLog): boolean;
  /** TTY 展示行（含 ANSI）与悬挂缩进列宽 */
  formatLogLine(log: UnifiedLog): { text: string; indent: number };
  onActivate?(): void;
  onDeactivate?(): void;
  onKey?(ev: WindowKeyEvent): WindowKeyResult;
  /** 激活/筛选变化时需要重放缓冲 */
  getReplayFilter?(): { levels: string[]; sources: string[] };
}
