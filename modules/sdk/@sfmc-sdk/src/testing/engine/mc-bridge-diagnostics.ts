/** @minecraft/diagnostics 薄 stub。 */
export const SentryEventLevel = {
  Error: "error",
  Warning: "warning",
  Info: "info",
  Debug: "debug",
} as const;

export const sentry = {
  init() {},
  captureException() {},
  captureEvent() {},
  addBreadcrumb() {},
};
