const ENABLED = false;

const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 } as const;

let minLevel = 0;

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

export const debug = {
  d: (m: string, msg: string, ...args: any[]) => log("DEBUG", m, msg, ...args),
  i: (m: string, msg: string, ...args: any[]) => log("INFO", m, msg, ...args),
  w: (m: string, msg: string, ...args: any[]) => log("WARN", m, msg, ...args),
  e: (m: string, msg: string, ...args: any[]) => log("ERROR", m, msg, ...args),
};
