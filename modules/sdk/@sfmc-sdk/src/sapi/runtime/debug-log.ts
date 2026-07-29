/**
 * debug-log.ts — SAPI 统一调试日志门面
 *
 * 控制台默认关闭（setDebugEnabled）；可通过 addDebugSink 扩展（如 Sentry）。
 * sink 始终收到调用（自行判断是否处理）；控制台另受 enabled + minLevel 约束。
 */

/** 调试级别映射（DEBUG/INFO/WARN/ERROR → 数值）。仅作 `DebugLevel` 类型来源，请勿直接读。 */
export const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 } as const;

export type DebugLevel = keyof typeof LEVELS;

/** 调试日志扩展出口（OCP：Sentry 等经此挂载，勿改核心 switch）。 */
export type DebugSink = {
  onLog(level: DebugLevel, module: string, msg: string, args: unknown[]): void;
};

let consoleEnabled = false;
let minLevel = 0;
const sinks: DebugSink[] = [];

/** 是否输出到控制台（默认 false，保持历史静默行为）。 */
export function setDebugEnabled(on: boolean): void {
  consoleEnabled = on;
}

/** 当前控制台是否开启。 */
export function isDebugEnabled(): boolean {
  return consoleEnabled;
}

/** 设置控制台最低级别（不限制 sink；sink 自行决定）。 */
export function setDebugLevel(level: DebugLevel): void {
  minLevel = LEVELS[level];
}

/** 注册扩展 sink；同一引用只登记一次。 */
export function addDebugSink(sink: DebugSink): void {
  if (!sinks.includes(sink)) sinks.push(sink);
}

/** 移除已注册的 sink。 */
export function removeDebugSink(sink: DebugSink): void {
  const i = sinks.indexOf(sink);
  if (i >= 0) sinks.splice(i, 1);
}

function ts(): string {
  return new Date().toISOString().slice(11, 23);
}

function formatExtra(args: unknown[]): string {
  if (!args.length) return "";
  return (
    " | " +
    args
      .map((a) => {
        try {
          return typeof a === "object" ? JSON.stringify(a) : String(a);
        } catch {
          return String(a);
        }
      })
      .join(" ")
  );
}

function notifySinks(level: DebugLevel, module: string, msg: string, args: unknown[]): void {
  for (const sink of sinks) {
    try {
      sink.onLog(level, module, msg, args);
    } catch {
      /* sink 失败不影响主流程 */
    }
  }
}

function log(level: DebugLevel, module: string, msg: string, ...args: unknown[]) {
  // sink：始终通知（由 sink 自身判断 Sentry 是否已 init）
  notifySinks(level, module, msg, args);

  const line = `[${ts()}][${level}][${module}] ${msg}${formatExtra(args)}`;

  // ERROR 始终可见（对齐原 ModuleRegistry console.warn 的可运维性）
  if (level === "ERROR") {
    console.warn(line);
    return;
  }

  if (!consoleEnabled) return;
  if (LEVELS[level] < minLevel) return;
  console.log(line);
}

/**
 * SAPI 调试日志门面（DEBUG/INFO/WARN 控制台默认关闭；ERROR 始终 `console.warn`）。
 * `d`/`i`/`w`/`e` 对应 DEBUG/INFO/WARN/ERROR；首参为短模块标签。
 * `e` 的 args 中若含 Error，Sentry sink 会优先用于 captureException。
 */
export const debug = {
  /** DEBUG */
  d: (m: string, msg: string, ...args: unknown[]) => log("DEBUG", m, msg, ...args),
  /** INFO */
  i: (m: string, msg: string, ...args: unknown[]) => log("INFO", m, msg, ...args),
  /** WARN */
  w: (m: string, msg: string, ...args: unknown[]) => log("WARN", m, msg, ...args),
  /** ERROR */
  e: (m: string, msg: string, ...args: unknown[]) => log("ERROR", m, msg, ...args),
};
