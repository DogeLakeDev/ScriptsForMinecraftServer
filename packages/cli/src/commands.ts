/**
 * commands.ts — CLI 核心运维命令实现
 *
 * 提供命令行与 REPL 共享的系统级运维指令：
 * - `status`：查询全部服务（BDS、db-server、qq-bridge、LLBot）运行状态、PID、运行时长与所有权
 * - `start` / `stop` / `restart`：按依赖顺序或单个控制服务启停
 * - `startAll` / `stopAll`：批量编排控制所有后台服务
 * - `logs`：检索并实时追踪指定服务的最近日志流
 * - `update`：触发 BDS 核心版本更新检查与热升级
 */

import { probeBdsStatus } from "@sfmc-bds/bds-tools/process-probe";
import { stripTaskbarOsc } from "@sfmc-bds/bds-tools/taskbar";
import { didUpdateDeploy } from "@sfmc-bds/bds-tools/update-result";
import { isDaemonServer } from "./daemon/role.js";
import { t } from "./i18n/index.js";
import { pushLog as pushUnifiedLog } from "./logs.js";
import { findNodeServicePids, type NodeServiceName } from "./node-service-probe.js";
import { spawnService } from "./runtime.js";
import { queryServicesRuntime, ROOT, SERVICE_NAMES, services, type ServiceName } from "./services.js";
import { c, DIVIDER, highlightLogLine, padRight } from "./theme.js";

/**
 * CLI 侧经守护进程执行并取回 text；守护进程内直接跑 localFn。
 * 使用场景：status/start/stop/send/update 等运维命令的统一分流，避免 CLI 进程持有子进程。
 */
async function viaDaemonText(
  method: "status" | "start" | "stop" | "restart" | "startAll" | "stopAll" | "send" | "update",
  localFn: () => Promise<string>,
  params?: { name?: string; message?: string; args?: string[] }
): Promise<string> {
  if (isDaemonServer()) return localFn();
  const { textViaDaemon, statusTextViaDaemon } = await import("./daemon/client.js");
  if (method === "status") return statusTextViaDaemon();
  return textViaDaemon(method, params);
}

function parseService(raw: string): ServiceName | null {
  const s = raw.toLowerCase() as ServiceName;
  if (SERVICE_NAMES.includes(s)) return s;
  return null;
}

function statusLine(
  name: string,
  running: boolean,
  pid: number,
  uptime: string,
  ownership?: "managed" | "external"
): string {
  const dot = running ? c.green("●") : c.dim("○");
  const state = running ? c.green(t("svc.state.running")) : c.dim(t("svc.state.stopped"));
  let owner = c.dim(t("svc.owner.none"));
  if (running && ownership === "managed") owner = c.cyan(t("svc.owner.managed"));
  else if (running && ownership === "external") owner = c.yellow(t("svc.owner.external"));
  const pidStr = pid ? c.dim(String(pid)) : c.dim("—");
  const upStr = uptime !== "—" ? c.dim(uptime) : c.dim("—");
  return `  ${dot} ${c.bold(padRight(name, 14))} ${padRight(state, 8)} ${padRight(owner, 6)} ${padRight(pidStr, 8)} ${upStr}`;
}

/**
 * 查询并格式化展示所有后台服务的当前运行状态矩阵。
 *
 * @returns 格式化后的状态摘要文本表格。
 */
export async function cmdStatus(): Promise<string> {
  return viaDaemonText("status", async () => {
    const rows = await queryServicesRuntime();
    const lines = rows.map((row) => statusLine(row.title, row.running, row.pid, row.uptime, row.ownership));
    const nameH = t("svc.col.name");
    const statusH = t("svc.col.status");
    const ownerH = t("svc.col.owner");
    const pidH = t("svc.col.pid");
    const upH = t("svc.col.uptime");
    const header = `  ${padRight(nameH, 16)}${padRight(statusH, 8)}${padRight(ownerH, 6)}${padRight(pidH, 8)}${upH}`;
    return `\n${c.bold(t("svc.header"))}\n` + c.dim(header) + "\n" + DIVIDER + "\n" + lines.join("\n");
  });
}

/**
 * 检索并格式化指定服务的最近历史日志行（支持 `-n <行数>` 及 `-f` 实时追踪）。
 *
 * @param args 参数列表。
 * @param onFollow 可选的跟随模式回调。
 * @returns 格式化后的日志输出文本。
 */
