import type { BdsUpdaterConfig, DBConfig, QQBridgeConfig } from "@sfmc-bds/sdk/node/config";
import {
  ensureCoreConfigs,
  loadEnsuredConfig,
  DEFAULT_BDS_UPDATER_CONFIG,
  DEFAULT_DB_CONFIG,
  DEFAULT_QQ_CONFIG,
} from "@sfmc-bds/sdk/node/config";
import {
  clearBdsPidFile,
  probeBdsStatus,
  readBdsPidFile,
  writeBdsPidFile,
} from "@sfmc-bds/bds-tools/process-probe";
import { spawn, type ChildProcess, type IOType } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { inferLevel, pushLog as pushUnifiedLog } from "./logs.js";
import { ROOT, spawnService, type ServiceId } from "./runtime.js";
import { ensurePackUpdateConfigFile } from "./pack-update/index.js";
import { t } from "./i18n/index.js";

export { ROOT } from "./runtime.js";

export interface LogLine {
  time: Date;
  text: string;
  stream: "stdout" | "stderr";
}

export type ServiceName = "bds" | "db" | "qq" | "llbot";
export const SERVICE_NAMES: ServiceName[] = ["bds", "db", "qq", "llbot"];

export interface ServiceStatus {
  name: ServiceName;
  title: string;
  running: boolean;
  pid: number;
  uptime: string;
  ownership?: "managed" | "external";
}

/** 当前 db 健康探测端口（与 createServices 同步） */
let dbHealthPort = 3001;

