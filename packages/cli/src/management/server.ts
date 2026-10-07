import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { EventEmitter } from "node:events";
import { MANAGEMENT_PROTOCOL_VERSION, type ManagementRequest, type ManagementEvent } from "@sfmc-bds/management";
import { ROOT, isRuntimeInitialized, spawnService } from "../runtime.js";
import { queryServicesRuntimeLocal, services, START_ORDER, SERVICE_NAMES, refreshServices, onServiceStateChange, type ServiceName } from "../services.js";
import { readDiskLogs, onLog } from "../logs.js";
import { cmdModuleEnable, cmdModuleDisable } from "../module-commands.js";
import { ensureCoreConfigs } from "@sfmc-bds/sdk/node/config";
import { TaskStore, atomicJson, type TaskContext } from "./tasks.js";
import { configFiles, readDocument, saveDocument, validateDocument } from "./config.js";
import { listModules, searchModules, identifier, runFetch, readJson, listPacks, togglePack, importPack, playerFiles, savePlayerPermissions, modulePlan, applyModulePlan } from "./domain.js";
import { attachmentPlan, platformVersion, withStoppedServices, launchPlatformUpdate, restoreSnapshot, verifyRunning } from "./maintenance.js";
import { startupPlan } from "./startup.js";
import { cmdPackBuild, cmdPackDeploy } from "../pack-lifecycle.js";
import { withMaintenanceLock } from "@sfmc-bds/management/node";
import { deploymentPreflight, deploymentPort } from "./deployment.js";
import { resolveBdsContext } from "../pack-lifecycle.js";

