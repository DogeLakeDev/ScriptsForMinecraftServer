#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// package.json
var package_default;
var init_package = __esm({
  "package.json"() {
    package_default = {
      name: "sfmc-cil",
      version: "0.1.0",
      private: true,
      description: "REPL management tool for ScriptsForMinecraftServer",
      type: "module",
      scripts: {
        start: "node ./dist/sfmc.js",
        build: "node build.js",
        dev: "tsx src/main.ts"
      },
      dependencies: {
        "@sfmc/logs": "*",
        chalk: "^5.4.1",
        "@clack/prompts": "^0.9.1",
        "cli-progress": "^3.12.0"
      }
    };
  }
});

// ../shared/sfmc-logs/dist/esm/index.js
function inferLevel(text2) {
  const t = text2.toUpperCase();
  if (t.includes("[FATAL]") || t.includes("[ERROR]") || t.includes("[X]")) return "error";
  if (t.includes("[WARN") || t.includes("[WARNING]") || t.includes("[!]")) return "warn";
  if (t.includes("[SUCCESS]") || t.includes("[OK]") || t.includes("[\u221A]")) return "success";
  if (t.includes("[DEBUG]") || t.includes("[DBG]")) return "debug";
  return "info";
}
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
    pushDirect(text2, source, level) {
      push({ time: /* @__PURE__ */ new Date(), text: text2, source, level });
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
var init_esm = __esm({
  "../shared/sfmc-logs/dist/esm/index.js"() {
    "use strict";
  }
});

// src/theme.ts
import chalk from "chalk";
function highlightLogLine(raw) {
  return raw.replace(/§[0-9a-fklmnor]/g, "").replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, (m) => c.dim(m)).replace(/\[ERROR\]/g, (m) => c.red(m)).replace(/\[FATAL\]/g, (m) => c.red(c.bold(m))).replace(/\[WARN(ING)?\]/g, (m) => c.yellow(m)).replace(/\[SUCCESS\]/g, (m) => c.green(c.bold(m))).replace(/\[INFO\]/g, (m) => c.blue(m)).replace(/\[DEBUG\]/g, (m) => c.dim(m)).replace(/\[PLAYER\]/g, (m) => c.green(m)).replace(/\[TPS\]/g, (m) => c.cyan(m)).replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?\b/g, (m) => c.cyan(m)).replace(/Player (joined|left):/g, (m) => c.green(m)).replace(/Server (started|stopped)/g, (m) => c.green(m)).replace(/\b(TPS|MSPT|tick|loaded|saved)\b/gi, (m) => c.cyan(m));
}
var T, c, W, DIVIDER;
var init_theme = __esm({
  "src/theme.ts"() {
    "use strict";
    T = {
      bg: "#282c34",
      panel: "#21252b",
      surface: "#2c313c",
      surfaceHi: "#3e4452",
      subtle: "#4b5263",
      text: "#dcdfe4",
      muted: "#888888",
      red: "#e06c75",
      green: "#98c379",
      yellow: "#e5c07b",
      blue: "#61afef",
      cyan: "#56b6c2",
      purple: "#c678dd",
      orange: "#d19a66"
    };
    c = {
      dim: chalk.hex(T.muted),
      text: chalk.hex(T.text),
      green: chalk.hex(T.green),
      red: chalk.hex(T.red),
      yellow: chalk.hex(T.yellow),
      blue: chalk.hex(T.blue),
      cyan: chalk.hex(T.cyan),
      purple: chalk.hex(T.purple),
      orange: chalk.hex(T.orange),
      bold: chalk.bold
    };
    W = 58;
    DIVIDER = c.dim("\u2500".repeat(W - 2));
  }
});

