/**
 * services.ts — CLI 进程编排与服务生命周期管理
 *
 * 核心管理对象（ServiceName）：
 * - `bds`：Minecraft 基岩版服务端（支持 stdin 管道指令交互与优雅停服）
 * - `db`：db-server SQLite HTTP 服务（端口健康检查与 loopback 探活）
 * - `tunnel`：云端 QQ Webhook 到本机 db-server 的 SSH 反向隧道
 * - `qq`：qq-bridge 消息网桥服务（支持官方 Bot 与 LLBot 双后端）
 * - `llbot`：LLBot 独立机器人进程（条件启动）
 *
 * 核心能力：
 * - 进程生命周期：按依赖次序编排服务启动（db → qq → bds）、优雅停止与异常自动拉起
 * - 多源探活感知：自动探测托管进程与外部独立进程状态
 * - 日志流统一聚合：捕获并归一化各服务的 stdout / stderr 数据流
 */

import type { BdsUpdaterConfig, DBConfig, QQBackend, QQBridgeConfig } from "@sfmc-bds/sdk/node/config";
import {
  DEFAULT_BDS_UPDATER_CONFIG,
  DEFAULT_DB_CONFIG,
  DEFAULT_QQ_CONFIG,
  ensureCoreConfigs,
  loadEnsuredConfig,
  qqRuntimeStatusPath,
  readJson,
  type QqRuntimeStatus,
} from "@sfmc-bds/sdk/node/config";

import { bdsExePath, bdsSpawnEnvExtra, ensureBdsExecutable } from "@sfmc-bds/bds-tools/host-platform";
import {
  clearBdsPidFile,
  findBedrockServerPids,
  isProcessAlive,
  killBedrockServerByImage,
  probeBdsStatus,
  readBdsPidFile,
  writeBdsPidFile,
} from "@sfmc-bds/bds-tools/process-probe";
import { postBdsLifecycleEvent } from "@sfmc-bds/bds-tools/qq-events-notify";
import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { isDaemonServer } from "./daemon/role.js";
import { onRemoteServiceStateChange } from "./daemon/client.js";
import { t } from "./i18n/index.js";
import { resolveLlbotLaunch } from "./llbot-launch.js";
import { inferLevel, pushLog as pushUnifiedLog } from "./logs.js";
import { findNodeServicePids, killNodeServiceByScript } from "./node-service-probe.js";
import { ensurePackUpdateConfigFile } from "./pack-update/index.js";
import { recordBdsVersion } from "./bds-runtime-version.js";
import { reportBdsPlayerSession } from "./player-session.js";
import { startModuleSidecars, stopModuleSidecars } from "./module-sidecars.js";
import { ROOT, spawnService, type ServiceId } from "./runtime.js";

export { ROOT } from "./runtime.js";

export interface LogLine {
  time: Date;
  text: string;
  stream: "stdout" | "stderr";
}

/** 子进程输出分行：过滤空串以及 Windows CRLF 拆分后残留的纯空白行。 */
export function nonBlankOutputLines(text: string): string[] {
  return text.split(/\r?\n/).filter((line) => line.trim().length > 0);
}

export type ServiceName = "bds" | "db" | "tunnel" | "qq" | "llbot";
export const SERVICE_NAMES: ServiceName[] = ["bds", "db", "tunnel", "qq", "llbot"];

/** 单服务 start 结果：optional 服务 validate 失败记为 skipped，不抛错 */
export type StartOutcome = { status: "started" } | { status: "already" } | { status: "skipped"; reason: string };

/**
 * 单服务 stop 结果，供 CLI 区分文案。
 * 使用场景：`stop <name>` / `restart <name>` 与 `stop all` 都走 Service.stop，但只有前者会得到 external。
 * - managed：停的是本进程拉起的子进程
 * - external：没有托管句柄，但清掉了外部实例（仅 external=true 时）
 * - idle：本来就没在跑，或批量停止时故意不动外部实例
 */