export function cmdLogs(args: string[], onFollow?: (serviceName: ServiceName) => void): string {
  let n = 20;
  let follow = false;
  const positional: string[] = [];

  for (const a of args) {
    if (a === "-n") continue; /* handled below */
    if (a === "-f") {
      follow = true;
      continue;
    }
    positional.push(a);
  }

  /* -n takes the next argument as value */
  const nIdx = args.indexOf("-n");
  if (nIdx >= 0 && nIdx + 1 < args.length) n = parseInt(args[nIdx + 1] ?? "0", 10);

  const svcRaw = positional[0];
  if (!svcRaw) return c.yellow(t("svc.logs.usage"));

  const svc = parseService(svcRaw);
  if (!svc) return c.red(t("svc.unknown", { name: svcRaw, list: SERVICE_NAMES.join(", ") }));

  const svcObj = services[svc];

  const lines = svcObj.getRecentLogs(n);
  if (lines.length === 0) return c.dim(t("svc.logs.empty"));

  const header = `\n${c.bold(t("svc.logs.header", { title: svcObj.title, count: lines.length }))}`;
  const body = lines
    .map((l) => {
      const ts = c.dim(l.time.toLocaleTimeString());
      const text = highlightLogLine(l.text);
      const prefix = l.stream === "stderr" ? c.red("!") : c.dim(" ");
      return `${ts} ${prefix} ${text}`;
    })
    .join("\n");

  const result = header + "\n" + DIVIDER + "\n" + body + "\n";

  if (follow && onFollow) {
    onFollow(svc);
    return "";
  }

  return result;
}

const STARTING = new Set<ServiceName>();
const STOPPING = new Set<ServiceName>();

function isNodeSvc(name: ServiceName): name is NodeServiceName {
  return name === "db" || name === "qq";
}

/**
 * 启动指定的单项后台服务（bds / db / qq / llbot）。
 *
 * @param raw 目标服务名称字符串。
 * @returns 启动结果描述文本。
 */
export async function cmdStart(raw: string): Promise<string> {
  return viaDaemonText("start", () => cmdStartLocal(raw), { name: raw });
}

/** 守护进程内启动单服务（含外部探活防双开） */
async function cmdStartLocal(raw: string): Promise<string> {
  const svc = parseService(raw);
  if (!svc) return c.red(t("svc.unknown", { name: raw, list: SERVICE_NAMES.join(", ") }));
  const svcObj = services[svc];
  if (svc === "bds") {
    const probe = await probeBdsStatus({ rootDir: ROOT });
    if (probe.state !== "stopped") {
      return c.yellow(
        t("svc.bdsAlreadyRunning", {
          pid: String(probe.pid),
          kind: probe.state === "managed" ? t("svc.running") : t("svc.runningExternal"),
        })
      );
    }
  }
  // 外部已在跑：禁止再 spawn（避免双 db / 双 qq）
  if (isNodeSvc(svc)) {
    const external = await findNodeServicePids(svc);
    if (external.length > 0) {
      return c.yellow(t("svc.alreadyRunning", { title: svcObj.title, pid: String(external.join(",")) }));
    }
  }
  if (svcObj.running) return c.yellow(t("svc.alreadyRunning", { title: svcObj.title, pid: svcObj.pid }));
  if (STARTING.has(svc)) return c.dim(t("svc.alreadyStarting", { title: svcObj.title }));
  STARTING.add(svc);
  try {
    const outcome = await svcObj.start();
    if (outcome.status === "skipped") {
      return c.yellow(t("svc.skipped", { title: svcObj.title, reason: outcome.reason }));
    }
    if (outcome.status === "already") {
      return c.yellow(t("svc.alreadyRunning", { title: svcObj.title, pid: svcObj.pid }));
    }
    return c.green(t("svc.started", { title: svcObj.title }));
  } catch (e) {
    return c.red(t("svc.startFailed", { title: svcObj.title, message: (e as Error).message }));
  } finally {
    STARTING.delete(svc);
  }
}

/**
 * 停止指定的单项后台服务（支持对外部非托管实例执行精准清理）。
 *
 * @param raw 目标服务名称字符串。
 * @returns 停止操作结果文本。
 */
export async function cmdStop(raw: string): Promise<string> {
  return viaDaemonText("stop", () => cmdStopLocal(raw), { name: raw });
}

/**
 * 把 Service.stop 的结果翻成原来的文案。
 * 单服务停止会传 external true，外部进程是否被清掉由该次 stop 决定；这里只负责展示。
 */
function formatStopKind(title: string, kind: "managed" | "external" | "idle"): string {
  if (kind === "external") return c.dim(t("svc.stoppedExternal", { title }));
  if (kind === "idle") return c.yellow(t("svc.alreadyStopped", { title }));
  return c.dim(t("svc.stoppedMsg", { title }));
}

/**
 * 守护进程内停止单服务。
 * 传 external true：BDS 外部走 killExternalBedrock，db/qq 外部走 killNodeServiceByScript。
 * 使用场景：`stop <name>`，以及 `restart <name>`（cmdRestartLocal 复用本函数）。
 */
