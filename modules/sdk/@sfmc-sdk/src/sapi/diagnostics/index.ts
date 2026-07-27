/**
 * @sfmc-bds/sdk/sapi/diagnostics — BDS 诊断 / Sentry 接入
 *
 * 经 debug 门面挂 sink；DSN 缺省关闭。
 */
export {
  applyDebugFromVariables,
  detachSentryDebugSink,
  initSentryIfConfigured,
  isSentryEnabled,
  reportError,
} from "./sentry.js";
export type { ReportErrorContext } from "./sentry.js";

/** `@sfmc-bds/sdk/sapi/diagnostics` 子路径版本号。 */
export const SFMC_SAPI_DIAGNOSTICS_VERSION = "0.1.0" as const;
