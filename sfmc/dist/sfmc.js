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

// src/services.ts
var services_exports = {};
__export(services_exports, {
  ROOT: () => ROOT,
  START_ORDER: () => START_ORDER,
  services: () => services,
  startAll: () => startAll,
  stopAll: () => stopAll
});
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { EventEmitter } from "node:events";
function loadJson(file) {
  try {
    const p = path.join(ROOT, "configs", file);
    return JSON.parse(fs.readFileSync(p, "utf-8"));
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
var __dirname, ROOT, Service, bdsCfg, qqCfg, dbCfg, bdsPath, llbotEnabled, llbotPath, llbotCwd, dbPort, BDS_EXE, services, START_ORDER;
var init_services = __esm({
  "src/services.ts"() {
    "use strict";
    __dirname = path.dirname(fileURLToPath(import.meta.url));
    ROOT = path.resolve(__dirname, "..", "..");
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
      }
      async start() {
        if (this.running) return;
        if (this.def.validate) {
          const v = this.def.validate();
          if (v) throw new Error(v);
        }
        this.manualStop = false;
        const child = spawn(this.def.cmd, this.def.args, {
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
    bdsPath = bdsCfg.bds_path ?? path.join(ROOT);
    llbotEnabled = qqCfg.llbot_enabled !== false;
    llbotPath = qqCfg.llbot_path ?? "D:\\LLBot-CLI-win-x64\\llbot.exe";
    llbotCwd = qqCfg.llbot_cwd ?? "D:\\LLBot-CLI-win-x64";
    dbPort = dbCfg.db_port ?? 3001;
    BDS_EXE = path.resolve(bdsPath, "bedrock_server.exe");
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
          if (!fs.existsSync(BDS_EXE)) return `not found: ${BDS_EXE}`;
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
          if (!fs.existsSync(llbotPath)) return `not found: ${llbotPath}`;
          return null;
        }
      })
    };
    START_ORDER = ["db", "qq", "llbot", "bds"];
  }
});

// src/theme.ts
import chalk from "chalk";
function highlightLogLine(raw) {
  return raw.replace(/§[0-9a-fklmnor]/g, "").replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, (m) => c.dim(m)).replace(/\[ERROR\]/g, (m) => c.red(m)).replace(/\[FATAL\]/g, (m) => c.red(c.bold(m))).replace(/\[WARN(ING)?\]/g, (m) => c.yellow(m)).replace(/\[SUCCESS\]/g, (m) => c.green(c.bold(m))).replace(/\[INFO\]/g, (m) => c.blue(m)).replace(/\[DEBUG\]/g, (m) => c.dim(m)).replace(/\[PLAYER\]/g, (m) => c.green(m)).replace(/\[TPS\]/g, (m) => c.cyan(m)).replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?\b/g, (m) => c.cyan(m)).replace(/Player (joined|left):/g, (m) => c.green(m)).replace(/Server (started|stopped)/g, (m) => c.green(m)).replace(/\b(TPS|MSPT|tick|loaded|saved)\b/gi, (m) => c.cyan(m));
}
function boxHeader(label, dots) {
  const top = c.dim("\u256D\u2500 ") + c.bold(label) + c.dim(" \u2500" + "\u2500".repeat(W - 6 - label.length) + "\u256E");
  const inner = c.dim("\u2502") + "  " + dots + " ".repeat(W - 3 - visibleLen(dots)) + c.dim("\u2502");
  const bot = c.dim("\u2570" + "\u2500".repeat(W - 2) + "\u256F");
  return `
${top}
${inner}
${bot}
`;
}
function visibleLen(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, "").length;
}
function padRight(s, n) {
  return s + " ".repeat(Math.max(0, n - visibleLen(s)));
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
      text: "#abb2bf",
      muted: "#5c6370",
      subtle: "#4b5263",
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
import { intro, outro, note, spinner, confirm, select, text, isCancel } from "@clack/prompts";
import fs2 from "node:fs";
import path2 from "node:path";
import { execSync, spawn as spawn2 } from "node:child_process";
function cfg(name) {
  return path2.join(ROOT, "configs", name);
}
function read(file) {
  try {
    return JSON.parse(fs2.readFileSync(cfg(file), "utf-8"));
  } catch {
    return {};
  }
}
function write(file, data) {
  fs2.mkdirSync(path2.dirname(cfg(file)), { recursive: true });
  fs2.writeFileSync(cfg(file), JSON.stringify(data, null, 2), "utf-8");
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
  const hasConfigs = fs2.existsSync(cfg("db_config.json"));
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
      return p ? fs2.existsSync(path2.join(p, "bedrock_server.exe")) : false;
    } catch {
      return false;
    }
  })();
  const hasDefaults = fs2.existsSync(path2.join(ROOT, "configs-default", "db_config.json"));
  s.stop(bdsExists ? "BDS found" : "BDS not found");
  note(c.dim(`Root: ${ROOT}`), "Environment");
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
        llbot_port: "3004",
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
        fs2.cpSync(path2.join(ROOT, "configs-default", "."), cfg("."), { recursive: true, force: false });
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
      execSync(`node BDSTools/check-update.js --channel=${bdsChannel} --force`, { cwd: ROOT, stdio: "pipe", timeout: 3e5 });
      s.stop(c.green("BDS downloaded"));
    } catch (e) {
      const err = e;
      s.stop(c.red("Download failed"));
      console.log(c.red(err.stderr?.toString() || err.message || "unknown error"));
    }
  }
  s.start("Initializing DB");
  try {
    const child = spawn2(process.execPath, ["db-server/dist/index.js"], { cwd: ROOT, stdio: "ignore", env: { ...process.env, DB_PORT: String(dbPort2) } });
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
    init_theme();
    init_services();
  }
});

