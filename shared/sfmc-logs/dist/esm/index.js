// src/ansi.ts
var ansi = {
  reset: "\x1B[0m",
  bold: "\x1B[1m",
  dim: "\x1B[2m",
  red: "\x1B[31m",
  green: "\x1B[32m",
  yellow: "\x1B[33m",
  blue: "\x1B[34m",
  cyan: "\x1B[36m",
  gray: "\x1B[90m"
};
function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}
function visibleLen(s) {
  return stripAnsi(s).length;
}
function supportsColor(stream) {
  if (process.env["NO_COLOR"]) return false;
  if (process.env["FORCE_COLOR"]) return true;
  return stream.isTTY === true;
}
function wrap(color, s) {
  return `${ansi[color]}${s}${ansi.reset}`;
}

// src/format.ts
function inferLevel(text) {
  const t = text.toUpperCase();
  if (t.includes("[FATAL]") || t.includes("[ERROR]") || t.includes("[X]")) return "error";
  if (t.includes("[WARN") || t.includes("[WARNING]") || t.includes("[!]")) return "warn";
  if (t.includes("[SUCCESS]") || t.includes("[OK]") || t.includes("[\u221A]")) return "success";
  if (t.includes("[DEBUG]") || t.includes("[DBG]")) return "debug";
  return "info";
}
function padSource(s, n = 7) {
  const v = visibleLen(s);
  return v >= n ? s : s + " ".repeat(n - v);
}
function levelTag(lvl, color = true) {
  switch (lvl) {
    case "error":
      return color ? wrap("red", "[ERR]") : "[ERR]";
    case "warn":
      return color ? wrap("yellow", "[WRN]") : "[WRN]";
    case "success":
      return color ? `${ansi.bold}${wrap("green", "[OK]")}` : "[OK]";
    case "debug":
      return color ? `${ansi.dim}[DBG]${ansi.reset}` : "[DBG]";
    default:
      return color ? wrap("blue", "[INF]") : "[INF]";
  }
}
function levelTagFull(lvl, color = true) {
  switch (lvl) {
    case "error":
      return color ? wrap("red", "[ERROR]") : "[ERROR]";
    case "warn":
      return color ? wrap("yellow", "[WARN]") : "[WARN]";
    case "success":
      return color ? `${ansi.bold}${wrap("green", "[OK]")}` : "[OK]";
    case "debug":
      return color ? `${ansi.dim}[DEBUG]${ansi.reset}` : "[DEBUG]";
    default:
      return color ? wrap("blue", "[INFO]") : "[INFO]";
  }
}
function highlightText(raw, color = true) {
  let s = raw;
  s = s.replace(/§[0-9a-fklmnor]/g, "");
  if (!color) return s;
  s = s.replace(/\[ERROR\]/g, (m) => wrap("red", m));
  s = s.replace(/\[FATAL\]/g, (m) => `${ansi.bold}${wrap("red", m)}`);
  s = s.replace(/\[WARN(ING)?\]/g, (m) => wrap("yellow", m));
  s = s.replace(/\[SUCCESS\]/g, (m) => `${ansi.bold}${wrap("green", m)}`);
  s = s.replace(/\[INFO\]/g, (m) => wrap("blue", m));
  s = s.replace(/\[DEBUG\]/g, (m) => `${ansi.dim}${m}${ansi.reset}`);
  s = s.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?\b/g, (m) => wrap("cyan", m));
  s = s.replace(/\b(TPS|MSPT|tick|loaded|saved)\b/gi, (m) => wrap("cyan", m));
  return s;
}
function formatLogLine(entry, color = true) {
  const ts = entry.time.toISOString().replace("T", " ").slice(0, 19);
  const tsStr = color ? `${ansi.dim}${ts}${ansi.reset}` : ts;
  const srcStr = color ? `${ansi.bold}${entry.source}${ansi.reset}` : entry.source;
  const lvlStr = levelTagFull(entry.level, color);
  return `${tsStr} [${srcStr}] ${lvlStr} ${highlightText(entry.text, color)}`;
}
function formatLog(entry, opts = {}) {
  const color = opts.color ?? true;
  const padW = opts.padSourceWidth ?? 7;
  const ts = color ? `${ansi.dim}${entry.time.toLocaleTimeString()}${ansi.reset}` : entry.time.toLocaleTimeString();
  const src = color ? `${ansi.bold}${padSource(entry.source, padW)}${ansi.reset}` : padSource(entry.source, padW);
  const lvl = levelTag(entry.level, color);
  const txt = highlightText(entry.text, color);
  return `${ts} ${src} ${lvl} ${txt}`;
}