const events = new EventEmitter();
/** 空目录也要能完成握手，供桌面初始化向导继续；旧部署仍识别已有 BDS。 */
function deploymentInitialized(): boolean {
  if (isRuntimeInitialized()) return true;
  const config = readJson<{ bds_path?: string }>(path.join(ROOT, "configs", "bds_updater.json"), {});
  if (!config.bds_path) return false;
  return fs.existsSync(path.join(resolveBdsContext().bdsRoot, process.platform === "win32" ? "bedrock_server.exe" : "bedrock_server"));
}
let tasks: TaskStore | undefined;
export function managementTasks() {
  if (!tasks) {
    tasks = new TaskStore(ROOT);
    tasks.on("operation", payload => events.emit("event", { type: "event", event: "operation", instanceId: ROOT, payload }));
    onLog(log => events.emit("event", { type: "event", event: "log", instanceId: ROOT, payload: { ...log, time: log.time.toISOString() } }));
    onServiceStateChange(payload => events.emit("event", { type: "event", event: "serviceState", instanceId: ROOT, payload }));
  }
  return tasks;
}
export function onManagementEvent(callback: (event: ManagementEvent) => void) { events.on("event", callback); return () => events.off("event", callback); }
function params(request: ManagementRequest): Record<string, unknown> {
  if (request.params === undefined) return {};
  if (!request.params || typeof request.params !== "object" || Array.isArray(request.params)) throw new Error("参数必须为对象");
  return request.params as Record<string, unknown>;
}
function string(value: unknown, label: string) { if (typeof value !== "string" || value.length > 2 * 1024 * 1024) throw new Error(`非法 ${label}`); return value; }
function service(value: unknown): ServiceName { if (!SERVICE_NAMES.includes(value as ServiceName)) throw new Error("未知服务"); return value as ServiceName; }
async function rebuildModules() {
  const build = await cmdPackBuild([]); if (!build.ok) throw new Error(build.message);
  const deploy = await cmdPackDeploy([]); if (!deploy.ok) throw new Error(deploy.message);
  return { changed: true };
}
async function players() {
  const files = playerFiles(); const allowlist = readJson<unknown[]>(files.allowlist, []);
  const cfg = readJson<{ db_port?: number; http_auth?: string }>(path.join(ROOT, "configs", "db_config.json"), {});
  let data: { online?: { name: string }[]; updatedAt?: number } = {};
  try {
    const response = await fetch(`http://127.0.0.1:${cfg.db_port ?? 3001}/api/sfmc/status`, { headers: cfg.http_auth ? { authorization: `Bearer ${cfg.http_auth}` } : {}, signal: AbortSignal.timeout(5000) });
    if (response.ok) data = await response.json() as typeof data;
  } catch { /* 未连接时使用未知状态 */ }
  const fresh = typeof data.updatedAt === "number" && Date.now() - data.updatedAt < 60_000;
  return { players: (data.online ?? []).map(row => ({ name: row.name, xuid: "", online: fresh ? true : null })), updatedAt: data.updatedAt ? new Date(data.updatedAt).toISOString() : "", fresh, allowlist, permissions: readJson<unknown[]>(files.permissions, []), sfmcPermissions: readJson<unknown[]>(files.sfmcPermissions, []) };
}
async function bdsUpdate(context: TaskContext, checkOnly = false) {
  context.phase("download", checkOnly ? "检查 BDS 更新" : "更新 BDS");
  const args = checkOnly ? ["--check-only", "--no-notify"] : ["--no-start", "--no-notify"];
  let output = "";
  await new Promise<void>((resolve, reject) => {
    const child = spawnService("update", args, { stdio: "pipe", cwd: ROOT });
    for (const stream of [child.stdout, child.stderr]) stream?.on("data", chunk => { output = (output + String(chunk)).slice(-64_000); });
    child.on("error", reject); child.on("close", code => code === 0 ? resolve() : reject(new Error(`BDS 更新失败 (${code})`)));
  });
  return { checked: checkOnly, updated: /SFMC_UPDATE_RESULT=deployed/.test(output), currentVersion: /CURRENT=([^\r\n]+)/.exec(output)?.[1] ?? "unknown", latestVersion: /LATEST=([^\r\n]+)/.exec(output)?.[1] ?? "unknown", result: /SFMC_UPDATE_RESULT=([^\r\n]+)/.exec(output)?.[1] ?? "unknown" };
}
export async function dispatchManagement(request: ManagementRequest): Promise<unknown> {
  const p = params(request); const store = managementTasks();
  switch (request.method) {
    case "handshake": return { protocolVersion: MANAGEMENT_PROTOCOL_VERSION, platformVersion: platformVersion(), host: { os: process.platform === "win32" ? "windows" : process.platform, arch: process.arch, release: os.release() }, root: ROOT, capabilities: ["services", "logs", "modules", "config", "packs", "players", "updates", "operations", "metrics"], daemonPid: process.pid, daemonStartedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(), initialized: deploymentInitialized() };
    case "events.subscribe": return { subscribed: true };
    case "services.list": return { rows: await queryServicesRuntimeLocal() };
    case "services.start": case "services.stop": case "services.restart": {
      const names = p.name === "all" ? [...START_ORDER] : [service(p.name)];
      return store.submit(request.method, async context => {
        context.phase("execute");
        const rows = await queryServicesRuntimeLocal();
        if (rows.some(row => names.includes(row.name) && row.running && row.ownership === "external") && request.method !== "services.start") throw new Error("外部进程无法安全停止，请通过原管理器操作");
        if (request.method !== "services.start") for (const name of [...names].reverse()) await services[name].stop(false, false);
        if (request.method !== "services.stop") {
          const outcomes = [];
          for (const name of names) outcomes.push({ name, ...(await services[name].start()) });
          await verifyRunning(outcomes.filter(row => row.status !== "skipped").map(row => row.name));
          return { outcomes };
        }
        return { stopped: names };
      });
    }
    case "services.send": {
      const name = service(p.name); const message = string(p.message, "命令");
      if (/[\r\n]/.test(message) || !message.trim()) throw new Error("一次只能发送一行命令");
      const target = services[name]; if (!target.proc?.stdin || !target.running) throw new Error("服务未托管或没有命令输入通道");
      return withMaintenanceLock(ROOT, async () => { target.proc!.stdin!.write(message + "\n"); return { delivered: true }; });
    }
    case "logs.tail": return { entries: readDiskLogs({ limit: Math.min(5000, Math.max(1, Number(p.limit) || 1000)), ...(Array.isArray(p.sources) ? { sources: p.sources.map(value => string(value, "日志来源")) } : {}), ...(Array.isArray(p.levels) ? { levels: p.levels as ("info" | "warn" | "error")[] } : {}) }).map(log => ({ ...log, time: log.time.toISOString() })) };
    case "operations.list": return { operations: store.list().filter(row => !Array.isArray(p.statuses) || p.statuses.includes(row.status)).slice(0, Math.min(Number(p.limit) || 100, 200)) };
    case "operations.get": return { operation: store.get(string(p.operationId, "任务编号")) };
    case "modules.list": return listModules();
    case "modules.search": return searchModules(typeof p.query === "string" ? p.query : "");
    case "modules.install": case "modules.uninstall": case "modules.toggle": {
      const id = identifier(p.id);
      if (request.method !== "modules.toggle") {
        const linked = (await listModules()).modules.find(row => row.id === id || row.folder === id)?.linked;
        if (linked) throw new Error("保留本地链接模块，不通过包安装或卸载覆盖开发目录");
      }
      return store.submit(request.method, context => withStoppedServices(context, [...START_ORDER], async () => {
        if (request.method === "modules.toggle") {
          const result = await (p.enabled === true ? cmdModuleEnable([id]) : cmdModuleDisable([id])); if (!result.ok) throw new Error(result.message);
        } else {
          const args = [request.method === "modules.install" ? "install" : "uninstall", id];
          if (request.method === "modules.install" && typeof p.source === "string" && p.source) args.push("--from", p.source);
          await runFetch(args);
        }
        return rebuildModules();
      }, true, "modules"));
    }
    case "config.list": return { keys: [...configFiles().keys()] };
    case "config.read": return readDocument(string(p.key, "配置名称"));
    case "config.apply": {
      const key = string(p.key, "配置名称"); const text = string(p.text, "配置内容"); const expected = string(p.revision, "配置版本");
      const document = readDocument(key); validateDocument(document, text);
      if (document.revision !== expected) throw Object.assign(new Error("配置已变更，请重新读取"), { code: "conflict" });
      return store.submit(request.method, async context => {
        let saved = false;
        try { return await withStoppedServices(context, [...START_ORDER], async () => {
        saveDocument(key, expected, text); context.phase("apply", "文件已保存，正在应用运行配置");
        saved = true;
        refreshServices(); return { saved: true, revision: readDocument(key).revision, applied: true };
        }); } catch (error) { throw Object.assign(new Error(`${saved ? "文件已保存，运行时应用失败" : "配置未保存"}: ${error instanceof Error ? error.message : String(error)}`), { code: "io", details: { saved, applied: false, backupId: context.id } }); }
      });
    }
    case "packs.list": return listPacks();
    case "packs.import": return store.submit(request.method, context => withStoppedServices(context, [...START_ORDER], () => importPack(identifier(p.filename))));
    case "packs.toggle": return store.submit(request.method, context => withStoppedServices(context, [...START_ORDER], () => togglePack(identifier(p.id), p.enabled === true)));
    case "players.list": return players();
    case "metrics.read": {
      const cfg = readJson<{ db_port?: number; http_auth?: string }>(path.join(ROOT, "configs", "db_config.json"), {});
      try {
        const response = await fetch(`http://127.0.0.1:${cfg.db_port ?? 3001}/api/sfmc/metrics`, { headers: cfg.http_auth ? { authorization: `Bearer ${cfg.http_auth}` } : {}, signal: AbortSignal.timeout(10_000) });
        if (!response.ok) throw new Error(`运行指标读取失败 (${response.status})`);
        return response.json();
      } catch (error) {
        const detail = error instanceof Error ? `${error.message} ${String(error.cause ?? "")}` : String(error);
        // 数据服务没开时 fetch 会抛网络错误；界面用 note 展示，而不是整页失败。
        if (/fetch failed|ECONNREFUSED|ENOTFOUND|AbortError|TimeoutError|timed out/i.test(detail)) {
          return { fresh: false, updatedAt: null, current: null, history: [], host: null, processes: null, resourcesUpdatedAt: null, note: "数据服务未运行，暂时没有运行指标" };
        }
        throw error;
      }
    }
    case "players.apply": return store.submit(request.method, context => withStoppedServices(context, [...START_ORDER], async () => savePlayerPermissions(string(p.kind, "权限类型"), p.entries)));
    case "attachment.plan": return attachmentPlan();
    case "attachment.apply": return store.submit(request.method, async context => {
      const plan = await attachmentPlan(false);
      if (p.targetVersion !== undefined && p.targetVersion !== plan.targetVersion) throw Object.assign(new Error("目标版本已变更，请重新检查更新日志后确认"), { code: "conflict" });
      if (plan.externalServices.length) throw new Error("无法可靠迁移外部进程；请先通过原管理器优雅停服");
      if (plan.upgradeRequired) return launchPlatformUpdate(store, context, plan.targetVersion);
      return { attached: true, version: plan.currentVersion, development: plan.development };
    });
    case "updates.check": {
      const results = await Promise.allSettled([attachmentPlan(), modulePlan(), bdsUpdate({ id: "check", phase: () => {} }, true)]);
      return Object.fromEntries(results.map((result, index) => [["platform", "modules", "bds"][index], result.status === "fulfilled" ? result.value : { error: String(result.reason) }]));
    }
    case "updates.run": {
      if (p.kind === "platform") return store.submit(request.method, async context => { const plan = await attachmentPlan(false); if (p.targetVersion !== undefined && p.targetVersion !== plan.targetVersion) throw Object.assign(new Error("目标版本已变更，请重新检查更新日志后确认"), { code: "conflict" }); return plan.upgradeRequired ? launchPlatformUpdate(store, context, plan.targetVersion) : { upToDate: true, version: plan.currentVersion }; });
      if (p.kind === "modules") return store.submit(request.method, context => withStoppedServices(context, [...START_ORDER], async () => { const result = await applyModulePlan(Array.isArray(p.ids) ? p.ids.map(identifier) : []); await rebuildModules(); return result; }, true, "modules"));
      if (p.kind === "bds") return store.submit(request.method, context => withStoppedServices(context, [...START_ORDER], () => bdsUpdate(context), true, "bds"));
      throw new Error("未知更新类型");
    }
    case "deployment.create": {
      if (p.acceptEula !== true) throw new Error("创建部署前必须确认 BDS 使用条款");
      return store.submit(request.method, async context => {
        if (isRuntimeInitialized()) throw new Error("目录已经初始化，不覆盖已有部署");
        const ports = { db: deploymentPort(p.dbPort, 3001), bds: deploymentPort(p.bdsPort, 19132), bds6: deploymentPort(p.bdsPort6, 19133) };
        context.phase("preflight", "检查目录、磁盘空间和 TCP／UDP 端口"); await deploymentPreflight(ports);
        context.phase("prepare"); ensureCoreConfigs(ROOT, ["db_config", "qq_config", "bds_updater", "permissions", "qq_link"]);
        const updater = path.join(ROOT, "configs", "bds_updater.json");
        atomicJson(updater, { ...readJson(updater, {}), bds_path: "BDS", backup_dir: "backups" });
        const dbFile = path.join(ROOT, "configs", "db_config.json"); atomicJson(dbFile, { ...readJson(dbFile, {}), db_port: ports.db });
        fs.mkdirSync(path.join(ROOT, "modules", "packages"), { recursive: true });
        await bdsUpdate(context);
        const properties = path.join(ROOT, "BDS", "server.properties");
        let text = fs.readFileSync(properties, "utf8");
        for (const [key, port] of [["server-port", ports.bds], ["server-portv6", ports.bds6]] as const) text = text.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${port}`);
        fs.writeFileSync(properties, text);
        await rebuildModules();
        refreshServices(); context.phase("start");
        const started: ServiceName[] = [];
        try { for (const name of START_ORDER) { const result = await services[name].start(); if (result.status !== "skipped") started.push(name); } await verifyRunning(started); }
        catch (error) { for (const name of [...START_ORDER].reverse()) await services[name].stop(false, false).catch(() => {}); throw error; }
        atomicJson(path.join(ROOT, "configs", "runtime.json"), { ...readJson(path.join(ROOT, "configs", "runtime.json"), {}), initialized_at: new Date().toISOString() });
        return { created: true, rows: await queryServicesRuntimeLocal() };
      });
    }
    case "backups.list": { const directory = path.join(ROOT, ".sfmc", "backups"); return { backups: fs.existsSync(directory) ? fs.readdirSync(directory).filter(id => fs.existsSync(path.join(directory, id, "manifest.json"))) : [] }; }
    case "backups.restore": {
      if (p.confirmDataLoss !== true) throw new Error("恢复数据需要明确确认丢弃备份之后的变更");
      return store.submit(request.method, context => withStoppedServices(context, [...START_ORDER], () => restoreSnapshot(identifier(p.id), context.phase)));
    }
    case "startup.plan": return startupPlan();
    default: throw Object.assign(new Error(`不支持的管理方法: ${request.method}`), { code: "unsupported" });
  }
}