// src/main.ts
import process2 from "node:process";

// src/commands.ts
init_services();
init_theme();
var SERVICE_NAMES = ["bds", "db", "qq", "llbot"];
var HELP = `
${c.bold("Commands")}
  ${c.green("status")}              Show all services status
  ${c.green("logs")} <service>      View service logs
    ${c.dim("  -n <num>  lines (default 20)")}
    ${c.dim("  -f        follow mode (Ctrl+C to stop)")}
  ${c.green("follow")} <service>    Enter service console (logs + send commands)
  ${c.green("start")} <service>     Start a service
  ${c.green("stop")} <service>      Stop a service
  ${c.green("restart")} <service>   Restart a service
  ${c.green("start-all")}           Start all services (db\u2192qq\u2192llbot\u2192bds)
  ${c.green("stop-all")}            Stop all services
  ${c.green("init")}                Run setup wizard
  ${c.green("update")}              Check/apply BDS update
  ${c.green("version")}             Show version
  ${c.green("help")}                Show this help
  ${c.green("quit")} / ${c.green("exit")}  Exit

${c.dim("Tip: Tab completes commands & service names")}
`;
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
  const argsCopy = [...args];
  const svcRaw = argsCopy.shift();
  if (!svcRaw) return c.yellow("Usage: logs <service> [-n N] [-f]");
  const svc = parseService(svcRaw);
  if (!svc) return c.red(`Unknown service: ${svcRaw} (try: ${SERVICE_NAMES.join(", ")})`);
  const svcObj = services[svc];
  let n = 20;
  let follow = false;
  while (argsCopy.length > 0) {
    const opt = argsCopy.shift();
    if (opt === "-n") {
      n = parseInt(argsCopy.shift() ?? "20", 10);
    } else if (opt === "-f") {
      follow = true;
    }
  }
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
var STARTING = /* @__PURE__ */ new Set();
var STOPPING = /* @__PURE__ */ new Set();
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
async function cmdUpdate() {
  const { execSync: execSync2 } = await import("node:child_process");
  const { ROOT: ROOT2 } = await Promise.resolve().then(() => (init_services(), services_exports));
  try {
    const result = execSync2(`node bds-tools/dist/check-update.js`, {
      cwd: ROOT2,
      encoding: "utf-8",
      timeout: 12e4
    });
    return c.green(result.toString());
  } catch (e) {
    const err = e;
    return c.red(err.stderr?.toString() || err.stdout?.toString() || err.message || "update failed");
  }
}