async function probeDbHealth(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

interface ServiceDef {
  name: ServiceName;
  title: string;
  service?: ServiceId;
  cmd?: string;
  args?: string[];
  cwd: string;
  env?: Record<string, string>;
  stopCommand?: string;
  stopTimeout: number;
  autoRestart: boolean;
  restartDelay: number;
  validate?: () => string | null;
  /** 启动前钩子(如 BDS 装载一致性校验);失败则禁止 spawn */
  beforeStart?: () => Promise<void>;
}

class Service {
  name: ServiceName;
  title: string;
  proc: ChildProcess | null = null;
  running = false;
  pid = 0;
  startTime: Date | null = null;
  logs: LogLine[] = [];
  events = new EventEmitter();

  private def: ServiceDef;
  private manualStop = false;

  constructor(def: ServiceDef) {
    this.name = def.name;
    this.title = def.title;
    this.def = def;
  }

  get uptime(): string {
    if (!this.startTime || !this.running) return "—";
    const ms = Date.now() - this.startTime.getTime();
    const m = Math.floor(ms / 60000);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m}m`;
    return `${Math.floor(ms / 1000)}s`;
  }

  pushLog(text: string, stream: "stdout" | "stderr"): void {
    const line: LogLine = { time: new Date(), text, stream };
    this.logs.push(line);
    if (this.logs.length > 2000) this.logs.splice(0, this.logs.length - 2000);
    this.events.emit("log", line);
    // stderr 视为 error; stdout 用 inferLevel 推断 (bare 子进程纯 text 时默认 info,
    // BDS 等自带 [LEVEL] 标签的仍可正确推断)
    const level = stream === "stderr" ? "error" : inferLevel(text);
    pushUnifiedLog(text, this.name, level);
  }

  async start(): Promise<void> {
    if (this.running) return;
    if (this.name === "bds") {
      const probe = await probeBdsStatus({ rootDir: ROOT });
      if (probe.state !== "stopped") {
        throw new Error(
          t("svc.bdsAlreadyRunning", { pid: String(probe.pid), kind: t(probe.state === "managed" ? "svc.running" : "svc.runningExternal") })
        );
      }
    }
    if (this.def.validate) {
      const v = this.def.validate();
      if (v) throw new Error(v);
    }
    if (this.def.beforeStart) {
      await this.def.beforeStart();
    }
    this.manualStop = false;
    const spawnOpts = {
      cwd: this.def.cwd,
      stdio: ["pipe", "pipe", "pipe"] as Array<IOType>,
      env: this.def.env ? { ...process.env, ...this.def.env } : process.env,
    };
    const child = this.def.service
      ? spawnService(this.def.service, this.def.args ?? [], spawnOpts)
      : spawn(this.def.cmd as string, this.def.args ?? [], spawnOpts);
    //child.unref();
    this.proc = child;
    this.pid = child.pid ?? 0;
    this.running = true;
    this.startTime = new Date();
    if (this.name === "bds" && this.pid > 0) {
      writeBdsPidFile(this.pid, ROOT);
    }
    this.events.emit("output", `started (PID ${this.pid})`, "info");

    child.on("error", (e) => {
      this.events.emit("output", `process error: ${e.message}`, "error");
      this.cleanup();
    });

    child.stdout?.on("data", (d: Buffer) => {
      for (const line of d.toString().split("\n").filter(Boolean)) {
        this.pushLog(line, "stdout");
      }
    });
    child.stderr?.on("data", (d: Buffer) => {
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

  async stop(): Promise<void> {
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
            /* ignore */
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

  forceStop(): void {
    const child = this.proc;
    this.manualStop = true;
    this.cleanup();
    if (!child) return;
    try {
      child.kill("SIGKILL");
    } catch {
      /* ignore */
    }
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  getRecentLogs(n: number): LogLine[] {
    return this.logs.slice(-n);
  }

  private cleanup(): void {
    const exitingPid = this.pid;
    this.proc = null;
    this.running = false;
    this.pid = 0;
    if (this.name === "bds" && exitingPid > 0) {
      const filePid = readBdsPidFile(ROOT);
      if (filePid === exitingPid) {
        clearBdsPidFile(ROOT);
      }
    }
  }
}

function createServices(): Record<ServiceName, Service> {
  /* 各服务/CLI 用 SDK ensureCoreConfigs 播种（含 $schema），不再从 configs-default 拷贝。 */
  ensureCoreConfigs(ROOT, ["bds_updater", "qq_config", "db_config"]);
  ensurePackUpdateConfigFile();
  const bdsCfg = loadEnsuredConfig(
    ROOT,
    "bds_updater.json",
    "bds_updater",
    { ...DEFAULT_BDS_UPDATER_CONFIG } as Record<string, unknown>
  ) as BdsUpdaterConfig;
  const qqCfg = loadEnsuredConfig(
    ROOT,
    "qq_config.json",
    "qq_config",
    { ...DEFAULT_QQ_CONFIG } as Record<string, unknown>
  ) as QQBridgeConfig;
  const dbCfg = loadEnsuredConfig(
    ROOT,
    "db_config.json",
    "db_config",
    { ...DEFAULT_DB_CONFIG } as Record<string, unknown>
  ) as DBConfig;
  const bdsPath = bdsCfg.bds_path ?? ROOT;
  const llbotEnabled = qqCfg.llbot_enabled !== false;
  const llbotPath = qqCfg.llbot_path ?? "D:\\LLBot-CLI-win-x64\\llbot.exe";
  const llbotCwd = qqCfg.llbot_cwd ?? "D:\\LLBot-CLI-win-x64";
  const dbPort = dbCfg.db_port ?? 3001;
  dbHealthPort = dbPort;
  const bdsExe = path.resolve(bdsPath, "bedrock_server.exe");

  return {
    bds: new Service({
      name: "bds",
      title: "BDS",
      cmd: bdsExe,
      args: [],
      cwd: bdsPath,
      stopCommand: "stop",
      stopTimeout: 30000,
      autoRestart: bdsCfg.crash_restart !== false,
      restartDelay: 5000,
      validate: () => {
        if (!fs.existsSync(bdsExe)) return `not found: ${bdsExe}`;
        return null;
      },
      beforeStart: async () => {
        /* 先装收件箱第三方包，再检查 CF 更新，再跑模块聚合闸门 */
        const { scanAndInstallInbox } = await import("./world-packs.js");
        await scanAndInstallInbox({ interactive: false });
        const { runPackUpdatesOnBdsStart } = await import("./pack-update/index.js");
        await runPackUpdatesOnBdsStart();
        const { ensurePacksReady } = await import("./pack-lifecycle.js");
        await ensurePacksReady();
      },
    }),

    db: new Service({
      name: "db",
      title: "DB Server",
      service: "db",
      cwd: ROOT,
      stopTimeout: 10000,
      autoRestart: true,
      restartDelay: 3000,
      env: { DB_PORT: String(dbPort) },
    }),

    qq: new Service({
      name: "qq",
      title: "QQ Bridge",
      service: "qq",
      cwd: ROOT,
      stopTimeout: 10000,
      autoRestart: true,
      restartDelay: 3000,
    }),

    llbot: new Service({
      name: "llbot",
      title: "LLBot",
      cmd: llbotPath,
      args: [],
      cwd: llbotCwd,
      stopTimeout: 10000,
      autoRestart: false,
      restartDelay: 5000,
      validate: () => {
        if (!llbotEnabled) return "LLBot disabled (llbot_enabled=false)";
        if (!fs.existsSync(llbotPath)) return `not found: ${llbotPath}`;
        return null;
      },
    }),
  };
}

export let services: Record<ServiceName, Service> = createServices();

export function refreshServices(): void {
  forceStopAll();
  services = createServices();
}

export const START_ORDER: ServiceName[] = ["db", "qq", "llbot", "bds"];

export async function startAll(): Promise<void> {
  for (const name of START_ORDER) {
    const svc = services[name];
    if (!svc) continue;
    try {
      await svc.start();
    } catch (e) {
      svc.events.emit("output", `start error: ${(e as Error).message}`, "error");
    }
  }
}

export async function stopAll(): Promise<void> {
  const pending = [...START_ORDER]
    .reverse()
    .map((name) => services[name])
    .filter((service): service is Service => Boolean(service?.running))
    .map((service) => service.stop());
  await Promise.allSettled(pending);
}

export function forceStopAll(): void {
  for (const service of Object.values(services)) service.forceStop();
}

export async function serviceStatus(): Promise<ServiceStatus[]> {
  return Promise.all(
    SERVICE_NAMES.map(async (name) => {
      const service = services[name];
      let running = service.running;
      let pid = service.pid;
      let uptime = service.uptime;
      let ownership: "managed" | "external" | undefined;

      if (name === "bds") {
        const probe = await probeBdsStatus({
          managedPid: service.pid,
          hasStdin: Boolean(service.proc?.stdin),
          rootDir: ROOT,
        });
        if (probe.state === "managed") {
          running = true;
          pid = probe.pid;
          uptime = service.uptime;
          ownership = "managed";
        } else if (probe.state === "external") {
          running = true;
          pid = probe.pid;
          uptime = "—";
          ownership = "external";
        } else {
          running = false;
          pid = 0;
          uptime = "—";
        }
      } else if (name === "db") {
        if (service.running) {
          ownership = "managed";
        } else if (await probeDbHealth(dbHealthPort)) {
          running = true;
          ownership = "external";
        }
      } else if (service.running) {
        ownership = "managed";
      }

      return {
        name,
        title: service.title,
        running,
        pid,
        uptime,
        ...(ownership ? { ownership } : {}),
      };
    })
  );
}
