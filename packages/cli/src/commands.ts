import { killBedrockServerByImage, probeBdsStatus, clearBdsPidFile } from "@sfmc-bds/bds-tools/process-probe";
import {
  DEFAULT_QQ_CONFIG,
  loadEnsuredConfig,
  qqRuntimeStatusPath,
  type QQBridgeConfig,
} from "@sfmc-bds/sdk/node/config";
import { findNodeServicePids, killNodeServiceByScript, type NodeServiceName } from "./node-service-probe.js";
import { pushLog as pushUnifiedLog } from "./logs.js";
import { t } from "./i18n/index.js";
import { spawnService } from "./runtime.js";
import { ROOT, SERVICE_NAMES, queryServicesRuntime, services, type ServiceName } from "./services.js";
import { c, DIVIDER, highlightLogLine, padRight } from "./theme.js";
import { stripTaskbarOsc } from "@sfmc-bds/bds-tools/taskbar";
import { didUpdateDeploy } from "@sfmc-bds/bds-tools/update-result";
import fs from "node:fs";

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

/** status 页脚：QQ 后端与关键摘要（密钥脱敏） */
function qqBridgeStatusFooter(): string {
  const qqCfg = loadEnsuredConfig(
    ROOT,
    "qq_config.json",
    "qq_config",
    { ...DEFAULT_QQ_CONFIG } as Record<string, unknown>
  ) as QQBridgeConfig;
  const backend = qqCfg.qq_backend === "llbot" ? "llbot" : "official";
  const enabled = qqCfg.qq_enabled !== false;
  if (backend === "llbot") {
    const group = qqCfg.qq_group_id || "—";
    const pathHint = qqCfg.llbot_path ? String(qqCfg.llbot_path) : "—";
    return (
      `\n${c.dim(t("svc.qq.footer.llbot", { enabled: enabled ? "on" : "off", group, path: pathHint }))}\n`
    );
  }
  const appId = String(qqCfg.qq_app_id ?? "").trim();
  const appIdHint = appId ? (appId.length > 8 ? `${appId.slice(0, 4)}…${appId.slice(-4)}` : appId) : "—";
  const openid = String(qqCfg.qq_group_openid ?? "").trim() || "—";
  const sandbox = qqCfg.qq_sandbox ? "sandbox" : "prod";
  const creds = appId && String(qqCfg.qq_app_secret ?? "").trim() ? "ok" : "missing";
  return (
    `\n${c.dim(t("svc.qq.footer.official", { enabled: enabled ? "on" : "off", appId: appIdHint, openid, sandbox, creds }))}\n`
  );
}

export async function cmdStatus(): Promise<string> {
  const rows = await queryServicesRuntime();
  const lines = rows.map((row) => statusLine(row.title, row.running, row.pid, row.uptime, row.ownership));
  const nameH = t("svc.col.name");
  const statusH = t("svc.col.status");
  const ownerH = t("svc.col.owner");
  const pidH = t("svc.col.pid");
  const upH = t("svc.col.uptime");
  const header =
    `  ${padRight(nameH, 16)}${padRight(statusH, 8)}${padRight(ownerH, 6)}${padRight(pidH, 8)}${upH}`;
  return (
    `\n${c.bold(t("svc.header"))}\n` +
    c.dim(header) +
    "\n" +
    DIVIDER +
    "\n" +
    lines.join("\n") +
    qqBridgeStatusFooter()
  );
}

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