export type StopKind = "managed" | "external" | "idle";

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

const tunnelRuntimePath = path.join(ROOT, ".sfmc", "tunnel.runtime.json");

async function probeTunnelRuntime(): Promise<number> {
  const pid = readJson<{ pid?: number }>(tunnelRuntimePath)?.pid;
  return typeof pid === "number" && pid > 0 && (await isProcessAlive(pid)) ? pid : 0;
}

function writeTunnelRuntime(pid: number): void {
  fs.mkdirSync(path.dirname(tunnelRuntimePath), { recursive: true });
  fs.writeFileSync(tunnelRuntimePath, JSON.stringify({ pid, startedAt: Date.now() }) + "\n");
}

function clearTunnelRuntime(pid: number): void {
  if (readJson<{ pid?: number }>(tunnelRuntimePath)?.pid !== pid) return;
  try {
    fs.unlinkSync(tunnelRuntimePath);
  } catch {
    /* 进程退出时允许文件已被移除 */
  }
}

/** 清掉 qq-bridge 运行时文件，避免 status 仍把已退出的外部进程当成存活。 */
function clearQqRuntimeFile(): void {
  try {
    const file = qqRuntimeStatusPath(ROOT);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {
    /* 运行时文件可能已被进程自己删掉 */
  }
}

/**
 * 按镜像名结束外部 BDS，并等到进程从进程表消失。
 * 使用场景：仅单服务 stop / restart（Service.stop 的 external=true）清掉非本进程拉起的 bedrock。
 * stop all 与守护进程 shutdown 不调用这里，避免 taskkill 误杀同机其他 Bedrock。
 * taskkill 返回后进程表可能仍短暂可见，restart 会立刻探活，因此这里等到消失再返回。
 */
async function killExternalBedrock(): Promise<void> {
  await killBedrockServerByImage();
  clearBdsPidFile(ROOT);
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if ((await findBedrockServerPids()).length === 0) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  await killBedrockServerByImage();
  clearBdsPidFile(ROOT);
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
  /** 原始日志行观察器，不得阻塞子进程输出。 */
  onLogLine?: (line: string) => void;
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
  private updateInProgress = false;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(def: ServiceDef) {
    this.name = def.name;
    this.title = def.title;
    this.def = def;
    if (def.name === "tunnel") {
      this.events.on("output", (text: string, level: "info" | "error") => {
        pushUnifiedLog(text, "tunnel", level);
      });
    }
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
    this.def.onLogLine?.(text);
  }

  async start(): Promise<StartOutcome> {
    if (this.updateInProgress) throw new Error("BDS 正在更新，暂不可启动");
    if (this.running) return { status: "already" };
    if (this.name === "bds") {
      const probe = await probeBdsStatus({ rootDir: ROOT });
      if (probe.state !== "stopped") {
        throw new Error(
          t("svc.bdsAlreadyRunning", {
            pid: String(probe.pid),
            kind: t(probe.state === "managed" ? "svc.running" : "svc.runningExternal"),
          })
        );
      }
    }
    if (this.name === "db" || this.name === "qq") {
      const external = await findNodeServicePids(this.name);
      if (external.length > 0) {
        return { status: "already" };
      }
    }
    if (this.name === "tunnel" && (await probeTunnelRuntime())) return { status: "already" };
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
    if (this.name === "bds") {
      await startModuleSidecars(ROOT, (line, stream) => this.pushLog(line, stream));
    }
    // beforeStart 含异步检查；更新可能在等待期间开始。
    if (this.updateInProgress) throw new Error("BDS 正在更新，暂不可启动");
    this.manualStop = false;
    /* 子进程始终由守护进程用管道持有（stdin 发 stop、stdout 日志、autoRestart）；
     * 不再对子服务做 detached/unref——脱离终端由 daemon 进程自身负责。
     * windowsHide：Windows 上避免为每个服务弹出空白控制台（stdout 已 pipe，窗内无输出）。 */
    const spawnOpts = {
      cwd: this.def.cwd,
      stdio: ["pipe", "pipe", "pipe"] as Array<"pipe">,
      env: this.def.env ? { ...process.env, ...this.def.env } : process.env,
      windowsHide: true,
    };
    const child = this.def.service
      ? spawnService(this.def.service, this.def.args ?? [], spawnOpts)
      : spawn(this.def.cmd as string, this.def.args ?? [], spawnOpts);
    this.proc = child;
    this.pid = child.pid ?? 0;
    this.running = true;
    this.startTime = new Date();
    if (this.name === "bds" && this.pid > 0) {
      writeBdsPidFile(this.pid, ROOT);
    }
    if (this.name === "tunnel" && this.pid > 0) writeTunnelRuntime(this.pid);
    this.events.emit("output", `started (PID ${this.pid})`, "info");
    this.events.emit("state", { name: this.name, running: true, pid: this.pid });

    let lifecycleReported = false;
    const reportExit = (code?: number | null) => {
      if (this.name !== "bds" || lifecycleReported) return;
      lifecycleReported = true;
      const planned = this.manualStop || this.updateInProgress;
      void postBdsLifecycleEvent(planned ? "stop" : "crash", planned ? undefined : `code=${code ?? "?"}`, {
        port: dbHealthPort,
      });
    };
    if (this.name === "bds") {
      child.once("spawn", () => {
        void postBdsLifecycleEvent("start", undefined, { port: dbHealthPort });
      });
    }

    child.on("error", (e) => {
      this.events.emit("output", `process error: ${e.message}`, "error");
      reportExit();
      this.cleanup();
      this.scheduleRestart();
    });

    let versionLineBuffer = "";
    child.stdout?.on("data", (d: Buffer) => {
      if (this.name === "bds" && this.startTime) {
        versionLineBuffer += d.toString();
        const versionLines = versionLineBuffer.split(/\r?\n/);
        versionLineBuffer = (versionLines.pop() ?? "").slice(-4096);
        for (const versionLine of versionLines) recordBdsVersion(ROOT, versionLine, this.pid, this.startTime.getTime());
      }
      for (const line of nonBlankOutputLines(d.toString())) {
        this.pushLog(line, "stdout");
      }
    });
    child.stderr?.on("data", (d: Buffer) => {
      for (const line of nonBlankOutputLines(d.toString())) {
        this.pushLog(line, "stderr");
      }
    });

    child.on("exit", (code) => {
      if (this.proc && this.proc !== child) return;
      this.events.emit("output", `exited (code: ${code})`, "info");
      reportExit(code);
      this.cleanup();
      this.scheduleRestart();
    });
    return { status: "started" };
  }

  private scheduleRestart(): void {
    if (this.manualStop || this.updateInProgress || !this.def.autoRestart || this.restartTimer) return;
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      if (!this.updateInProgress && !this.manualStop && !this.running) {
        void this.start().catch((e: Error) => {
          this.events.emit("output", `restart failed: ${e.message}`, "error");
        });
      }
    }, this.def.restartDelay);
  }

  /** 更新器独立进程停服时，禁止将计划内退出当作崩溃并自动拉起。 */
  beginUpdate(): void {
    if (this.name !== "bds") return;
    if (this.updateInProgress) throw new Error("BDS 更新已在进行中");
    this.updateInProgress = true;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
  }

  endUpdate(): void {
    this.updateInProgress = false;
  }

  /**
   * 停止本服务。托管子进程始终走原来的优雅停止（stdin stop / SIGTERM）。
   * @param external 是否额外清掉非本进程拉起的外部实例。默认 false，只停托管子进程。
   * 两种调用场景：
   * - true：单服务 `stop <name>` / `restart <name>`（cmdStopLocal，以及仍存在的 Service.restart）。
   *   BDS 外部走 killExternalBedrock；db/qq 外部走 killNodeServiceByScript。
   * - false 或不传：`stop all`、`restart -all`、守护进程 shutdown / SIGTERM（经 stopAll）。
   *   不按镜像名或脚本名杀外部进程，避免误杀同机其他 Bedrock、db、qq。
   */
  async stop(external = false, forceOnTimeout = true): Promise<StopKind> {
    this.manualStop = true;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    /* 与原先 cmdStop 一致：仅单服务停止时，BDS 被判定为外部才按镜像结束，不走 stdin stop */
    if (external && this.name === "bds") {
      const probe = await probeBdsStatus({
        managedPid: this.pid,
        hasStdin: Boolean(this.proc?.stdin),
        rootDir: ROOT,
      });
      if (probe.state === "external") {
        await killExternalBedrock();
        this.dropStaleHandle();
        return "external";
      }
    }

    const managed = Boolean(this.proc && this.running);
    if (managed) await this.stopManagedChild(forceOnTimeout);

    /* db / qq：仅单服务停止时，托管停完后仍按脚本再扫一遍，清掉同机上的外部实例 */
    if (external && (this.name === "db" || this.name === "qq")) {
      const killed = await killNodeServiceByScript(this.name);
      if (this.name === "qq") clearQqRuntimeFile();
      if (managed) return "managed";
      return killed.length > 0 ? "external" : "idle";
    }

    if (managed) return "managed";
    return "idle";
  }

  /**
   * 优雅停止当前托管子进程（stdin stop 或 SIGTERM，超时后 SIGKILL）。
   * 使用场景：Service.stop 确认本进程仍持有子进程时调用；逻辑与原先 stop 主体相同。
   */
  private async stopManagedChild(forceOnTimeout = true): Promise<void> {
    if (!this.proc || !this.running) return;
    this.events.emit("output", "stopping...", "info");

    if (this.def.stopCommand && this.proc.stdin) {
      this.proc.stdin.write(this.def.stopCommand + "\n");
    } else {
      this.proc.kill("SIGTERM");
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!forceOnTimeout && this.proc) {
          reject(new Error(`${this.name} 未在超时内优雅退出；已中止维护，不强制结束进程`));
          return;
        }
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

  /**
   * 外部停服后丢掉失效的托管句柄，避免紧接着的 start/restart 误判「已在运行」。
   * 不走 cleanup：那会连带停掉模块附属进程，而原先的外部 BDS stop 并不这么做。
   */
  private dropStaleHandle(): void {
    if (!this.running && !this.proc) return;
    const stale = this.proc;
    this.proc = null;
    this.running = false;
    this.pid = 0;
    this.startTime = null;
    this.events.emit("state", { name: this.name, running: false, pid: 0 });
    if (stale && stale.exitCode === null) {
      try {
        stale.kill("SIGKILL");
      } catch {
        /* 外部镜像结束时这个句柄可能已经退出 */
      }
    }
  }

  forceStop(): void {
    const child = this.proc;
    this.manualStop = true;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    this.cleanup();
    if (!child) return;
    try {
      child.kill("SIGKILL");
    } catch {
      /* ignore */
    }
  }

  /**
   * 单服务重启：先停再起。
   * 使用场景：若仍有调用方直接走 Service.restart（不经 cmdStopLocal），与单服务 stop 一样清外部实例（external true）。
   * 批量 `restart -all` 和守护进程 shutdown 不走这里，它们经 stopAll 调用 stop(false)，只停托管子进程。
   */
  async restart(): Promise<StartOutcome> {
    await this.stop(true);
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
      stopModuleSidecars();
    }
    if (this.name === "tunnel" && exitingPid > 0) clearTunnelRuntime(exitingPid);
    if (wasRunning) {
      this.events.emit("state", { name: this.name, running: false, pid: 0 });
    }
  }
}