// src/sink.ts
import fs from "node:fs";
import path from "node:path";
function createStdoutSink(opts = {}) {
  const color = opts.color ?? supportsColor(process.stdout);
  const stderrForError = opts.stderrForError ?? true;
  const bare = opts.bare ?? false;
  return {
    write(entry, _formatted) {
      const line = bare ? entry.text : formatLogLine(entry, color);
      if (stderrForError && entry.level === "error") {
        process.stderr.write(line + "\n");
      } else {
        process.stdout.write(line + "\n");
      }
    }
  };
}
function createFileSink(filePath, opts = {}) {
  const mkdir = opts.mkdir ?? true;
  const flags = opts.flags ?? "a";
  let stream = null;
  function getStream() {
    if (stream) return stream;
    if (mkdir) fs.mkdirSync(path.dirname(filePath), { recursive: true });
    stream = fs.createWriteStream(filePath, { flags, encoding: "utf-8" });
    stream.on("error", () => {
    });
    return stream;
  }
  return {
    write(entry, _formatted) {
      const line = formatLogLine(entry, false);
      try {
        getStream().write(line + "\n");
      } catch {
      }
    },
    close() {
      if (stream) {
        stream.end();
        stream = null;
      }
    }
  };
}
function createCallbackSink(fn) {
  return {
    write(entry) {
      fn(entry);
    }
  };
}

// src/logger.ts
function createLogger(opts) {
  const sinks = opts.sinks ?? [];
  const subscribers = opts.subscribers ?? [];
  const color = opts.color ?? true;
  const source = opts.source;
  function emit(text, level) {
    const entry = { time: /* @__PURE__ */ new Date(), text, source, level };
    const formatted = formatLogLine(entry, color);
    for (const s of sinks) {
      try {
        s.write(entry, formatted);
      } catch {
      }
    }
    for (const fn of subscribers) {
      try {
        fn(entry);
      } catch {
      }
    }
  }
  return {
    source,
    log(text, level = "info") {
      emit(text, level);
    },
    info(text) {
      emit(text, "info");
    },
    warn(text) {
      emit(text, "warn");
    },
    error(text) {
      emit(text, "error");
    },
    debug(text) {
      emit(text, "debug");
    },
    success(text) {
      emit(text, "success");
    },
    err(e, context) {
      const msg = e instanceof Error ? e.message : String(e);
      const stack = e instanceof Error && e.stack ? `
${e.stack}` : "";
      const text = context ? `${context}: ${msg}${stack}` : `${msg}${stack}`;
      emit(text, "error");
    }
  };
}
function getOutputLine(entry, color = true) {
  return formatLogLine(entry, color);
}

// src/memory.ts
function createMemoryBuffer(maxSize = 5e3) {
  const allLogs = [];
  const subscribers = [];
  function push(entry) {
    allLogs.push(entry);
    if (allLogs.length > maxSize) allLogs.splice(0, allLogs.length - maxSize);
    for (const fn of subscribers) {
      try {
        fn(entry);
      } catch {
      }
    }
  }
  return {
    sink: {
      write(entry) {
        push(entry);
      }
    },
    pushDirect(text, source, level) {
      push({ time: /* @__PURE__ */ new Date(), text, source, level });
    },
    getAll() {
      return allLogs.slice();
    },
    getRecent(n, levels, sources) {
      const lvls = levels ?? [];
      const srcs = sources ?? [];
      const filtered = [];
      for (let i = allLogs.length - 1; i >= 0 && filtered.length < n; i--) {
        const l = allLogs[i];
        if (lvls.length && !lvls.includes(l.level)) continue;
        if (srcs.length && !srcs.includes(l.source)) continue;
        filtered.unshift(l);
      }
      return filtered;
    },
    subscribe(fn) {
      subscribers.push(fn);
      return () => {
        const idx = subscribers.indexOf(fn);
        if (idx >= 0) subscribers.splice(idx, 1);
      };
    },
    clear() {
      allLogs.length = 0;
    },
    get size() {
      return allLogs.length;
    }
  };
}
export {
  ansi,
  createCallbackSink,
  createFileSink,
  createLogger,
  createMemoryBuffer,
  createStdoutSink,
  formatLog,
  formatLogLine,
  getOutputLine,
  highlightText,
  inferLevel,
  levelTag,
  levelTagFull,
  padSource,
  stripAnsi,
  supportsColor,
  visibleLen,
  wrap
};
//# sourceMappingURL=index.js.map