// src/repl.ts
init_theme();
import { stdin, stdout } from "node:process";
init_services();
var SERVICE_NAMES2 = ["bds", "db", "qq", "llbot"];
function setRaw(v) {
  try {
    if (stdin.isTTY && typeof stdin.setRawMode === "function") stdin.setRawMode(v);
  } catch {
  }
}
var HELP2 = `
${c.bold("Commands")}
  ${c.green("status")}              Show all services status
  ${c.green("logs")} <svc>          View service logs
  ${c.green("start")} <svc>         Start a service
  ${c.green("stop")} <svc>          Stop a service
  ${c.green("restart")} <svc>       Restart a service
  ${c.green("follow")} <svc>        Enter service console (logs + stdin)
  ${c.green("start-all")}           Start all services
  ${c.green("stop-all")}            Stop all services
  ${c.green("init")}                Run setup wizard
  ${c.green("update")}              Check/apply BDS update
  ${c.green("version")}             Show version
  ${c.green("help")}                Show this help
  ${c.green("quit")} / ${c.green("exit")}  Exit

${c.dim("Shortcuts:")}
  ${c.dim("Ctrl+P")}   Quick service console switcher
  ${c.dim("Alt+P")}    Command palette
  ${c.dim("Tab")}      Complete commands & arguments
  ${c.dim("\u2191\u2193")}       History navigation
`;
function getServiceDots() {
  return SERVICE_NAMES2.map((n) => {
    const s = services[n];
    const dot = s.running ? c.green("\u25CF") : c.dim("\u25CB");
    return `${dot}${c.bold(s.title)}`;
  }).join(" ");
}
function printHeader() {
  console.log(boxHeader("sfmc", getServiceDots()));
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
async function popupSelect(items, title, filterHint = "") {
  const wasRaw = stdin.isRaw ?? false;
  setRaw(true);
  stdin.resume();
  let filtered = items;
  let selected = 0;
  let filter = filterHint;
  let lastLines = 0;
  function popHeight() {
    return Math.min(filtered.length, 8);
  }
  function popTotalLines() {
    const h = popHeight();
    let lines = 4 + h;
    if (filtered.length > h) lines += 1;
    return lines;
  }
  function render(first = false) {
    const lines = popTotalLines();
    const h = popHeight();
    if (!first) {
      stdout.write(`\x1B[${lastLines}A\x1B[J`);
    } else {
      stdout.write("\x1B[J");
    }
    lastLines = lines;
    let out = `\r${c.dim("\u256D\u2500 ")}${c.bold(title)}${c.dim(` \u2500${"\u2500".repeat(40)}\u256E`)}
`;
    out += `${c.dim("\u2502")} ${c.dim("search:")} ${filter}${" ".repeat(Math.max(0, 22 - filter.length))}${c.dim("\u2502")}
`;
    out += c.dim(`\u251C\u2500${"\u2500".repeat(42)}\u2524`) + "\n";
    for (let i = 0; i < h; i++) {
      const item = filtered[i];
      if (!item) break;
      const cursor = i === selected ? c.cyan("\u25B6") : " ";
      const style = i === selected ? c.bold : (s) => s;
      out += `${c.dim("\u2502")} ${cursor} ${style(padRight(item.label, 38))} ${c.dim("\u2502")}
`;
    }
    if (filtered.length > h) {
      out += `${c.dim("\u2502")}  ${c.dim(`\u2026 ${filtered.length - h} more`)}${" ".repeat(28)}${c.dim("\u2502")}
`;
    }
    out += c.dim("\u2570" + "\u2500".repeat(44) + "\u256F");
    stdout.write(out);
  }
  function clearPop() {
    if (lastLines > 0) {
      stdout.write(`\x1B[${lastLines}A\x1B[J`);
    }
  }
  render(true);
  const result = await new Promise((resolve) => {
    const handler = (chunk) => {
      let i = 0;
      while (i < chunk.length) {
        if (chunk[i] === 27) {
          const rem = chunk.length - i - 1;
          if (rem === 0) {
            clearPop();
            stdin.removeListener("data", handler);
            setRaw(wasRaw);
            resolve(null);
            return;
          }
          const next = consumeEscapeSeq(chunk, i);
          if (next !== null) i = next;
          else i++;
          continue;
        }
        const byte = chunk[i];
        i++;
        if (byte === 13 || byte === 10) {
          clearPop();
          stdin.removeListener("data", handler);
          setRaw(wasRaw);
          resolve(filtered[selected]?.value ?? null);
          return;
        }
        if (byte === 3) {
          clearPop();
          stdin.removeListener("data", handler);
          setRaw(wasRaw);
          resolve(null);
          return;
        }
        if (byte === 127 || byte === 8) {
          if (filter.length > 0) {
            filter = filter.slice(0, -1);
            filtered = items.filter((i2) => i2.label.toLowerCase().includes(filter.toLowerCase()));
            selected = 0;
            render();
          }
          continue;
        }
        if (byte >= 32 && byte <= 126) {
          filter += String.fromCharCode(byte);
          filtered = items.filter((i2) => i2.label.toLowerCase().includes(filter.toLowerCase()));
          selected = 0;
          render();
          continue;
        }
      }
    };
    stdin.on("data", handler);
  });
  return result;
}
var history = [];
var historyIdx = -1;
async function readLine(prompt) {
  const wasRaw = stdin.isRaw ?? false;
  setRaw(true);
  stdin.resume();
  let line = "";
  stdout.write(prompt);
  return new Promise((resolve) => {
    const handler = (chunk) => {
      let i = 0;
      while (i < chunk.length) {
        if (chunk[i] === 27) {
          const next = consumeEscapeSeq(chunk, i);
          if (next !== null) {
            const consumed = next - i;
            if (consumed === 3 && chunk[i + 1] === 91) {
              const fin = chunk[i + 2];
              if (fin === 65) {
                if (historyIdx > 0) {
                  historyIdx--;
                  const prev = history[historyIdx] ?? "";
                  stdout.write("\r" + " ".repeat(line.length + prompt.length) + "\r" + prompt + prev);
                  line = prev;
                }
              } else if (fin === 66) {
                if (historyIdx < history.length - 1) {
                  historyIdx++;
                  const nextLn = history[historyIdx] ?? "";
                  stdout.write("\r" + " ".repeat(line.length + prompt.length) + "\r" + prompt + nextLn);
                  line = nextLn;
                } else if (historyIdx === history.length - 1) {
                  historyIdx = history.length;
                  stdout.write("\r" + " ".repeat(line.length + prompt.length) + "\r" + prompt);
                  line = "";
                }
              }
            }
            i = next;
          } else {
            i++;
          }
          continue;
        }
        const byte = chunk[i];
        i++;
        if (byte === 13 || byte === 10) {
          stdout.write("\r\n");
          stdin.removeListener("data", handler);
          setRaw(wasRaw);
          if (line.length > 0) {
            history.push(line);
            if (history.length > 100) history.shift();
          }
          historyIdx = history.length;
          resolve(line);
          return;
        }
        if (byte === 3) {
          stdout.write("\r\n");
          stdin.removeListener("data", handler);
          setRaw(wasRaw);
          resolve(null);
          return;
        }
        if (byte === 9) {
          stdin.removeListener("data", handler);
          stdout.write("\r\n");
          setRaw(wasRaw);
          resolve("__TAB__" + line);
          return;
        }
        if (byte === 16) {
          stdin.removeListener("data", handler);
          stdout.write("\r\n");
          setRaw(wasRaw);
          resolve("__CTRLP__");
          return;
        }
        if (byte === 127 || byte === 8) {
          if (line.length > 0) {
            line = line.slice(0, -1);
            stdout.write("\b \b");
          }
          continue;
        }
        if (byte >= 32 && byte <= 126) {
          line += String.fromCharCode(byte);
          stdout.write(String.fromCharCode(byte));
          continue;
        }
      }
    };
    stdin.on("data", handler);
  });
}
var COMMAND_ITEMS = [
  { label: "status          Show service status", value: "status" },
  { label: "logs <svc>      View service logs", value: "logs " },
  { label: "follow <svc>    Service console (logs + stdin)", value: "follow " },
  { label: "start <svc>     Start a service", value: "start " },
  { label: "stop <svc>      Stop a service", value: "stop " },
  { label: "restart <svc>   Restart a service", value: "restart " },
  { label: "start-all       Start all services", value: "start-all" },
  { label: "stop-all        Stop all services", value: "stop-all" },
  { label: "init            Setup wizard", value: "init" },
  { label: "update          BDS update", value: "update" },
  { label: "help            Show help", value: "help" },
  { label: "quit            Exit", value: "quit" }
];
var SERVICE_ITEMS = SERVICE_NAMES2.map((n) => {
  const s = services[n];
  const dot = s.running ? c.green("\u25CF") : c.dim("\u25CB");
  return { label: `${dot} ${padRight(s.title, 34)} ${c.dim(s.running ? `PID ${s.pid}` : "stopped")}`, value: n };
});
async function startRepl() {
  printHeader();
  if (!stdin.isTTY) {
    console.log(c.dim(" Non-interactive mode (pipe detected)\n"));
    await startReplSimple();
    return;
  }
  console.log(c.dim(" Type help \xB7 Ctrl+P services \xB7 Alt+P commands \xB7 Tab/\u2191\u2193\n"));
  while (true) {
    const raw = await readLine(c.cyan(" > "));
    if (raw === null) break;
    if (raw.startsWith("__TAB__")) {
      const partial = raw.slice(7);
      const parts2 = partial.trim().split(/\s+/);
      const cmd = parts2[0];
      const rest = parts2.slice(1).join(" ");
      if (!cmd) {
        const sel2 = await popupSelect(COMMAND_ITEMS, "Commands");
        if (sel2) await execCmd(sel2.split(/\s+/));
        continue;
      }
      if ((cmd === "logs" || cmd === "follow" || cmd === "start" || cmd === "stop" || cmd === "restart") && !rest) {
        const items = SERVICE_ITEMS.map((i) => ({ label: i.label, value: `${cmd} ${i.value}` }));
        const sel2 = await popupSelect(items, `Pick service for: ${cmd}`);
        if (sel2) await execCmd(sel2.split(/\s+/));
        continue;
      }
      const sel = await popupSelect(COMMAND_ITEMS, "Commands");
      if (sel) await execCmd(sel.split(/\s+/));
      continue;
    }
    if (raw === "__CTRLP__") {
      const sel = await popupSelect(SERVICE_ITEMS, "Service Console");
      if (sel) await enterServiceConsole(sel);
      continue;
    }
    if (raw.startsWith("/")) {
      const sel = await popupSelect(COMMAND_ITEMS, "Commands", raw.slice(1));
      if (sel) await execCmd(sel.split(/\s+/));
      continue;
    }
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/\s+/);
    await execCmd(parts);
  }
  console.log(c.dim("bye"));
}
async function startReplSimple() {
  const { createInterface } = await import("node:readline/promises");
  const rl = createInterface({ input: stdin, output: stdout, terminal: false });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/\s+/);
    if (parts[0] === "quit" || parts[0] === "exit" || parts[0] === "q") break;
    if (parts[0] === "init") {
      const { runWizard: runWizard2 } = await Promise.resolve().then(() => (init_wizard(), wizard_exports));
      await runWizard2();
      continue;
    }
    await execCmd(parts);
  }
}
async function execCmd(parts) {
  const [cmd, ...args] = parts;
  try {
    switch (cmd) {
      case "help":
      case "h":
      case "?":
        console.log(HELP2);
        break;
      case "version":
        console.log(`sfmc v${process.env["npm_package_version"] || "0.1.0"}`);
        break;
      case "status":
        console.log(cmdStatus());
        break;
      case "logs":
      case "log": {
        const out = cmdLogs(args, (svc) => {
          if (!stdin.isTTY) {
            console.log(c.yellow("follow mode requires TTY (interactive terminal)"));
            return;
          }
          enterServiceConsole(svc);
        });
        if (out) console.log(out);
        break;
      }
      case "follow": {
        const svcName = args[0];
        if (!stdin.isTTY) {
          console.log(c.yellow("console mode requires TTY (interactive terminal)"));
          break;
        }
        if (svcName && SERVICE_NAMES2.includes(svcName.toLowerCase())) {
          await enterServiceConsole(svcName.toLowerCase());
        } else {
          const sel = await popupSelect(SERVICE_ITEMS, "Service Console");
          if (sel) await enterServiceConsole(sel);
        }
        break;
      }
      case "start":
        if (args[0] === "all" || args[0] === "--all") {
          console.log(await cmdStartAll());
        } else if (args[0]) {
          console.log(await cmdStart(args[0]));
        } else {
          console.log(c.yellow("Usage: start <service>"));
        }
        break;
      case "stop":
        if (args[0] === "all" || args[0] === "--all") {
          console.log(await cmdStopAll());
        } else if (args[0]) {
          console.log(await cmdStop(args[0]));
        } else {
          console.log(c.yellow("Usage: stop <service>"));
        }
        break;
      case "restart":
        if (args[0]) {
          console.log(await cmdRestart(args[0]));
        } else {
          console.log(c.yellow("Usage: restart <service>"));
        }
        break;
      case "start-all":
        console.log(await cmdStartAll());
        break;
      case "stop-all":
        console.log(await cmdStopAll());
        break;
      case "init": {
        const { runWizard: runWizard2 } = await Promise.resolve().then(() => (init_wizard(), wizard_exports));
        await runWizard2();
        break;
      }
      case "update":
        console.log(await cmdUpdate());
        break;
      case "quit":
      case "exit":
      case "q":
        throw "QUIT";
      default:
        if (cmd.startsWith("/")) {
          const sel = await popupSelect(COMMAND_ITEMS, "Commands", cmd.slice(1));
          if (sel) await execCmd(sel.split(/\s+/));
        } else {
          console.log(c.yellow(`Unknown: ${cmd}  (try: help)`));
        }
    }
  } catch (e) {
    if (e === "QUIT") throw e;
    console.log(c.red(`Error: ${e.message}`));
  }
}
async function enterServiceConsole(svc) {
  const svcObj = services[svc];
  const wasRaw = stdin.isRaw ?? false;
  setRaw(true);
  stdin.resume();
  let running = true;
  let inputBuf = "";
  const PROMPT = c.cyan(`[${svcObj.title}] `);
  function fmtLog(l) {
    const ts = c.dim(l.time.toLocaleTimeString());
    const text2 = highlightLogLine(l.text);
    const pfx = l.stream === "stderr" ? c.red("!") : c.dim(" ");
    return `${ts} ${pfx} ${text2}`;
  }
  function redrawInput() {
    stdout.write(`\r${PROMPT}${inputBuf}\x1B[K`);
  }
  stdout.write(`
${c.bold(svcObj.title)} console \u2014 type and press Enter to send to service
`);
  stdout.write(`${c.dim("Ctrl+C or /exit to leave \xB7 Ctrl+L to clear logs")}
`);
  stdout.write(`${DIVIDER}
`);
  for (const l of svcObj.getRecentLogs(10)) {
    stdout.write(fmtLog(l) + "\n");
  }
  redrawInput();
  const onLog = (l) => {
    if (!running) return;
    stdout.write(`\r\x1B[K${fmtLog(l)}
`);
    redrawInput();
  };
  svcObj.events.on("log", onLog);
  const dataHandler = (chunk) => {
    if (!running) return;
    let i = 0;
    while (i < chunk.length) {
      if (chunk[i] === 27) {
        const next = consumeEscapeSeq(chunk, i);
        i = next !== null ? next : i + 1;
        continue;
      }
      const byte = chunk[i];
      i++;
      if (byte === 3) {
        running = false;
        stdin.removeListener("data", dataHandler);
        svcObj.events.removeListener("log", onLog);
        setRaw(wasRaw);
        stdout.write(`
${c.dim("left console")}
`);
        return;
      }
      if (byte === 13 || byte === 10) {
        const cmd = inputBuf.trim();
        stdout.write(`\r\x1B[K${c.dim(`> ${cmd}`)}
`);
        if (cmd.toLowerCase() === "/exit") {
          running = false;
          stdin.removeListener("data", dataHandler);
          svcObj.events.removeListener("log", onLog);
          setRaw(wasRaw);
          stdout.write(`${c.dim("left console")}
`);
          return;
        }
        if (cmd) {
          try {
            svcObj.proc?.stdin?.write(cmd + "\n");
          } catch {
          }
        }
        inputBuf = "";
        redrawInput();
        continue;
      }
      if (byte === 8 || byte === 127) {
        if (inputBuf.length > 0) {
          inputBuf = inputBuf.slice(0, -1);
          stdout.write("\b \b");
        }
        continue;
      }
      if (byte >= 32 && byte <= 126) {
        inputBuf += String.fromCharCode(byte);
        stdout.write(String.fromCharCode(byte));
        continue;
      }
    }
  };
  stdin.on("data", dataHandler);
}

