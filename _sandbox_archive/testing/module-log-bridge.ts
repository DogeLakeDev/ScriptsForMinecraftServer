/**
 * 沙箱内模块 console / Msg → 宿主 log 通知（source=模块 id）。
 * playground-host 安装；不污染 JSON-RPC stdout（落 stderr + notify）。
 */

export type ModuleLogNotify = (payload: {
  channel: "module" | "msg";
  source: string;
  level: "info" | "warn" | "error" | "debug";
  text: string;
}) => void;

export type ModuleLogBridgeHandle = {
  /** 恢复 console 并卸 Msg 钩子 */
  dispose(): void;
};

const SKIP_PREFIXES = [
  "[playground]",
  "[playground-host]",
  "[objects]",
  "[fixture]",
  "[sfmc-testing]",
];

function shouldForward(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return !SKIP_PREFIXES.some((p) => t.includes(p));
}

function formatArgs(args: unknown[]): string {
  return args
    .map((a) => {
      if (typeof a === "string") return a;
      if (a instanceof Error) return a.stack || a.message;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(" ");
}

/**
 * 劫持 console.*：stderr 可见 + notify（source=moduleId）。
 * 跳过已由宿主 notify 的前缀，避免与 host log 双刷。
 */
export function installModuleLogBridge(
  moduleId: string,
  notify: ModuleLogNotify,
  opts?: {
    /** 可选：注册 Msg 系统转发；返回卸钩函数 */
    registerMsg?: (handler: (playerName: string, text: string) => void) => () => void;
  }
): ModuleLogBridgeHandle {
  const source = moduleId.trim() || "module";
  const methods = ["log", "info", "warn", "error", "debug"] as const;
  const originals: Record<(typeof methods)[number], (...args: unknown[]) => void> = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
  };

  for (const m of methods) {
    console[m] = (...args: unknown[]) => {
      const text = formatArgs(args);
      try {
        process.stderr.write(`${text}\n`);
      } catch {
        /* ignore */
      }
      if (!shouldForward(text)) return;
      const level = m === "log" || m === "info" ? "info" : m;
      notify({ channel: "module", source, level, text });
    };
  }

  let unregMsg: (() => void) | undefined;
  if (opts?.registerMsg) {
    unregMsg = opts.registerMsg((playerName, text) => {
      const line = `[Msg] ${playerName}: ${text}`;
      notify({ channel: "msg", source, level: "info", text: line });
    });
  }

  return {
    dispose() {
      for (const m of methods) {
        console[m] = originals[m] as typeof console.log;
      }
      unregMsg?.();
    },
  };
}

export function shouldForwardModuleLog(text: string): boolean {
  return shouldForward(text);
}