function clearQqRuntimeFile(): void {
  try {
    const file = qqRuntimeStatusPath(ROOT);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {
    /* ignore */
  }
}

export async function cmdStart(raw: string): Promise<string> {
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
      return c.yellow(
        t("svc.alreadyRunning", { title: svcObj.title, pid: String(external.join(",")) })
      );
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

export async function cmdStop(raw: string): Promise<string> {
  const svc = parseService(raw);
  if (!svc) return c.red(t("svc.unknown", { name: raw, list: SERVICE_NAMES.join(", ") }));
  const svcObj = services[svc];
  if (svc === "bds") {
    const probe = await probeBdsStatus({
      managedPid: svcObj.pid,
      hasStdin: Boolean(svcObj.proc?.stdin),
      rootDir: ROOT,
    });
    if (probe.state === "external") {
      if (STOPPING.has(svc)) return c.dim(t("svc.alreadyStopping", { title: svcObj.title }));
      STOPPING.add(svc);
      try {
        await killBedrockServerByImage();
        clearBdsPidFile(ROOT);
        return c.dim(t("svc.stoppedExternal", { title: svcObj.title }));
      } catch (e) {
        return c.red(t("svc.stopFailed", { title: svcObj.title, message: (e as Error).message }));
      } finally {
        STOPPING.delete(svc);
      }
    }
  }

  // db / qq：托管或外部都要能停干净
  if (isNodeSvc(svc)) {
    if (STOPPING.has(svc)) return c.dim(t("svc.alreadyStopping", { title: svcObj.title }));
    STOPPING.add(svc);
    try {
      const managed = svcObj.running;
      if (managed) {
        await svcObj.stop();
      }
      const killed = await killNodeServiceByScript(svc);
      if (svc === "qq") clearQqRuntimeFile();
      if (!managed && killed.length === 0) {
        return c.yellow(t("svc.alreadyStopped", { title: svcObj.title }));
      }
      if (!managed && killed.length > 0) {
        return c.dim(t("svc.stoppedExternal", { title: svcObj.title }));
      }
      return c.dim(t("svc.stoppedMsg", { title: svcObj.title }));
    } catch (e) {
      return c.red(t("svc.stopFailed", { title: svcObj.title, message: (e as Error).message }));
    } finally {
      STOPPING.delete(svc);
    }
  }

  if (!svcObj.running) return c.yellow(t("svc.alreadyStopped", { title: svcObj.title }));
  if (STOPPING.has(svc)) return c.dim(t("svc.alreadyStopping", { title: svcObj.title }));
  STOPPING.add(svc);
  try {
    await svcObj.stop();
    return c.dim(t("svc.stoppedMsg", { title: svcObj.title }));
  } catch (e) {
    return c.red(t("svc.stopFailed", { title: svcObj.title, message: (e as Error).message }));
  } finally {
    STOPPING.delete(svc);
  }
}

export async function cmdSend(raw: string, message: string): Promise<string> {
  const svc = parseService(raw);
  if (!svc) return c.red(t("svc.unknown", { name: raw, list: SERVICE_NAMES.join(", ") }));
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

export async function cmdRestart(raw: string): Promise<string> {
  const svc = parseService(raw);
  if (!svc) return c.red(t("svc.unknown", { name: raw, list: SERVICE_NAMES.join(", ") }));
  // bds / db / qq：统一走 stop→start，确保外部实例也被清掉
  if (svc === "bds" || isNodeSvc(svc)) {
    const stopMsg = await cmdStop(svc);
    const startMsg = await cmdStart(svc);
    // 若 stop 已报错文案含「失败」，原样带回
    if (/失败|failed/i.test(stopMsg) && !/已停止|stopped|already/i.test(stopMsg)) {
      return stopMsg;
    }
    if (/失败|failed/i.test(startMsg)) return startMsg;
    return c.green(t("svc.restarted", { title: services[svc].title }));
  }
  const svcObj = services[svc];
  try {
    const outcome = await svcObj.restart();
    if (outcome.status === "skipped") {
      return c.yellow(t("svc.skipped", { title: svcObj.title, reason: outcome.reason }));
    }
    return c.green(t("svc.restarted", { title: svcObj.title }));
  } catch (e) {
    return c.red(t("svc.restartFailed", { title: svcObj.title, message: (e as Error).message }));
  }
}

export async function cmdStartAll(): Promise<string> {
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

export async function cmdStopAll(): Promise<string> {
  const { stopAll } = await import("./services.js");
  await stopAll();
  return c.dim(t("svc.allStopped"));
}

/**
 * BDS 更新：子进程始终 --no-start，由 sfmc 监督器接管启停与日志。
 * （updater 内 detached 自启会导致 REPL 丢 PID / 无 stdout）
 *
 * 不停服预操作：真正需要更新时由 updater 停服；已是最新则不影响正在跑的 BDS。
 * 更新成功后若未指定 --no-start，再由监督器 `start bds`（接管 PID + 日志管道）。
 */
export async function cmdUpdate(args: string[] = []): Promise<string> {
  const userNoStart = args.includes("--no-start");
  const checkOnly = args.includes("--check-only");
  const spawnArgs = userNoStart ? [...args] : [...args, "--no-start"];

  const bds = services.bds;
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
}