// src/wizard.ts
var wizard_exports = {};
__export(wizard_exports, {
  runWizard: () => runWizard
});
import { confirm, intro, isCancel, note, outro, select, spinner, text } from "@clack/prompts";
import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
function cfg(name) {
  return path.join(ROOT, "configs", name);
}
function read(file) {
  try {
    return JSON.parse(fs.readFileSync(cfg(file), "utf-8"));
  } catch {
    return {};
  }
}
function write(file, data) {
  fs.mkdirSync(path.dirname(cfg(file)), { recursive: true });
  fs.writeFileSync(cfg(file), JSON.stringify(data, null, 2), "utf-8");
}
async function waitForHealth(port, ms = 15e3) {
  const t = Date.now();
  while (Date.now() - t < ms) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) return true;
    } catch {
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}
async function runWizard() {
  intro(c.bold("sfmc \u2014 Setup Wizard"));
  const hasConfigs = fs.existsSync(cfg("db_config.json"));
  if (hasConfigs) {
    const r = await confirm({ message: "Configs already exist. Re-run setup?", initialValue: false });
    if (isCancel(r) || !r) {
      outro(c.dim("Setup skipped"));
      return;
    }
  }
  const s = spinner();
  s.start("Checking environment");
  const bdsExists = (() => {
    try {
      const p = read("bds_updater.json").bds_path;
      return p ? fs.existsSync(path.join(p, "bedrock_server.exe")) : false;
    } catch {
      return false;
    }
  })();
  const hasDefaults = fs.existsSync(path.join(ROOT, "configs-default", "db_config.json"));
  s.stop(bdsExists ? "BDS found" : "BDS not found");
  note(c.text(`Root: ${ROOT}`), "Environment");
  let downloadBds = false;
  let bdsChannel = "release";
  if (!bdsExists) {
    const d = await confirm({ message: "BDS not found \u2014 download now?", initialValue: true });
    if (!isCancel(d) && d) {
      downloadBds = true;
      const ch = await select({
        message: "Select channel:",
        options: [
          { value: "release", label: "Release", hint: "stable" },
          { value: "preview", label: "Preview", hint: "may be unstable" }
        ]
      });
      if (isCancel(ch)) {
        downloadBds = false;
      } else {
        bdsChannel = ch;
      }
    }
  }
  let dbPort2 = 3001;
  if (hasConfigs) {
    dbPort2 = read("db_config.json").db_port ?? 3001;
  } else {
    const p = await text({
      message: "db-server port:",
      initialValue: "3001",
      validate: (v) => {
        const n = parseInt(v, 10);
        if (isNaN(n) || n < 1024 || n > 65535) return "Enter 1024-65535";
      }
    });
    if (!isCancel(p)) dbPort2 = parseInt(p, 10);
  }
  let qqGroupId = 0;
  if (!hasConfigs) {
    const g = await text({
      message: "QQ group ID (0 to disable):",
      initialValue: "0",
      validate: (v) => {
        const n = parseInt(v, 10);
        if (isNaN(n) || n < 0) return "Enter a number \u2265 0";
      }
    });
    if (!isCancel(g)) qqGroupId = parseInt(g, 10);
  }
  s.start("Writing configs");
  try {
    if (!hasConfigs || read("db_config.json").db_port !== dbPort2) {
      write("db_config.json", {
        _comment: "sfmc init wizard",
        db_port: dbPort2,
        http_auth: "",
        dbDir: "../data/sfmc_data.db",
        modulesDir: "../modules"
      });
    }
    if (!hasConfigs) {
      write("qq_config.json", {
        _comment: "sfmc init wizard",
        qq_ws_port: 3002,
        qq_group_id: qqGroupId,
        llbot_enabled: qqGroupId > 0,
        llbot_host: "127.0.0.1",
        llbot_port: 3004,
        llbot_token: "",
        bridge_channel_id: "",
        mctoqq_prefix: "[MC]"
      });
      write("bds_updater.json", {
        _comment: "sfmc init wizard",
        bds_path: "D:\\Minecraft\\BEServer",
        backup_dir: "D:\\Minecraft\\BEServer_backups",
        channel: bdsChannel,
        preserve: ["server.properties", "whitelist.json", "permissions.json", "allowlist.json", "worlds", "config"],
        qq_notify: qqGroupId > 0,
        auto_check: true,
        crash_restart: true,
        auto_restart: true
      });
      if (hasDefaults) {
        fs.cpSync(path.join(ROOT, "configs-default", "."), cfg("."), { recursive: true, force: false });
      }
    }
    s.stop("Configs written");
  } catch (e) {
    s.stop(c.red("Write failed"));
    outro(c.red(`Error: ${e.message}`));
    return;
  }
  if (downloadBds) {
    s.start("Downloading BDS");
    try {
      execSync(`node bds-tools/dist/check-update.js --channel=${bdsChannel} --force`, {
        cwd: ROOT,
        stdio: "pipe",
        timeout: 3e5
      });
      s.stop(c.green("BDS downloaded"));
    } catch (e) {
      const err = e;
      s.stop(c.red("Download failed"));
      console.log(c.red(err.stderr?.toString() || err.message || "unknown error"));
    }
  }
  s.start("Initializing DB");
  try {
    const child = spawn(process.execPath, ["db-server/dist/index.js"], {
      cwd: ROOT,
      stdio: "ignore",
      env: { ...process.env, DB_PORT: String(dbPort2) }
    });
    if (await waitForHealth(dbPort2)) {
      await new Promise((r) => setTimeout(r, 1e3));
      child.kill("SIGTERM");
      setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
        }
      }, 3e3);
      s.stop(c.green("Database initialized"));
    } else {
      s.stop(c.yellow("Timed out \u2014 start db-server manually"));
      try {
        child.kill("SIGTERM");
      } catch {
      }
    }
  } catch {
    s.stop(c.yellow("Skipped \u2014 start manually"));
  }
  outro(c.green("Done! Run sfmc to start managing."));
}
var init_wizard = __esm({
  "src/wizard.ts"() {
    "use strict";
    init_services();
    init_theme();
  }
});

