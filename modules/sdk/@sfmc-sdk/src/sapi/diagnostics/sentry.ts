/**
 * sentry.ts — @minecraft/diagnostics 接入 + DebugSink
 *
 * 仅当 secrets.json 存在 SENTRY_DSN 时 init 并挂到 debug；缺省关闭。
 */

import { sentry, SentryEventLevel } from "@minecraft/diagnostics";
import { secrets, variables } from "@minecraft/server-admin";
import {
  addDebugSink,
  removeDebugSink,
  setDebugEnabled,
  type DebugLevel,
  type DebugSink,
} from "../runtime/debug-log.js";

let enabled = false;
let sinkRegistered: DebugSink | null = null;

function levelToSentry(level: DebugLevel): SentryEventLevel {
  switch (level) {
    case "DEBUG":
      return SentryEventLevel.debug;
    case "INFO":
      return SentryEventLevel.info;
    case "WARN":
      return SentryEventLevel.warning;
    case "ERROR":
      return SentryEventLevel.error;
  }
}

function findError(args: unknown[]): Error | undefined {
  for (const a of args) {
    if (a instanceof Error) return a;
  }
  return undefined;
}

const sentryDebugSink: DebugSink = {
  onLog(level, module, msg, args) {
    if (!enabled) return;
    try {
      if (level === "ERROR") {
        const err = findError(args) ?? new Error(`[${module}] ${msg}`);
        try {
          sentry.addTag("debug_module", module);
        } catch {
          /* ignore */
        }
        sentry.captureException(err, { level: SentryEventLevel.error });
        return;
      }
      const extra =
        args.length === 0
          ? ""
          : " " +
            args
              .map((a) => {
                try {
                  return typeof a === "object" ? JSON.stringify(a) : String(a);
                } catch {
                  return String(a);
                }
              })
              .join(" ");
      sentry.addBreadcrumb(levelToSentry(level), `${msg}${extra}`, module);
    } catch {
      /* 未 init 或引擎异常：静默 */
    }
  },
};

/**
 * 从 BDS variables.json 读取 `sfmc_debug` 配置项，若为真值则启用控制台调试日志。
 * 本函数不依赖 Sentry，支持独立调用。
 */
export function applyDebugFromVariables(): void {
  try {
    const raw = variables.get("sfmc_debug");
    const on =
      raw === true ||
      raw === 1 ||
      (typeof raw === "string" && ["true", "1", "yes", "on"].includes(raw.trim().toLowerCase()));
    if (on) setDebugEnabled(true);
  } catch {
    /* variables 不可用（非 BDS）时忽略 */
  }
}

/**
 * 检查并根据配置初始化 Sentry 监控。若成功读取到有效 DSN 则初始化并将 Sentry 挂载为 DebugSink。
 *
 * @returns 若 Sentry 已成功启用返回 `true`，否则返回 `false`。
 */
export function initSentryIfConfigured(): boolean {
  if (enabled) return true;

  let dsn: ReturnType<typeof secrets.get> | undefined;
  try {
    dsn = secrets.get("SENTRY_DSN");
  } catch {
    return false;
  }
  // SecretString 为占位；缺 key 时部分实现可能仍返回对象，用 names 再校验
  try {
    if (!secrets.names.includes("SENTRY_DSN")) return false;
  } catch {
    /* names 不可用则继续尝试 init */
  }
  if (dsn == null) return false;

  try {
    sentry.init({ dsn, sampleRate: 1, maxBreadcrumbs: 20, debug: false });
    sentry.addTag("product", "sfmc");
    sentry.addTag("runtime", "sapi");
    sinkRegistered = sentryDebugSink;
    addDebugSink(sentryDebugSink);
    enabled = true;
    return true;
  } catch (e) {
    // 已初始化 / 非法 DSN
    console.warn(`[sentry] init failed: ${(e as Error)?.message || e}`);
    return false;
  }
}

/** 查询当前是否已成功初始化并启用了 Sentry 监控。 */
export function isSentryEnabled(): boolean {
  return enabled;
}

/** 错误上报上下文选项。 */
export interface ReportErrorContext {
  /** 附加到 Sentry 事件的自定义标签字典。 */
  tags?: Record<string, string>;
}

/**
 * 手动上报异常至 Sentry（非 debug 日志管道的直通封装）；若 Sentry 未初始化则静默跳过。
 *
 * @param err 待上报的异常对象或错误消息。
 * @param context 可选的标签上下文对象。
 */
export function reportError(err: unknown, context?: ReportErrorContext): void {

  if (!enabled) return;
  try {
    if (context?.tags) {
      for (const [k, v] of Object.entries(context.tags)) {
        try {
          sentry.addTag(k, v);
        } catch {
          /* ignore */
        }
      }
    }
    sentry.captureException(err);
  } catch {
    /* ignore */
  }
}

/**
 * 测试或热切换：卸下 sink（一般无需调用）。
 */
export function detachSentryDebugSink(): void {
  if (sinkRegistered) {
    removeDebugSink(sinkRegistered);
    sinkRegistered = null;
  }
  enabled = false;
}