async function cmdStopLocal(raw: string): Promise<string> {
  const svc = parseService(raw);
  if (!svc) return c.red(t("svc.unknown", { name: raw, list: SERVICE_NAMES.join(", ") }));
  const svcObj = services[svc];
  if (STOPPING.has(svc)) return c.dim(t("svc.alreadyStopping", { title: svcObj.title }));
  STOPPING.add(svc);
  try {
    const kind = await svcObj.stop(true);
    return formatStopKind(svcObj.title, kind);
  } catch (e) {
    return c.red(t("svc.stopFailed", { title: svcObj.title, message: (e as Error).message }));
  } finally {
    STOPPING.delete(svc);
  }
}

export async function cmdSend(raw: string, message: string): Promise<string> {
  return viaDaemonText("send", () => cmdSendLocal(raw, message), { name: raw, message });
}

/** 守护进程内向服务 stdin 写入一行 */
async function cmdSendLocal(raw: string, message: string): Promise<string> {
  const svc = parseService(raw);
  if (!svc) return c.red(t("svc.unknown", { name: raw, list: SERVICE_NAMES.join(", ") }));
  if (svc === "tunnel") return c.yellow(t("svc.stdinUnavailable", { title: services[svc].title }));
  if (!message) return c.yellow(t("svc.send.usage"));
  const svcObj = services[svc];
  /* 先统一探测，避免内存 running 与真实进程脱节 */
  await queryServicesRuntime();
  if (svc === "bds") {
    const probe = await probeBdsStatus({
      managedPid: svcObj.pid,
      hasStdin: Boolean(svcObj.proc?.stdin),
      rootDir: ROOT,
    });
    if (probe.state === "external") {
      return c.yellow(t("svc.stdinUnavailable", { title: svcObj.title }));
    }
  }
  if (!svcObj.running || !svcObj.proc?.stdin) return c.yellow(t("svc.notRunning", { title: svcObj.title }));
  try {
    svcObj.proc.stdin.write(message + "\n");
    return "";
  } catch {
    return c.red(t("svc.writeFailed"));
  }
}

/**
 * 重启指定的单项后台服务（遵循 stop → start 严谨时序）。
 *
 * @param raw 目标服务名称字符串。
 * @returns 重启操作结果文本。
 */
export async function cmdRestart(raw: string): Promise<string> {
  return viaDaemonText("restart", () => cmdRestartLocal(raw), { name: raw });
}

/**
 * 停止结果是不是真正的失败。
 * 「已停止 / already stopped」里也可能带有 failed 字样的翻译残留，那种不算失败。
 */
function isStopFailure(msg: string): boolean {
  return /失败|failed/i.test(msg) && !/已停止|stopped|already/i.test(msg);
}

/**
 * 启动没有真正拉起进程：失败、仍被外部实例占用，或按配置跳过。
 * 使用场景：restart 不能在这种情况下报「已重启」。
 */
function isStartNotLaunched(msg: string): boolean {
  return /失败|failed|已在运行|already running|已跳过|skipped/i.test(msg);
}

/** 守护进程内重启单服务（先按与 stop 相同的规则清掉外部实例，再启动） */
async function cmdRestartLocal(raw: string): Promise<string> {
  const svc = parseService(raw);
  if (!svc) return c.red(t("svc.unknown", { name: raw, list: SERVICE_NAMES.join(", ") }));
  const stopMsg = await cmdStopLocal(svc);
  if (isStopFailure(stopMsg)) return stopMsg;
  const startMsg = await cmdStartLocal(svc);
  if (isStartNotLaunched(startMsg)) return startMsg;
  return c.green(t("svc.restarted", { title: services[svc].title }));
}

/**
 * 按服务拓扑依赖次序批量启动所有已启用的后台服务。
 *
 * @returns 批量启动结果统计报告文本。
 */
export async function cmdStartAll(): Promise<string> {
  return viaDaemonText("startAll", cmdStartAllLocal);
}

/** 守护进程内批量启动 */
async function cmdStartAllLocal(): Promise<string> {
  const { startAll } = await import("./services.js");
  const result = await startAll();
  const parts: string[] = [];
  if (result.started.length > 0) {
    parts.push(c.green(t("svc.startAll.started", { list: result.started.join(", ") })));
  }
  if (result.skipped.length > 0) {
    parts.push(
      c.dim(
        t("svc.startAll.skipped", {
          list: result.skipped.map((s) => `${s.name}(${s.reason})`).join("; "),
        })
      )
    );
  }
  if (result.failed.length > 0) {
    parts.push(
      c.red(
        t("svc.startAll.failed", {
          list: result.failed.map((s) => `${s.name}: ${s.reason}`).join("; "),
        })
      )
    );
  }
  if (parts.length === 0) return c.dim(t("svc.startAll.empty"));
  if (result.failed.length === 0 && result.skipped.length === 0) {
    return c.green(t("svc.allStarted"));
  }
  return parts.join("\n");
}