// src/repl.ts
import process2, { stdin, stdout } from "node:process";
function setRaw(v) {
  try {
    if (stdin.isTTY && typeof stdin.setRawMode === "function") stdin.setRawMode(v);
  } catch {
  }
}
function parseLine(line) {
  const endsWithSpace = line.length > 0 && /\s$/.test(line);
  const trimmed = line.trim();
  if (!trimmed) return { cmd: "", argIndex: 0, current: "" };
  const tokens = trimmed.split(/\s+/);
  if (endsWithSpace) {
    return { cmd: tokens[0] ?? "", argIndex: tokens.length - 1, current: "" };
  }
  if (tokens.length === 1) return { cmd: "", argIndex: 0, current: tokens[0] };
  return { cmd: tokens[0], argIndex: tokens.length - 2, current: tokens[tokens.length - 1] };
}
function getCompletions(parsed) {
  const { cmd, argIndex, current } = parsed;
  const sw = (s) => s.startsWith(current);
  if (!cmd) return COMMANDS.filter(sw);
  switch (cmd) {
    case "logs":
    case "log":
      if (argIndex === 0) return SERVICE_NAMES.filter(sw);
      if (argIndex === 1) return ["-n", "-f"].filter(sw);
      return [];
    case "start":
    case "stop":
    case "restart":
      if (argIndex === 0) return ["-all", ...SERVICE_NAMES].filter(sw);
      return [];
    case "send":
      if (argIndex === 0) return SERVICE_NAMES.filter(sw);
      return [];
    case "update":
      return ["--check-only", "--force", "--channel=release", "--channel=preview"].filter(sw);
    default:
      return [];
  }
}
function consumeEscapeSeq(chunk, i) {
  if (chunk[i] !== 27) return null;
  const rem = chunk.length - i - 1;
  if (rem >= 2 && chunk[i + 1] === 91) {
    let j = i + 2;
    while (j < chunk.length && chunk[j] >= 48 && chunk[j] <= 63) j++;
    while (j < chunk.length && chunk[j] >= 32 && chunk[j] <= 47) j++;
    if (j < chunk.length && chunk[j] >= 64 && chunk[j] <= 126) j++;
    return j;
  }
  if (rem >= 2 && chunk[i + 1] === 79) return i + 3;
  if (rem >= 1) return i + 2;
  return i + 1;
}
async function simpleSelect(items, label) {
  const wasRaw = stdin.isRaw ?? false;
  setRaw(true);
  stdin.resume();
  let selected = 0;
  const h = Math.min(items.length, 8);
  let lastLines = h;
  function render(first) {
    if (!first) {
      stdout.write(`\x1B[${lastLines}A\x1B[J`);
    } else {
      stdout.write("\x1B[J");
    }
    lastLines = h;
    let out = "";
    for (let i = 0; i < h; i++) {
      const cur = i === selected ? `\u25C9 ${c.text(items[i].label)}` : `\u25CB ${c.text(items[i].label)}`;
      out += `${cur}
`;
    }
    stdout.write(out);
  }
  function clear() {
    stdout.write(`\x1B[${lastLines}A\x1B[J`);
  }
  render(true);
  return new Promise((resolve) => {
    const handler = (chunk) => {
      let i = 0;
      while (i < chunk.length) {
        if (chunk[i] === 27) {
          const rem = chunk.length - i - 1;
          if (rem === 0) {
            clear();
            stdin.removeListener("data", handler);
            setRaw(wasRaw);
            resolve(null);
            return;
          }
          const next = consumeEscapeSeq(chunk, i);
          if (next !== null) {
            const c2 = next - i;
            if (c2 === 3 && chunk[i + 1] === 91) {
              if (chunk[i + 2] === 65 && selected > 0) {
                selected--;
                render(false);
              }
              if (chunk[i + 2] === 66 && selected < items.length - 1) {
                selected++;
                render(false);
              }
            }
            i = next;
          } else i++;
          continue;
        }
        const byte = chunk[i];
        i++;
        if (byte === 13 || byte === 10) {
          clear();
          stdin.removeListener("data", handler);
          setRaw(wasRaw);
          resolve(items[selected]?.value ?? null);
          return;
        }
        if (byte === 3) {
          clear();
          stdin.removeListener("data", handler);
          setRaw(wasRaw);
          resolve(null);
          return;
        }
      }
    };
    stdin.on("data", handler);
  });
}
async function readLine(prompt, initial = "") {
  const wasRaw = stdin.isRaw ?? false;
  setRaw(true);
  stdin.resume();
  let line = initial;
  let suggestion = "";
  let tabState = null;
  function redraw() {
    const parsed = parseLine(line);
    const candidates = getCompletions(parsed);
    const first = candidates[0];
    suggestion = parsed.current && first && first !== parsed.current && first.startsWith(parsed.current) ? first.slice(parsed.current.length) : "";
    stdout.write("\r\x1B[K" + prompt + line);
    if (suggestion) {
      stdout.write(c.dim(suggestion));
      stdout.write("\x1B[" + suggestion.length + "D");
    }
  }
  redraw();
  currentRedraw = redraw;
  return new Promise((resolve) => {
    const handler = (chunk) => {
      let i = 0;
      while (i < chunk.length) {
        if (chunk[i] === 27) {
          const next = consumeEscapeSeq(chunk, i);
          if (next !== null) {
            const len = next - i;
            if (len === 3 && chunk[i + 1] === 91) {
              const fin = chunk[i + 2];
              if (fin === 65 && historyIdx > 0) {
                historyIdx--;
                line = history[historyIdx] ?? "";
                tabState = null;
                redraw();
              } else if (fin === 66) {
                if (historyIdx < history.length - 1) {
                  historyIdx++;
                  line = history[historyIdx] ?? "";
                  tabState = null;
                  redraw();
                } else if (historyIdx === history.length - 1) {
                  historyIdx = history.length;
                  line = "";
                  tabState = null;
                  redraw();
                }
              } else if (fin === 67 && suggestion) {
                line += suggestion;
                tabState = null;
                redraw();
              }
            }
            i = next;
          } else i++;
          continue;
        }
        const byte = chunk[i];
        i++;
        if (byte === 13 || byte === 10) {
          stdin.removeListener("data", handler);
          setRaw(wasRaw);
          stdout.write("\r\x1B[K" + prompt + line + "\r\n");
          if (line.length > 0) {
            history.push(line);
            if (history.length > 100) history.shift();
          }
          historyIdx = history.length;
          resolve(line);
          return;
        }
        if (byte === 3) {
          stdin.removeListener("data", handler);
          setRaw(wasRaw);
          if (line.length > 0) {
            line = "";
            tabState = null;
            stdout.write("\r\x1B[K" + prompt);
            continue;
          }
          stdout.write("\r\n");
          resolve(null);
          return;
        }
        if (byte === 9) {
          if (tabState && line === tabState.completedLine) {
            tabState.idx = (tabState.idx + 1) % tabState.candidates.length;
          } else {
            const parsed = parseLine(line);
            const candidates = getCompletions(parsed);
            if (candidates.length === 0) {
              tabState = null;
              redraw();
              continue;
            }
            tabState = {
              candidates,
              idx: 0,
              wordStart: line.length - parsed.current.length,
              completedLine: ""
            };
          }
          const match = tabState.candidates[tabState.idx];
          line = line.slice(0, tabState.wordStart) + match;
          tabState.completedLine = line;
          redraw();
          continue;
        }
        if (byte === 12) {
          stdin.removeListener("data", handler);
          setRaw(wasRaw);
          resolve("__CTRLL__" + line);
          return;
        }
        if (byte === 127 || byte === 8) {
          if (line.length > 0) {
            line = line.slice(0, -1);
          }
          tabState = null;
          redraw();
          continue;
        }
        if (byte >= 32 && byte <= 126) {
          line += String.fromCharCode(byte);
          tabState = null;
          redraw();
          continue;
        }
      }
    };
    stdin.on("data", handler);
  }).finally(() => {
    currentRedraw = null;
  });
}
function pushAndRender(log, filter) {
  if (filter.levels.length && !filter.levels.includes(log.level)) return;
  if (filter.sources.length && !filter.sources.includes(log.source)) return;
  stdout.write(`\r\x1B[K${wrapLogLine(formatLog(log), 26)}
`);
}
async function startRepl() {
  if (!stdin.isTTY) {
    console.log(c.dim(" Non-interactive mode (pipe detected)\n"));
    for await (const line of (await import("node:readline/promises")).createInterface({
      input: stdin,
      output: stdout,
      terminal: false
    })) {
      const t = line.trim();
      if (!t) continue;
      const p = t.split(/\s+/);
      if (["quit", "exit", "q"].includes(p[0])) break;
      if (p[0] === "init") {
        (await Promise.resolve().then(() => (init_wizard(), wizard_exports))).runWizard();
        continue;
      }
      await execCmd(p);
    }
    console.log(c.dim("stopping services..."));
    await stopAll();
    console.log(c.dim("bye"));
    return;
  }
  console.clear();
  stdout.write(welcome);
  let filter = { levels: [], sources: [] };
  const unsub = onLog((log) => pushAndRender(log, filter));
  function onResize() {
    if (!currentRedraw) return;
    const rows = process2.stdout.rows || 24;
    stdout.write("\x1B[H\x1B[2J");
    const all = getAllLogs();
    const out = [];
    let usedRows = 0;
    for (let i = all.length - 1; i >= 0; i--) {
      const log = all[i];
      if (filter.levels.length && !filter.levels.includes(log.level)) continue;
      if (filter.sources.length && !filter.sources.includes(log.source)) continue;
      const wrapped = wrapLogLine(formatLog(log), 26);
      const logRows = wrapped.split("\n").length;
      if (usedRows + logRows > rows - 2) break;
      out.unshift(wrapped);
      usedRows += logRows;
    }
    for (const l of out) stdout.write(l + "\n");
    currentRedraw();
  }
  process2.stdout.on("resize", onResize);
  let pendingInput = "";
  while (true) {
    const raw = await readLine(c.text(" \u276F "), pendingInput);
    pendingInput = "";
    if (raw === null) break;
    if (raw.startsWith("__CTRLL__")) {
      stdout.write(c.dim(`
LEVEL\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500SOURCE
`));
      const lvl = await simpleSelect([{ label: "ALL", value: "" }, ...LEVEL_ITEMS]);
      if (lvl === null) continue;
      const src = await simpleSelect([{ label: "ALL", value: "" }, ...SOURCE_ITEMS]);
      if (src === null) continue;
      filter = { levels: lvl ? [lvl] : [], sources: src ? [src] : [] };
      stdout.write(c.dim(`filter: ${lvl || "*"} / ${src || "*"}
`));
      continue;
    }
    const trimmed = raw.trim();
    if (!trimmed) continue;
    try {
      await execCmd(trimmed.split(/\s+/));
    } catch (e) {
      if (e === "QUIT") break;
      console.log(c.red(`Error: ${e.message}`));
    }
  }
  process2.stdout.off("resize", onResize);
  unsub();
  stdout.write(c.dim("stopping services...\n"));
  await stopAll();
  stdout.write(c.dim("bye\n"));
}
async function execCmd(parts) {
  const [cmd, ...args] = parts;
  switch (cmd) {
    case "help":
    case "h":
    case "?":
      stdout.write(HELP);
      break;
    case "version":
      stdout.write(`sfmc v${process2.env["npm_package_version"] || "0.1.0"}
`);
      break;
    case "status":
      stdout.write(cmdStatus() + "\n");
      break;
    case "logs":
    case "log": {
      const out = cmdLogs(args, (svc) => {
        if (!stdin.isTTY) {
          stdout.write(c.yellow("follow mode requires TTY\n"));
          return;
        }
      });
      if (out) stdout.write(out + "\n");
      break;
    }
    case "start":
      if (args[0] === "-all" || args[0] === "all" || args[0] === "--all") stdout.write(await cmdStartAll() + "\n");
      else if (args[0]) stdout.write(await cmdStart(args[0]) + "\n");
      else stdout.write(c.yellow("Usage: start <service>|-all\n"));
      break;
    case "stop":
      if (args[0] === "-all" || args[0] === "all" || args[0] === "--all") stdout.write(await cmdStopAll() + "\n");
      else if (args[0]) stdout.write(await cmdStop(args[0]) + "\n");
      else stdout.write(c.yellow("Usage: stop <service>|-all\n"));
      break;
    case "restart":
      if (args[0] === "-all" || args[0] === "all" || args[0] === "--all") {
        await cmdStopAll();
        stdout.write(await cmdStartAll() + "\n");
      } else if (args[0]) stdout.write(await cmdRestart(args[0]) + "\n");
      else stdout.write(c.yellow("Usage: restart <service>|-all\n"));
      break;
    case "send": {
      const svc = args[0];
      const msg = args.slice(1).join(" ");
      if (!svc || !msg) {
        stdout.write(c.yellow("Usage: send <service> <message>\n"));
        break;
      }
      const s = services[svc];
      if (!s.running) {
        stdout.write(c.yellow(`${s.title} not running
`));
        break;
      }
      try {
        s.proc?.stdin?.write(msg + "\n");
        stdout.write(c.dim(`sent to ${svc}
`));
      } catch {
        stdout.write(c.red("write failed\n"));
      }
      break;
    }
    case "init": {
      const { runWizard: runWizard2 } = await Promise.resolve().then(() => (init_wizard(), wizard_exports));
      await runWizard2();
      break;
    }
    case "update":
      await cmdUpdate(args);
      break;
    case "quit":
    case "exit":
    case "q":
      throw "QUIT";
    default:
      stdout.write(c.yellow(`Unknown: ${cmd}  (try: help)
`));
  }
}
var welcome, HELP, COMMANDS, history, historyIdx, currentRedraw, LEVEL_ITEMS, SOURCE_ITEMS;
var init_repl = __esm({
  "src/repl.ts"() {
    "use strict";
    init_package();
    init_commands();
    init_logs();
    init_services();
    init_theme();
    welcome = `

  ${c.text(`\u282A\u2841\u286F\u2801`)}
  ${c.text(`\u2812\u2801\u2803`)}${c.purple(`\u2804`)}
  ${c.text(`\u2877\u2847\u284E\u2801`)}      ${c.text(`S`)}${c.dim(`cripts`)} ${c.text(`F`)}${c.dim(`or`)} ${c.text(`M`)}${c.dim(`ine`)}${c.text(`c`)}${c.dim(`raft Server`)} v${package_default.version}
  ${c.text(`\u2803\u2803\u2811\u2802`)}      ${c.dim(`help \xB7 Ctrl+L \xB7 \u21B9 \xB7 \u2192 \xB7 \u2191\u2193`)}

`;
    HELP = `
${c.bold("Commands")}
  ${c.green("status")}                    Show all services status
  ${c.green("logs")} <svc> [-n N] [-f]    View / follow service logs
  ${c.green("start")} <svc>|-all          Start (or all)
  ${c.green("stop")} <svc>|-all           Stop (or all)
  ${c.green("restart")} <svc>|-all        Restart (or all)
  ${c.green("send")} <svc> <msg>          Send command to a service's stdin
  ${c.green("init")}                      Setup wizard
  ${c.green("update")} [--check-only] [--channel=release|preview]
                          Check/apply BDS update
  ${c.green("version")}                   Show version
  ${c.green("help")}                      Show this
  ${c.green("quit")} / ${c.green("exit")} Exit

${c.dim("Shortcuts:")}
  ${c.dim("Tab")}      Complete (cycle on repeat)
  ${c.dim("\u2192")}        Accept gray suggestion
  ${c.dim("Ctrl+L")}   Filter log level / source
  ${c.dim("\u2191\u2193")}       History
`;
    COMMANDS = [
      "status",
      "logs",
      "start",
      "stop",
      "restart",
      "send",
      "init",
      "update",
      "version",
      "help",
      "quit",
      "exit"
    ];
    history = [];
    historyIdx = -1;
    currentRedraw = null;
    LEVEL_ITEMS = [
      { label: c.blue("INFO"), value: "info" },
      { label: c.yellow("WARN"), value: "warn" },
      { label: c.red("ERROR"), value: "error" },
      { label: c.dim("DEBUG"), value: "debug" },
      { label: c.green("SUCCESS"), value: "success" }
    ];
    SOURCE_ITEMS = [
      { label: c.green("BDServer"), value: "bds" },
      { label: c.blue("DataBase"), value: "db" },
      { label: c.purple("QQBridge"), value: "qq" },
      { label: c.yellow(" LL-BOT "), value: "llbot" },
      { label: c.cyan(" SYSTEM "), value: "system" }
    ];
  }
});

