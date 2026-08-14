import type { BdsUpdaterConfig, DBConfig, QQBackend, QQBridgeConfig } from "@sfmc-bds/sdk/node/config";
import {
  ensureCoreConfigs,
  loadEnsuredConfig,
  qqRuntimeStatusPath,
  readJson,
  DEFAULT_BDS_UPDATER_CONFIG,
  DEFAULT_DB_CONFIG,
  DEFAULT_QQ_CONFIG,
  type QqRuntimeStatus,
} from "@sfmc-bds/sdk/node/config";
import {
  clearBdsPidFile,
  isProcessAlive,
  probeBdsStatus,
  readBdsPidFile,
  writeBdsPidFile,
} from "@sfmc-bds/bds-tools/process-probe";
import { bdsExePath, bdsSpawnEnvExtra, ensureBdsExecutable } from "@sfmc-bds/bds-tools/host-platform";
import { spawn, type ChildProcess, type IOType } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { inferLevel, pushLog as pushUnifiedLog } from "./logs.js";
import { resolveLlbotLaunch } from "./llbot-launch.js";
import { findNodeServicePids } from "./node-service-probe.js";
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

/** argv 一次性 start 在 POSIX 上须 daemonize，否则父进程退出会带走子进程（Windows 不需要） */
let argvDaemonize = false;
export function setArgvDaemonize(on: boolean): void {
  argvDaemonize = on;
}

/** 单服务 start 结果：optional 服务 validate 失败记为 skipped，不抛错 */
export type StartOutcome =
  | { status: "started" }
  | { status: "already" }
  | { status: "skipped"; reason: string };

export interface StartAllResult {
  started: ServiceName[];
  skipped: Array<{ name: ServiceName; reason: string }>;
  failed: Array<{ name: ServiceName; reason: string }>;
}

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
/** 当前 QQ 后端（与 createServices 同步，供 Tab/窗标题） */
let qqBackendMode: QQBackend = "official";

export function getQqBackendMode(): QQBackend {
  return qqBackendMode;
}

