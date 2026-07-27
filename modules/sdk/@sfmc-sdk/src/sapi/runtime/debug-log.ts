const ENABLED = false;

const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 } as const;

let minLevel = 0;

/** 设置 SAPI 调试日志最低级别（`ENABLED` 为 false 时整门面静默） */
export function setDebugLevel(level: keyof typeof LEVELS) {
  minLevel = LEVELS[level];
}

function ts(): string {
  return new Date().toISOString().slice(11, 23);
}

function log(level: keyof typeof LEVELS, module: string, msg: string, ...args: any[]) {
  if (!ENABLED) return;
  if (LEVELS[level] < minLevel) return;
  const extra = args.length
    ? " | " +
      args
        .map((a) => {
          try {
            return typeof a === "object" ? JSON.stringify(a) : String(a);
          } catch {
            return String(a);
          }
        })
        .join(" ")
    : "";
  console.log(`[${ts()}][${level}][${module}] ${msg}${extra}`);
}

/**
 * SAPI 调试日志门面（默认关闭）。
 * `d`/`i`/`w`/`e` 对应 DEBUG/INFO/WARN/ERROR；首参为短模块标签。
 */
export const debug = {
  /** DEBUG */
  d: (m: string, msg: string, ...args: any[]) => log("DEBUG", m, msg, ...args),
  /** INFO */
  i: (m: string, msg: string, ...args: any[]) => log("INFO", m, msg, ...args),
  /** WARN */
  w: (m: string, msg: string, ...args: any[]) => log("WARN", m, msg, ...args),
  /** ERROR */
  e: (m: string, msg: string, ...args: any[]) => log("ERROR", m, msg, ...args),
};