// src/logs.ts
function pushLog(text2, source, level) {
  buffer.pushDirect(text2, source, level);
}
function onLog(fn) {
  return buffer.subscribe(fn);
}
function getAllLogs() {
  return buffer.getAll();
}
function inferLevel2(text2) {
  return inferLevel(text2);
}
function stripLogPrefix(line) {
  const prefixRegex = /^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}:\d{3} (INFO|WARNING|ERROR|FATAL|DEBUG)\]\s*/;
  return line.replace(prefixRegex, "");
}
function getLogLevel(line) {
  const levelNames = ["INFO", "WARNING", "ERROR", "FATAL", "DEBUG", "TRACE", "WARN"];
  const levelPattern = levelNames.join("|");
  let match = line.match(new RegExp(`\\[(${levelPattern})\\]`, "i"));
  if (match) return match[1].toUpperCase();
  match = line.match(new RegExp(`^\\[.*?\\]\\s*(${levelPattern})`, "i"));
  if (match) return match[1].toUpperCase();
  match = line.match(new RegExp(`^(${levelPattern})\\s*:`, "i"));
  if (match) return match[1].toUpperCase();
  match = line.match(new RegExp(`\\[.*?\\]\\s*(${levelPattern})\\s*:`, "i"));
  if (match) return match[1].toUpperCase();
  return "UNKNOWN";
}
function formatLog(l) {
  let src = c.bold(padSource(l.source));
  let ts = c.dim(l.time.toLocaleTimeString());
  let lvl = levelTag(l.level);
  let txt = highlightText(l.text);
  for (let _src of SOURCE_ITEMS) {
    if (_src["value"] === l.source) src = `[${_src["label"]}]`;
    continue;
  }
  if (l.source === "bds") {
    lvl = getLogLevel(l.text);
    switch (lvl) {
      case "INFO":
        lvl = "info";
        break;
      case "WARNING":
        lvl = "warn";
        break;
      case "ERROR":
        lvl = "error";
        break;
      case "DEBUG":
        lvl = "debug";
        break;
      default:
        lvl = "info";
        break;
    }
    txt = stripLogPrefix(l.text);
    lvl = levelTag(l.level);
  }
  return `${ts} ${src} ${lvl} ${txt}`;
}
function padSource(s) {
  return s.padEnd(7);
}
function levelTag(lvl) {
  switch (lvl) {
    case "error":
      return c.red("[ERR]");
    case "warn":
      return c.yellow("[WRN]");
    case "success":
      return c.green(c.bold("[OK]"));
    case "debug":
      return c.dim("[DBG]");
    default:
      return c.blue("[INF]");
  }
}
function highlightText(raw) {
  let s = raw;
  s = s.replace(/§[0-9a-fklmnor]/g, "");
  s = s.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?\b/g, (m) => c.cyan(m));
  s = s.replace(/\b(TPS|MSPT|tick|loaded|saved)\b/gi, (m) => c.cyan(m));
  return s;
}
function charWidth(ch) {
  const c2 = ch.codePointAt(0) ?? 0;
  if (c2 >= 4352 && (c2 <= 4447 || c2 >= 11904 && c2 <= 42191 && c2 !== 12351 || c2 >= 44032 && c2 <= 55203 || c2 >= 63744 && c2 <= 64255 || c2 >= 65072 && c2 <= 65103 || c2 >= 65280 && c2 <= 65376 || c2 >= 65504 && c2 <= 65510 || c2 >= 131072 && c2 <= 196605))
    return 2;
  return 1;
}
function visibleWidth(s) {
  const stripped = s.replace(/\x1b\[[0-9;]*m/g, "");
  let w = 0;
  for (const ch of stripped) w += charWidth(ch);
  return w;
}
function wrapLogLine(s, indent) {
  const cols = process.stdout.columns || 80;
  if (visibleWidth(s) <= cols) return s;
  const lines = [];
  let cur = "";
  let w = 0;
  let limit = cols;
  let activeAnsi = "";
  let i = 0;
  while (i < s.length) {
    const m = /^\x1b\[[0-9;]*m/.exec(s.slice(i));
    if (m) {
      const code = m[0];
      cur += code;
      if (code === "\x1B[0m") activeAnsi = "";
      else activeAnsi = code;
      i += code.length;
    } else {
      const ch = s[i];
      const cw = charWidth(ch);
      if (w + cw > limit) {
        if (activeAnsi) cur += "\x1B[0m";
        lines.push(cur);
        cur = " ".repeat(indent);
        if (activeAnsi) cur += activeAnsi;
        w = 0;
        limit = cols - indent;
      }
      cur += ch;
      w += cw;
      i++;
    }
  }
  if (activeAnsi) cur += "\x1B[0m";
  lines.push(cur);
  return lines.join("\n");
}
var buffer;
var init_logs = __esm({
  "src/logs.ts"() {
    "use strict";
    init_esm();
    init_repl();
    init_theme();
    buffer = createMemoryBuffer(5e3);
  }
});

// src/services.ts
var services_exports = {};
__export(services_exports, {
  ROOT: () => ROOT,
  SERVICE_NAMES: () => SERVICE_NAMES,
  START_ORDER: () => START_ORDER,
  services: () => services,
  startAll: () => startAll,
  stopAll: () => stopAll
});
import { spawn as spawn2 } from "node:child_process";
import path2 from "node:path";
import fs2 from "node:fs";
import { fileURLToPath } from "node:url";
import { EventEmitter } from "node:events";
function loadJson(file) {
  try {
    const p = path2.join(ROOT, "configs", file);
    return JSON.parse(fs2.readFileSync(p, "utf-8"));
  } catch {
    return {};
  }
}
async function startAll() {
  for (const name of START_ORDER) {
    const svc = services[name];
    if (!svc) continue;
    try {
      await svc.start();
    } catch (e) {
      svc.events.emit("output", `start error: ${e.message}`, "error");
    }
  }
}
async function stopAll() {
  for (const name of [...START_ORDER].reverse()) {
    const svc = services[name];
    if (!svc?.running) continue;
    try {
      await svc.stop();
    } catch {
    }
  }
}
var __dirname, ROOT, SERVICE_NAMES, Service, bdsCfg, qqCfg, dbCfg, bdsPath, llbotEnabled, llbotPath, llbotCwd, dbPort, BDS_EXE, services, START_ORDER;
var init_services = __esm({
  "src/services.ts"() {
    "use strict";
    init_logs();
    __dirname = path2.dirname(fileURLToPath(import.meta.url));
    ROOT = path2.resolve(__dirname, "..", "..");
    SERVICE_NAMES = ["bds", "db", "qq", "llbot"];
    Service = class {
      name;
      title;
      proc = null;
      running = false;
      pid = 0;
      startTime = null;
      logs = [];
      events = new EventEmitter();
      def;
      manualStop = false;
      constructor(def) {
        this.name = def.name;
        this.title = def.title;
        this.def = def;
      }
      get uptime() {
        if (!this.startTime || !this.running) return "\u2014";
        const ms = Date.now() - this.startTime.getTime();
        const m = Math.floor(ms / 6e4);
        const h = Math.floor(m / 60);
        if (h > 0) return `${h}h ${m % 60}m`;
        if (m > 0) return `${m}m`;
        return `${Math.floor(ms / 1e3)}s`;
      }
      pushLog(text2, stream) {
        const line = { time: /* @__PURE__ */ new Date(), text: text2, stream };
        this.logs.push(line);
        if (this.logs.length > 2e3) this.logs.splice(0, this.logs.length - 2e3);
        this.events.emit("log", line);
        const level = stream === "stderr" ? "error" : inferLevel2(text2);
        pushLog(text2, this.name, level);
      }
      async start() {
        if (this.running) return;
        if (this.def.validate) {
          const v = this.def.validate();
          if (v) throw new Error(v);
        }
        this.manualStop = false;
        const child = spawn2(this.def.cmd, this.def.args, {
          cwd: this.def.cwd,
          stdio: ["pipe", "pipe", "pipe"],
          env: this.def.env ? { ...process.env, ...this.def.env } : process.env
        });
        child.unref();
        this.proc = child;
        this.pid = child.pid ?? 0;
        this.running = true;
        this.startTime = /* @__PURE__ */ new Date();
        this.events.emit("output", `started (PID ${this.pid})`, "info");
        child.on("error", (e) => {
          this.events.emit("output", `process error: ${e.message}`, "error");
          this.cleanup();
        });
        child.stdout?.on("data", (d) => {
          for (const line of d.toString().split("\n").filter(Boolean)) {
            this.pushLog(line, "stdout");
          }
        });
        child.stderr?.on("data", (d) => {
          for (const line of d.toString().split("\n").filter(Boolean)) {
            this.pushLog(line, "stderr");
          }
        });
        child.on("exit", (code) => {
          this.events.emit("output", `exited (code: ${code})`, "info");
          this.cleanup();
          if (!this.manualStop && this.def.autoRestart) {
            setTimeout(() => {
              void this.start();
            }, this.def.restartDelay);
          }
        });
      }
      async stop() {
        if (!this.proc || !this.running) return;
        this.manualStop = true;
        this.events.emit("output", "stopping...", "info");
        if (this.def.stopCommand && this.proc.stdin) {
          this.proc.stdin.write(this.def.stopCommand + "\n");
        } else {
          this.proc.kill("SIGTERM");
        }
        return new Promise((resolve) => {
          const timeout = setTimeout(() => {
            if (this.proc) {
              this.events.emit("output", "force kill", "error");
              try {
                this.proc.kill("SIGKILL");
              } catch {
              }
            }
            resolve();
          }, this.def.stopTimeout);
          this.proc?.on("exit", () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      }
      async restart() {
        await this.stop();
        await this.start();
      }
      getRecentLogs(n) {
        return this.logs.slice(-n);
      }
      cleanup() {
        this.proc = null;
        this.running = false;
        this.pid = 0;
      }
    };
    bdsCfg = loadJson("bds_updater.json");
    qqCfg = loadJson("qq_config.json");
    dbCfg = loadJson("db_config.json");
    bdsPath = bdsCfg.bds_path ?? path2.join(ROOT);
    llbotEnabled = qqCfg.llbot_enabled !== false;
    llbotPath = qqCfg.llbot_path ?? "D:\\LLBot-CLI-win-x64\\llbot.exe";
    llbotCwd = qqCfg.llbot_cwd ?? "D:\\LLBot-CLI-win-x64";
    dbPort = dbCfg.db_port ?? 3001;
    BDS_EXE = path2.resolve(bdsPath, "bedrock_server.exe");
    services = {
      bds: new Service({
        name: "bds",
        title: "BDS",
        cmd: BDS_EXE,
        args: [],
        cwd: bdsPath,
        stopCommand: "stop",
        stopTimeout: 3e4,
        autoRestart: bdsCfg.crash_restart !== false,
        restartDelay: 5e3,
        validate: () => {
          if (!fs2.existsSync(BDS_EXE)) return `not found: ${BDS_EXE}`;
          return null;
        }
      }),
      db: new Service({
        name: "db",
        title: "DB Server",
        cmd: process.execPath,
        args: ["db-server/dist/index.js"],
        cwd: ROOT,
        stopTimeout: 1e4,
        autoRestart: true,
        restartDelay: 3e3,
        env: { DB_PORT: String(dbPort) }
      }),
      qq: new Service({
        name: "qq",
        title: "QQ Bridge",
        cmd: process.execPath,
        args: ["qq-bridge/dist/index.js"],
        cwd: ROOT,
        stopTimeout: 1e4,
        autoRestart: true,
        restartDelay: 3e3
      }),
      llbot: new Service({
        name: "llbot",
        title: "LLBot",
        cmd: llbotPath,
        args: [],
        cwd: llbotCwd,
        stopTimeout: 1e4,
        autoRestart: false,
        restartDelay: 5e3,
        validate: () => {
          if (!llbotEnabled) return "LLBot disabled (llbot_enabled=false)";
          if (!fs2.existsSync(llbotPath)) return `not found: ${llbotPath}`;
          return null;
        }
      })
    };
    START_ORDER = ["db", "qq", "llbot", "bds"];
  }
});

// src/commands.ts
import { spawn as spawn3 } from "node:child_process";
import process3 from "node:process";
function parseService(raw) {
  const s = raw.toLowerCase();
  if (SERVICE_NAMES.includes(s)) return s;
  return null;
}
function statusLine(name, running, pid, uptime) {
  const dot = running ? c.green("\u25CF") : c.dim("\u25CB");
  const status = running ? c.green("Running") : c.dim("Stopped");
  const pidStr = pid ? c.dim(String(pid)) : c.dim("\u2014");
  const upStr = uptime !== "\u2014" ? c.dim(uptime) : c.dim("\u2014");
  return `  ${dot} ${c.bold(name.padEnd(9))} ${status.padEnd(10)} ${pidStr.padEnd(8)} ${upStr}`;
}
function cmdStatus() {
  const lines = SERVICE_NAMES.map((name) => {
    const s = services[name];
    return statusLine(s.title, s.running, s.pid, s.uptime);
  });
  return `
${c.bold("Services")}
` + c.dim(`  Name${" ".repeat(7)}Status${" ".repeat(4)}PID${" ".repeat(4)}Uptime
`) + DIVIDER + "\n" + lines.join("\n") + "\n";
}
function cmdLogs(args, onFollow) {
  let n = 20;
  let follow = false;
  const positional = [];
  for (const a of args) {
    if (a === "-n") continue;
    if (a === "-f") {
      follow = true;
      continue;
    }
    positional.push(a);
  }
  const nIdx = args.indexOf("-n");
  if (nIdx >= 0 && nIdx + 1 < args.length) n = parseInt(args[nIdx + 1], 10);
  const svcRaw = positional[0];
  if (!svcRaw) return c.yellow("Usage: logs <service> [-n N] [-f]");
  const svc = parseService(svcRaw);
  if (!svc) return c.red(`Unknown service: ${svcRaw} (try: ${SERVICE_NAMES.join(", ")})`);
  const svcObj = services[svc];
  const lines = svcObj.getRecentLogs(n);
  if (lines.length === 0) return c.dim("(no logs yet)");
  const header = `
${c.bold(svcObj.title)} logs (last ${lines.length}):`;
  const body = lines.map((l) => {
    const ts = c.dim(l.time.toLocaleTimeString());
    const text2 = highlightLogLine(l.text);
    const prefix = l.stream === "stderr" ? c.red("!") : c.dim(" ");
    return `${ts} ${prefix} ${text2}`;
  }).join("\n");
  const result = header + "\n" + DIVIDER + "\n" + body + "\n";
  if (follow && onFollow) {
    onFollow(svc);
    return "";
  }
  return result;
}
async function cmdStart(raw) {
  const svc = parseService(raw);
  if (!svc) return c.red(`Unknown service: ${raw} (try: ${SERVICE_NAMES.join(", ")})`);
  const svcObj = services[svc];
  if (svcObj.running) return c.yellow(`${svcObj.title} already running (PID ${svcObj.pid})`);
  if (STARTING.has(svc)) return c.dim(`${svcObj.title} already starting...`);
  STARTING.add(svc);
  try {
    await svcObj.start();
    return c.green(`${svcObj.title} started`);
  } catch (e) {
    return c.red(`${svcObj.title} failed: ${e.message}`);
  } finally {
    STARTING.delete(svc);
  }
}
async function cmdStop(raw) {
  const svc = parseService(raw);
  if (!svc) return c.red(`Unknown service: ${raw} (try: ${SERVICE_NAMES.join(", ")})`);
  const svcObj = services[svc];
  if (!svcObj.running) return c.yellow(`${svcObj.title} already stopped`);
  if (STOPPING.has(svc)) return c.dim(`${svcObj.title} already stopping...`);
  STOPPING.add(svc);
  try {
    await svcObj.stop();
    return c.dim(`${svcObj.title} stopped`);
  } catch (e) {
    return c.red(`${svcObj.title} stop failed: ${e.message}`);
  } finally {
    STOPPING.delete(svc);
  }
}
async function cmdRestart(raw) {
  const svc = parseService(raw);
  if (!svc) return c.red(`Unknown service: ${raw} (try: ${SERVICE_NAMES.join(", ")})`);
  const svcObj = services[svc];
  try {
    await svcObj.restart();
    return c.green(`${svcObj.title} restarted`);
  } catch (e) {
    return c.red(`${svcObj.title} restart failed: ${e.message}`);
  }
}
async function cmdStartAll() {
  const { startAll: startAll2 } = await Promise.resolve().then(() => (init_services(), services_exports));
  await startAll2();
  return c.green("All services started");
}
async function cmdStopAll() {
  const { stopAll: stopAll2 } = await Promise.resolve().then(() => (init_services(), services_exports));
  await stopAll2();
  return c.dim("All services stopped");
}
async function cmdUpdate(args = []) {
  return new Promise((resolve) => {
    const proc = spawn3(process3.execPath, ["bds-tools/dist/check-update.js", ...args], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let out = "";
    proc.stdout?.on("data", (d) => {
      const s = d.toString();
      out += s;
      for (const line of s.split("\n").filter(Boolean)) pushLog(line, "system", "info");
    });
    proc.stderr?.on("data", (d) => {
      const s = d.toString();
      out += s;
      for (const line of s.split("\n").filter(Boolean)) pushLog(line, "system", "error");
    });
    proc.on("exit", (code) => {
      if (code === 0) {
        pushLog("update complete", "system", "success");
        resolve((out ? out + "\n" : "") + "update complete");
      } else {
        resolve(out || `update exited with code ${code}`);
      }
    });
    proc.on("error", (e) => {
      pushLog(`update error: ${e.message}`, "system", "error");
      resolve(`update error: ${e.message}`);
    });
  });
}
var STARTING, STOPPING;
var init_commands = __esm({
  "src/commands.ts"() {
    "use strict";
    init_services();
    init_theme();
    init_logs();
    STARTING = /* @__PURE__ */ new Set();
    STOPPING = /* @__PURE__ */ new Set();
  }
});

// src/main.ts
init_package();
init_commands();
init_repl();
init_theme();
import process4 from "node:process";
function printVersion() {
  `${c.text(`\u282A\u2841\u286F\u2801`)}
  ${c.text(`\u2812\u2801\u2803`)}${c.purple(`\u2804`)}
  ${c.text(`\u2877\u2847\u284E\u2801`)}      ${c.text(`S`)}${c.dim(`cripts`)} ${c.text(`F`)}${c.dim(`or`)} ${c.text(`M`)}${c.dim(`ine`)}${c.text(`c`)}${c.dim(`raft Server`)} v${package_default.version}
  ${c.text(`\u2803\u2803\u2811\u2802`)}      ${c.dim(`https://github.com/DogeLakeDev/ScriptsForMinecraftServer`)}
`;
}
function printUsage() {
  console.log(`${HELP}`);
}
async function main() {
  const args = process4.argv.slice(2);
  if (args.length === 0) {
    await startRepl();
    return;
  }
  const [cmd, ...rest] = args;
  switch (cmd) {
    case "--help":
    case "-h":
    case "help":
      printUsage();
      break;
    case "--version":
    case "-v":
      printVersion();
      break;
    case "status":
      console.log(cmdStatus());
      break;
    case "logs":
    case "log": {
      const out = cmdLogs(rest);
      if (out) console.log(out);
      break;
    }
    case "start":
      if (rest[0] === "-all" || rest[0] === "all" || rest[0] === "--all") {
        console.log(await cmdStartAll());
      } else if (rest[0]) {
        console.log(await cmdStart(rest[0]));
      } else {
        console.log(c.yellow("Usage: sfmc start <service>|-all"));
      }
      break;
    case "stop":
      if (rest[0] === "-all" || rest[0] === "all" || rest[0] === "--all") {
        console.log(await cmdStopAll());
      } else if (rest[0]) {
        console.log(await cmdStop(rest[0]));
      } else {
        console.log(c.yellow("Usage: sfmc stop <service>|-all"));
      }
      break;
    case "restart":
      if (rest[0] === "-all" || rest[0] === "all" || rest[0] === "--all") {
        await cmdStopAll();
        console.log(await cmdStartAll());
      } else if (rest[0]) {
        console.log(await cmdRestart(rest[0]));
      } else {
        console.log(c.yellow("Usage: sfmc restart <service>|-all"));
      }
      break;
    case "update":
      console.log(await cmdUpdate(rest));
      break;
    case "init": {
      const { runWizard: runWizard2 } = await Promise.resolve().then(() => (init_wizard(), wizard_exports));
      await runWizard2();
      break;
    }
    default:
      console.log(c.red(`Unknown command: ${cmd}`));
      printUsage();
      process4.exit(1);
  }
  process4.exit(0);
}
main().catch((err) => {
  console.error(c.red(err?.message ? `Error: ${err.message}` : "Fatal"));
  process4.exit(1);
});
