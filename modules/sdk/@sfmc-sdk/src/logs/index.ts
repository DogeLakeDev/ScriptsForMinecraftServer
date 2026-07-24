/**
 * @sfmc-bds/logs — ScriptsForMinecraftServer 统一日志接口
 *
 * 零运行时依赖,纯 ANSI 颜色码。ESM + CJS 双格式输出。
 * 被所有 Node.js 组件 (db-server / qq-bridge / bds-tools / sfmc) 共用。
 */

export type {
  LogLevel,
  LogSource,
  LogEntry,
  Sink,
  FormatOptions,
} from "./types.js";

export {
  inferLevel,
  padSource,
  levelTag,
  levelTagFull,
  highlightText,
  formatLog,
  formatLogLine,
} from "./format.js";

export {
  ansi,
  stripAnsi,
  visibleLen,
  supportsColor,
  wrap,
} from "./ansi.js";

export {
  createStdoutSink,
  createFileSink,
  createCallbackSink,
} from "./sink.js";
export type { StdoutSinkOptions, FileSinkOptions, FileSink } from "./sink.js";

export { createLogger, getOutputLine } from "./logger.js";
export type { LoggerOptions, Logger } from "./logger.js";

export { createMemoryBuffer } from "./memory.js";
export type { MemoryBuffer } from "./memory.js";

export {
  createTerminalProgress,
  withTerminalProgress,
  pauseAllProgress,
  resumeAllProgress,
  withProgressPaused,
  hasActiveProgress,
  formatDownloadSpeed,
} from "./terminal-progress.js";
export type {
  TerminalProgressOptions,
  ProgressHandle,
  ProgressLogFn,
} from "./terminal-progress.js";
