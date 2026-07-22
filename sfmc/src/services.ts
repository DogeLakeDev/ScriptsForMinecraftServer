import type { BdsUpdaterConfig, DBConfig, QQBridgeConfig } from "@sfmc/sdk/node/config";
import { configPath, ensureJsonConfig, readJson } from "@sfmc/sdk/node/config";
import { spawn, type ChildProcess, type IOType } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { inferLevel, pushLog as pushUnifiedLog } from "./logs.js";
import { ROOT, spawnService, type ServiceId } from "./runtime.js";

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
    if (this.def.validate) {
      const v = this.def.validate();
      if (v) throw new Error(v);
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
    this.proc = null;
    this.running = false;
    this.pid = 0;
  }
}

function createServices(): Record<ServiceName, Service> {
  /* 启动时 ensure 三个核心配置文件存在;不存在就写空 {}。
   * wizard 只负责填字段,骨架由本进程启动时一次性就地创建。 */
  ensureJsonConfig<BdsUpdaterConfig>(ROOT, "bds_updater.json", {});
  ensureJsonConfig<QQBridgeConfig>(ROOT, "qq_config.json", {});
  ensureJsonConfig<DBConfig>(ROOT, "db_config.json", {});
  const bdsCfg = readJson<BdsUpdaterConfig>(configPath(ROOT, "bds_updater.json")) ?? {};
  const qqCfg = readJson<QQBridgeConfig>(configPath(ROOT, "qq_config.json")) ?? {};
  const dbCfg = readJson<DBConfig>(configPath(ROOT, "db_config.json")) ?? {};
  const bdsPath = bdsCfg.bds_path ?? ROOT;
  const llbotEnabled = qqCfg.llbot_enabled !== false;
  const llbotPath = qqCfg.llbot_path ?? "D:\\LLBot-CLI-win-x64\\llbot.exe";
  const llbotCwd = qqCfg.llbot_cwd ?? "D:\\LLBot-CLI-win-x64";
  const dbPort = dbCfg.db_port ?? 3001;
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

export function serviceStatus(): ServiceStatus[] {
  return SERVICE_NAMES.map((name) => {
    const service = services[name];
    return { name, title: service.title, running: service.running, pid: service.pid, uptime: service.uptime };
  });
}