async function probeDbHealth(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** 读 `.sfmc/qq.runtime.json` + pid 存活，探测外部/本机 qq-bridge */
async function probeQqRuntime(): Promise<{ alive: boolean; pid: number }> {
  const status = readJson<QqRuntimeStatus>(qqRuntimeStatusPath(ROOT));
  if (!status?.pid || status.pid <= 0) return { alive: false, pid: 0 };
  if (!(await isProcessAlive(status.pid))) return { alive: false, pid: 0 };
  return { alive: true, pid: status.pid };
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
  /**
   * 可选服务：validate 失败时 start 返回 skipped（startAll 不当作失败）。
   * 用于 official 下跳过 llbot、以及 qq_enabled=false。
   */
  optional?: boolean;
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

  async start(): Promise<StartOutcome> {
    if (this.running) return { status: "already" };
    if (this.name === "bds") {
      const probe = await probeBdsStatus({ rootDir: ROOT });
      if (probe.state !== "stopped") {
        throw new Error(
          t("svc.bdsAlreadyRunning", { pid: String(probe.pid), kind: t(probe.state === "managed" ? "svc.running" : "svc.runningExternal") })
        );
      }
    }
    if (this.name === "db" || this.name === "qq") {
      const external = await findNodeServicePids(this.name);
      if (external.length > 0) {
        return { status: "already" };
      }
    }
    if (this.def.validate) {
      const v = this.def.validate();
      if (v) {
        // optional：配置层面跳过（如 official 下 llbot），不当失败、也不 spawn
        if (this.def.optional) return { status: "skipped", reason: v };
        throw new Error(v);
      }
    }
    if (this.def.beforeStart) {
      await this.def.beforeStart();
    }
    this.manualStop = false;
    const daemonize = argvDaemonize && process.platform !== "win32";
    const spawnOpts = {
      cwd: this.def.cwd,
      stdio: (daemonize ? "ignore" : ["pipe", "pipe", "pipe"]) as "ignore" | Array<IOType>,
      env: this.def.env ? { ...process.env, ...this.def.env } : process.env,
      detached: daemonize,
    };
    const child = this.def.service
      ? spawnService(this.def.service, this.def.args ?? [], spawnOpts)
      : spawn(this.def.cmd as string, this.def.args ?? [], spawnOpts);
    if (daemonize) child.unref();
    this.proc = child;
    this.pid = child.pid ?? 0;
    this.running = true;
    this.startTime = new Date();
    if (this.name === "bds" && this.pid > 0) {
      writeBdsPidFile(this.pid, ROOT);
    }
    this.events.emit("output", `started (PID ${this.pid})`, "info");
    this.events.emit("state", { name: this.name, running: true, pid: this.pid });

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
    return { status: "started" };
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

  async restart(): Promise<StartOutcome> {
    await this.stop();
    return this.start();
  }

  getRecentLogs(n: number): LogLine[] {
    return this.logs.slice(-n);
  }

  /**
   * 探测发现进程已死后回写本地状态（不设 manualStop，以便 exit 回调仍可按需 autoRestart）。
   */
  markStoppedFromProbe(): void {
    if (!this.running && !this.proc) return;
    this.cleanup();
  }

  private cleanup(): void {
    const wasRunning = this.running || this.proc !== null;
    const exitingPid = this.pid;
    this.proc = null;
    this.running = false;
    this.pid = 0;
    this.startTime = null;
    if (this.name === "bds" && exitingPid > 0) {
      const filePid = readBdsPidFile(ROOT);
      if (filePid === exitingPid) {
        clearBdsPidFile(ROOT);
      }
    }
    if (wasRunning) {
      this.events.emit("state", { name: this.name, running: false, pid: 0 });
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
  const useLlbotBackend = qqCfg.qq_backend === "llbot";
  const qqEnabled = qqCfg.qq_enabled !== false;
  const llbotEnabled = qqCfg.llbot_enabled !== false;
  const llbotLaunch = resolveLlbotLaunch(qqCfg.llbot_path, qqCfg.llbot_cwd);
  const llbotPath = llbotLaunch.exe;
  const llbotCwd = llbotLaunch.cwd;
  const dbPort = dbCfg.db_port ?? 3001;
  dbHealthPort = dbPort;
  qqBackendMode = useLlbotBackend ? "llbot" : "official";
  const bdsExe = bdsExePath(path.resolve(bdsPath));
  const qqTitle = useLlbotBackend ? "QQ (llbot)" : "QQ (official)";

  return {
    bds: new Service({
      name: "bds",
      title: "BDS",
      cmd: bdsExe,
      args: [],
      cwd: bdsPath,
      env: bdsSpawnEnvExtra(bdsPath),
      stopCommand: "stop",
      stopTimeout: 30000,
      autoRestart: bdsCfg.crash_restart !== false,
      restartDelay: 5000,
      validate: () => {
        if (!fs.existsSync(bdsExe)) return `not found: ${bdsExe}`;
        return null;
      },
      beforeStart: async () => {
        ensureBdsExecutable(bdsExe);
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
      title: qqTitle,
      service: "qq",
      cwd: ROOT,
      stopTimeout: 10000,
      // 缺凭据时 validate 拦下，不会 spawn→exit(1)→autoRestart 死循环
      autoRestart: true,
      restartDelay: 3000,
      optional: !qqEnabled,
      validate: () => {
        if (!qqEnabled) return "QQ bridge disabled (qq_enabled=false)";
        if (!useLlbotBackend) {
          if (!String(qqCfg.qq_app_id ?? "").trim() || !String(qqCfg.qq_app_secret ?? "").trim()) {
            return "missing qq_app_id / qq_app_secret (official backend)";
          }
        }
        return null;
      },
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
      // official 或未启用时真正 skip，不 throw
      optional: !useLlbotBackend || !llbotEnabled,
      validate: () => {
        if (!useLlbotBackend) return "LLBot skipped (qq_backend!=llbot)";
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

export async function startAll(): Promise<StartAllResult> {
  const result: StartAllResult = { started: [], skipped: [], failed: [] };
  for (const name of START_ORDER) {
    const svc = services[name];
    if (!svc) continue;
    try {
      const outcome = await svc.start();
      if (outcome.status === "skipped") {
        result.skipped.push({ name, reason: outcome.reason });
        svc.events.emit("output", `skipped: ${outcome.reason}`, "info");
      } else {
        result.started.push(name);
      }
    } catch (e) {
      const reason = (e as Error).message;
      result.failed.push({ name, reason });
      svc.events.emit("output", `start error: ${reason}`, "error");
    }
  }
  return result;
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

export type ServiceStateEvent = { name: ServiceName; running: boolean; pid: number };

/** 订阅任意服务启停（含探测回写）；返回取消函数 */
export function onServiceStateChange(fn: (ev: ServiceStateEvent) => void): () => void {
  const handler = (ev: ServiceStateEvent): void => {
    fn(ev);
  };
  for (const service of Object.values(services)) {
    service.events.on("state", handler);
  }
  return () => {
    for (const service of Object.values(services)) {
      service.events.off("state", handler);
    }
  };
}

/** 若本地标记 running 但 OS 进程已死，回收内存标志 */
async function reconcileManagedAlive(service: Service): Promise<boolean> {
  if (!service.running) return false;
  if (service.pid > 0 && !(await isProcessAlive(service.pid))) {
    service.markStoppedFromProbe();
    return false;
  }
  return service.running;
}

/**
 * 统一运行态查询（权威入口）：OS/健康探测 + 回写 Service 内存标志。
 * status / Tab 发送目标 / remote / reload 等均应走此接口，勿直接读 `service.running`。
 */
export async function queryServicesRuntime(): Promise<ServiceStatus[]> {
  return Promise.all(
    SERVICE_NAMES.map(async (name) => {
      const service = services[name];
      let running = false;
      let pid = 0;
      let uptime = "—";
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
          /* 探测为 managed 但本地已标停：保持探测结果，不强制改内存（stdin 仍可用） */
        } else if (probe.state === "external") {
          running = true;
          pid = probe.pid;
          ownership = "external";
          /* 外部进程：本地 managed 句柄已失效则回收 */
          if (service.running && service.pid !== probe.pid) {
            service.markStoppedFromProbe();
          } else if (service.running && !(await isProcessAlive(service.pid))) {
            service.markStoppedFromProbe();
          }
        } else {
          running = false;
          if (service.running || service.proc) {
            service.markStoppedFromProbe();
          }
        }
      } else if (name === "db") {
        const managed = await reconcileManagedAlive(service);
        if (managed) {
          running = true;
          pid = service.pid;
          uptime = service.uptime;
          ownership = "managed";
        } else if (await probeDbHealth(dbHealthPort)) {
          running = true;
          ownership = "external";
          const pids = await findNodeServicePids("db");
          pid = pids[0] ?? 0;
        }
      } else if (name === "qq") {
        const managed = await reconcileManagedAlive(service);
        if (managed) {
          running = true;
          pid = service.pid;
          uptime = service.uptime;
          ownership = "managed";
        } else {
          const probe = await probeQqRuntime();
          if (probe.alive) {
            running = true;
            pid = probe.pid;
            ownership = "external";
          } else {
            const pids = await findNodeServicePids("qq");
            if (pids.length > 0) {
              running = true;
              pid = pids[0]!;
              ownership = "external";
            }
          }
        }
      } else {
        const managed = await reconcileManagedAlive(service);
        if (managed) {
          running = true;
          pid = service.pid;
          uptime = service.uptime;
          ownership = "managed";
        }
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

/** 单服务是否在跑（含外部实例） */
export async function isServiceRunning(name: ServiceName): Promise<boolean> {
  const rows = await queryServicesRuntime();
  return rows.some((r) => r.name === name && r.running);
}
