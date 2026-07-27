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
 * 从 BDS variables.json 读取 `sfmc_debug`，为真则打开控制台 debug。
 * 不依赖 Sentry；可单独调用。
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
 * 若配置了 SENTRY_DSN 则 init Sentry，并注册 debug sink。
 * @returns 是否已启用
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

/** 是否已成功 init Sentry。 */
export function isSentryEnabled(): boolean {
  return enabled;
}

export interface ReportErrorContext {
  tags?: Record<string, string>;
}

/**
 * 非 debug 路径的薄封装；未 init 时 no-op。
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