/**
 * 批量停止所有当前处于运行态的后台服务。
 *
 * @returns 批量停止确认文本。
 */
export async function cmdStopAll(): Promise<string> {
  return viaDaemonText("stopAll", cmdStopAllLocal);
}

/**
 * 守护进程内批量停止。
 * 使用场景：`stop all`、`restart -all`。只调 stopAll()，由其传 external false，不杀外部进程。
 */
async function cmdStopAllLocal(): Promise<string> {
  const { stopAll } = await import("./services.js");
  await stopAll();
  return c.dim(t("svc.allStopped"));
}

/**
 * 触发 BDS 核心版本更新检查与热升级流程。
 *
 * 进程管理与编排约束：
 * - updater 子进程始终附加 `--no-start` 参数，避免由于进程脱离导致 REPL 丢失 PID 跟踪及标准输出
 * - 若更新前 BDS 处于运行状态，且未显式指定 `--no-start`，在更新落盘部署完成后由监督器重新唤起 BDS
 *
 * @param args 传递给更新器的命令行参数。
 * @returns 更新执行结果摘要文本。
 */
export async function cmdUpdate(args: string[] = []): Promise<string> {
  return viaDaemonText("update", () => cmdUpdateLocal(args), { args });
}

/** 守护进程内执行 BDS 更新（需持有 bds Service 句柄以 beginUpdate/endUpdate） */
async function cmdUpdateLocal(args: string[] = []): Promise<string> {
  const userNoStart = args.includes("--no-start");
  const checkOnly = args.includes("--check-only");
  const spawnArgs = userNoStart ? [...args] : [...args, "--no-start"];

  const bds = services.bds;
  // 更新器和 CLI 分属不同进程；先暂停 CLI 的崩溃自启，再交给更新器停服。
  bds.beginUpdate();
  try {
    const bdsProbe = await probeBdsStatus({
      managedPid: bds.pid,
      hasStdin: Boolean(bds.proc?.stdin),
      rootDir: ROOT,
    });
    const bdsWasRunning = bdsProbe.state !== "stopped";

    const result = await new Promise<{ code: number | null; out: string }>((resolve) => {
      const proc = spawnService("update", spawnArgs, {
        cwd: ROOT,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      let out = "";
      const pushChunk = (raw: string, level: "info" | "error"): void => {
        // 剥离 Windows Terminal 任务栏 OSC，避免 pipe 日志空白行（权威：bds-tools/taskbar）
        const s = stripTaskbarOsc(raw);
        out += s;
        for (const line of s
          .split(/\r?\n/)
          .map((l) => l.trimEnd())
          .filter((l) => l.length > 0)) {
          pushUnifiedLog(line, "update", level);
        }
      };
      proc.stdout?.on("data", (d: Buffer) => pushChunk(d.toString(), "info"));
      proc.stderr?.on("data", (d: Buffer) => pushChunk(d.toString(), "error"));
      proc.on("exit", (code) => {
        if (code === 0) {
          pushUnifiedLog(t("svc.updateComplete"), "system", "success");
          resolve({ code: 0, out: (out ? out + "\n" : "") + t("svc.updateComplete") });
        } else {
          resolve({ code, out: out || t("svc.updateExited", { code: String(code) }) });
        }
      });
      proc.on("error", (e) => {
        pushUnifiedLog(t("svc.updateError", { message: e.message }), "system", "error");
        resolve({ code: 1, out: t("svc.updateError", { message: e.message }) });
      });
    });

    /* 仅在真正完成部署后拉起 BDS；「已是最新」不打扰当前状态。
     * 以 updater 输出的 SFMC_UPDATE_RESULT=deployed 机器标记为准（勿匹配本地化日志）。 */
    const didDeploy = didUpdateDeploy(result.out);
    if (result.code === 0 && didDeploy && !userNoStart && !checkOnly) {
      const afterProbe = await probeBdsStatus({
        managedPid: bds.pid,
        hasStdin: Boolean(bds.proc?.stdin),
        rootDir: ROOT,
      });
      if (afterProbe.state !== "stopped") {
        return result.out;
      }
      try {
        pushUnifiedLog(t("svc.updateStartBds"), "system", "info");
        bds.endUpdate();
        await bds.start();
        return result.out + "\n" + c.green(t("svc.bdsStarted"));
      } catch (e) {
        return result.out + "\n" + c.red(t("svc.bdsStartFailed", { message: (e as Error).message }));
      }
    }

    if (result.code === 0 && didDeploy && userNoStart && bdsWasRunning) {
      const afterProbe = await probeBdsStatus({ rootDir: ROOT });
      if (afterProbe.state === "stopped") {
        return result.out + "\n" + c.yellow(t("svc.bdsStoppedForUpdate"));
      }
    }

    return result.out;
  } finally {
    bds.endUpdate();
  }
}