function createServices(): Record<ServiceName, Service> {
  /* 各服务/CLI 用 SDK ensureCoreConfigs 播种（含 $schema），不再从 configs-default 拷贝。 */
  ensureCoreConfigs(ROOT, ["bds_updater", "qq_config", "db_config"]);
  ensurePackUpdateConfigFile();
  void import("./module-update/index.js")
    .then((mod) => mod.ensureModuleUpdateConfigFile())
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      pushUnifiedLog(message, "module", "warn");
    });
  const bdsCfg = loadEnsuredConfig(ROOT, "bds_updater.json", "bds_updater", { ...DEFAULT_BDS_UPDATER_CONFIG } as Record<
    string,
    unknown
  >) as BdsUpdaterConfig;
  const qqCfg = loadEnsuredConfig(ROOT, "qq_config.json", "qq_config", { ...DEFAULT_QQ_CONFIG } as Record<
    string,
    unknown
  >) as QQBridgeConfig;
  const dbCfg = loadEnsuredConfig(ROOT, "db_config.json", "db_config", { ...DEFAULT_DB_CONFIG } as Record<
    string,
    unknown
  >) as DBConfig;
  const rawBdsPath = String(bdsCfg.bds_path ?? "").trim();
  if (process.platform !== "win32" && /^[A-Za-z]:[\\/]/.test(rawBdsPath)) {
    throw new Error(
      `configs/bds_updater.json 的 bds_path 是 Windows 路径（${rawBdsPath}）。` +
        `请改成相对 SFMC_ROOT 的路径，例如 "BDS"。`
    );
  }
  const bdsPath = path.resolve(ROOT, rawBdsPath || ".");
  const useLlbotBackend = qqCfg.qq_backend === "llbot";
  const qqEnabled = qqCfg.qq_enabled !== false;
  // 官方 Webhook 由云端接收；仅切换传输方式即可避免本机再启动一个桥。
  const qqExternal = !useLlbotBackend && qqCfg.official?.transport === "webhook";
  const tunnelCfg = qqCfg.official?.tunnel;
  const tunnelEnabled = qqEnabled && qqExternal && tunnelCfg?.enabled === true;
  const tunnelHost = String(tunnelCfg?.host ?? "").trim();
  const tunnelRemotePort = tunnelCfg?.remotePort ?? 13001;
  const llbotEnabled = qqCfg.llbot?.enabled !== false;
  const llbotLaunch = resolveLlbotLaunch(qqCfg.llbot?.path, qqCfg.llbot?.cwd);
  const llbotPath = llbotLaunch.exe;
  const llbotCwd = llbotLaunch.cwd;
  const dbPort = dbCfg.db_port ?? 3001;
  dbHealthPort = dbPort;
  qqBackendMode = useLlbotBackend ? "llbot" : "official";
  const bdsExe = bdsExePath(bdsPath);
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
      /* 崩溃拉起由 sfmc daemon 固定开启；不再读 bds_updater.crash_restart */
      autoRestart: true,
      restartDelay: 5000,
      validate: () => {
        if (!fs.existsSync(bdsExe)) return `not found: ${bdsExe}`;
        return null;
      },
      beforeStart: async () => {
        ensureBdsExecutable(bdsExe);
        /* 先装收件箱第三方包，再检查 CF 更新，再跑模块聚合闸门 */
        /* 业务模块更新只走显式命令，不进开服钩子。 */
        const { scanAndInstallInbox } = await import("./world-packs.js");
        await scanAndInstallInbox({ interactive: false });
        const { runPackUpdatesOnBdsStart } = await import("./pack-update/index.js");
        await runPackUpdatesOnBdsStart();
        const { ensurePacksReady } = await import("./pack-lifecycle.js");
        await ensurePacksReady();
      },
      onLogLine: (line) =>
        reportBdsPlayerSession(line, {
          port: dbPort,
          ...(dbCfg.http_auth ? { authToken: dbCfg.http_auth } : {}),
        }),
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

    tunnel: new Service({
      name: "tunnel",
      title: "QQ SSH Tunnel",
      cmd: "ssh",
      args: [
        "-N", "-T", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10",
        "-o", "ExitOnForwardFailure=yes", "-o", "ServerAliveInterval=30",
        "-o", "ServerAliveCountMax=3",
        "-R", `127.0.0.1:${tunnelRemotePort}:127.0.0.1:${dbPort}`,
        tunnelHost,
      ],
      cwd: ROOT,
      stopTimeout: 10000,
      autoRestart: true,
      restartDelay: 5000,
      optional: !tunnelEnabled,
      validate: () => {
        if (!tunnelEnabled) return "QQ tunnel disabled (official webhook tunnel.enabled=false)";
        if (!/^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(tunnelHost)) return "invalid official.tunnel.host";
        if (!Number.isInteger(tunnelRemotePort) || tunnelRemotePort < 1 || tunnelRemotePort > 65535) {
          return "invalid official.tunnel.remotePort";
        }
        return null;
      },
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
      optional: !qqEnabled || qqExternal,
      validate: () => {
        if (!qqEnabled) return "QQ bridge disabled (qq_enabled=false)";
        if (qqExternal) return "QQ bridge runs externally (official.transport=webhook)";
        if (!useLlbotBackend) {
          if (!String(qqCfg.official?.app_id ?? "").trim() || !String(qqCfg.official?.app_secret ?? "").trim()) {
            return "missing official.app_id / official.app_secret";
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
        if (!llbotEnabled) return "LLBot disabled (llbot.enabled=false)";
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

export const START_ORDER: ServiceName[] = ["db", "tunnel", "qq", "llbot", "bds"];

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

/**
 * 按启动逆序停止本进程拉起的托管子进程（优雅 stop / stdin stop）。
 * 使用场景：`stop all`、`restart -all`、守护进程 shutdown / SIGTERM。
 * 显式传 external false：不按镜像名或脚本名杀外部 BDS / db / qq。
 */
export async function stopAll(): Promise<void> {
  const pending = [...START_ORDER]
    .reverse()
    .map((name) => services[name])
    .filter((service): service is Service => Boolean(service))
    .map((service) => service.stop(false));
  await Promise.allSettled(pending);
}

export function forceStopAll(): void {
  for (const service of Object.values(services)) service.forceStop();
}

export type ServiceStateEvent = { name: ServiceName; running: boolean; pid: number };

/** 订阅任意服务启停（含探测回写）；返回取消函数 */
export function onServiceStateChange(fn: (ev: ServiceStateEvent) => void): () => void {
  /* CLI 进程不持有 Service 子进程：改订守护进程推送的远程状态事件 */
  if (!isDaemonServer()) {
    return onRemoteServiceStateChange(fn);
  }
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
 * status / Tab 发送目标 / reload 等均应走此接口，勿直接读 `service.running`。
 * CLI 进程经守护进程 RPC 获取；守护进程内走本地探活。
 */
export async function queryServicesRuntime(): Promise<ServiceStatus[]> {
  if (!isDaemonServer()) {
    const { queryRuntimeViaDaemon } = await import("./daemon/client.js");
    return queryRuntimeViaDaemon();
  }
  return queryServicesRuntimeLocal();
}

/** 守护进程内本地探活实现（亦供 server status 组装 rows） */
export async function queryServicesRuntimeLocal(): Promise<ServiceStatus[]> {
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
      } else if (name === "tunnel") {
        const managed = await reconcileManagedAlive(service);
        if (managed) {
          running = true;
          pid = service.pid;
          uptime = service.uptime;
          ownership = "managed";
        } else {
          pid = await probeTunnelRuntime();
          running = pid > 0;
          if (running) ownership = "external";
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
