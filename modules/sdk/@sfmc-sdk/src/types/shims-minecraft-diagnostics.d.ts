/**
 * @minecraft/diagnostics 最小类型垫片（包未安装或版本漂移时仍可 typecheck）。
 * 运行时由 BDS 提供真实模块；esbuild 将其 external。
 */
declare module "@minecraft/diagnostics" {
  export enum SentryEventLevel {
    debug = "debug",
    info = "info",
    warning = "warning",
    error = "error",
    fatal = "fatal",
  }

  export interface SentryOptions {
    dsn: import("@minecraft/server-admin").SecretString | string;
    debug?: boolean;
    maxBreadcrumbs?: number;
    sampleRate?: number;
  }

  export interface SentryCaptureContext {
    level?: SentryEventLevel;
    // 引擎侧可能扩展；保持宽松
    [key: string]: unknown;
  }

  export class Sentry {
    private constructor();
    addBreadcrumb(level: SentryEventLevel, message: string, category?: string): void;
    addTag(name: string, value: string): void;
    captureException(exception: unknown, captureContext?: SentryCaptureContext): void;
    getTags(): Record<string, string>;
    init(options: SentryOptions): void;
    removeTag(name: string): void;
  }

  export const sentry: Sentry;
}