// src/main.ts
init_theme();
function printVersion() {
  console.log(`sfmc v${process2.env["npm_package_version"] || "0.1.0"}`);
}
function printUsage() {
  console.log(`${c.bold("sfmc")} \u2014 Server Manager for Minecraft BDS

${c.dim("Usage:")}
  ${c.green("sfmc")}                  Enter interactive REPL
  ${c.green("sfmc")} ${c.blue("<command>")}       Run command once and exit

${c.dim("Commands:")}
  ${c.green("status")}              Show all services status
  ${c.green("logs")} <service>      View service logs
  ${c.green("follow")} <service>    Follow service logs (live tail)
  ${c.green("start")} <service>     Start a service
  ${c.green("stop")} <service>      Stop a service
  ${c.green("restart")} <service>   Restart a service
  ${c.green("update")}              Check/apply BDS update
  ${c.green("init")}                Run setup wizard
  ${c.green("help")}                Show this help
  ${c.green("--version")} / ${c.green("-v")}  Print version
`);
}
async function main() {
  const args = process2.argv.slice(2);
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
    case "log":
      {
        const result = cmdLogs(rest);
        if (result) console.log(result);
      }
      break;
    case "follow":
      {
        const followArgs = rest.length > 0 ? [`${rest[0]}`, "-f"] : [];
        const result = cmdLogs(followArgs);
        if (result) console.log(result);
      }
      break;
    case "start":
      if (rest[0] === "all" || rest[0] === "--all") {
        console.log(await cmdStartAll());
      } else if (rest[0]) {
        console.log(await cmdStart(rest[0]));
      } else {
        console.log(c.yellow("Usage: sfmc start <service>"));
      }
      break;
    case "stop":
      if (rest[0] === "all" || rest[0] === "--all") {
        console.log(await cmdStopAll());
      } else if (rest[0]) {
        console.log(await cmdStop(rest[0]));
      } else {
        console.log(c.yellow("Usage: sfmc stop <service>"));
      }
      break;
    case "restart":
      if (rest[0]) {
        console.log(await cmdRestart(rest[0]));
      } else {
        console.log(c.yellow("Usage: sfmc restart <service>"));
      }
      break;
    case "update":
      console.log(await cmdUpdate());
      break;
    case "init":
      {
        const { runWizard: runWizard2 } = await Promise.resolve().then(() => (init_wizard(), wizard_exports));
        await runWizard2();
      }
      break;
    default:
      console.log(c.red(`Unknown command: ${cmd}`));
      printUsage();
      process2.exit(1);
  }
  process2.exit(0);
}
main().catch((err) => {
  console.error(c.red(`Fatal: ${err.message}`));
  process2.exit(1);
});
