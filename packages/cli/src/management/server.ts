import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { EventEmitter } from "node:events";
import { LOG_TAIL_MAX, MANAGEMENT_PROTOCOL_VERSION, type ManagementRequest, type ManagementEvent } from "@sfmc-bds/management";
import { readQqBindings } from "@sfmc-bds/db-server/qq-bindings";
import { parseActivityFilter, parseActivityPaging, readActivityPage, readActivityStats } from "@sfmc-bds/db-server/activity-log";
import { ROOT, isRuntimeInitialized, spawnService } from "../runtime.js";
import { queryServicesRuntimeLocal, services, START_ORDER, SERVICE_NAMES, refreshServices, onServiceStateChange, type ServiceName } from "../services.js";
import { readDiskLogs, deleteStoredLogs, onLog } from "../logs.js";
import { cmdModuleEnable, cmdModuleDisable } from "../module-commands.js";
import { ensureCoreConfigs } from "@sfmc-bds/sdk/node/config";
import { TaskStore, atomicJson, type TaskContext } from "./tasks.js";
import { configFiles, readDocument, revision, saveDocument, validateDocument } from "./config.js";
import { listModules, searchModules, identifier, runFetch, readJson, listPacks, togglePack, readPackIcon, uninstallPack, setPackVersion, playerFiles, savePlayerPermissions, modulePlan, applyModulePlan, moduleInstallBlock } from "./domain.js";
import { attachmentPlan, platformVersion, withStoppedServices, launchPlatformUpdate, createBackup, restoreSnapshot, deleteSnapshot, verifyRunning } from "./maintenance.js";
import { startupPlan } from "./startup.js";
import { cmdPackBuild, cmdPackDeploy } from "../pack-lifecycle.js";
import { withMaintenanceLock } from "@sfmc-bds/management/node";
import { deploymentPreflight, deploymentPort } from "./deployment.js";
import { resolveBdsContext } from "../pack-lifecycle.js";
import { readRuntimeMetrics } from "./metrics-read.js";
import { applyScoreboard, readPublicObjectives, readScoreboard, setPublicObjective } from "./scoreboard.js";
import { LOCAL_CAPABILITIES } from "./local-methods.js";

import { importPacks, planPackImport, readImportFilenames } from "./pack-import.js";

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
/** 解析日志查询用的 ISO 时间。缺省返回 undefined。 */
function timeBound(value: unknown, label: string): Date | undefined {
  if (value === undefined) return undefined;
  const date = new Date(string(value, label));
  if (Number.isNaN(date.getTime())) throw new Error(`非法 ${label}`);
  return date;
}
function service(value: unknown): ServiceName { if (!SERVICE_NAMES.includes(value as ServiceName)) throw new Error("未知服务"); return value as ServiceName; }
async function rebuildModules() {
  const build = await cmdPackBuild([]); if (!build.ok) throw new Error(build.message);
  const deploy = await cmdPackDeploy([]); if (!deploy.ok) throw new Error(deploy.message);
  return { changed: true };
}

/** configs/db_config.json 中管理通道用到的字段 */
type DbConfig = { db_port?: number; http_auth?: string; dbDir?: string };
/** 读取业务库配置。使用场景：players.list 查在线快照与绑定，activity.* 定位业务库文件。 */
function dbConfig(): DbConfig {
  return readJson<DbConfig>(path.join(ROOT, "configs", "db_config.json"), {});
}
/** 业务库 SQLite 文件路径（dbDir 缺省为 data/sfmc_data.db，与 db-server 一致）。 */
function businessDatabase(cfg: DbConfig = dbConfig()): string {
  return path.resolve(ROOT, typeof cfg.dbDir === "string" && cfg.dbDir.trim() ? cfg.dbDir : "data/sfmc_data.db");
}
async function players() {
  const files = playerFiles(); const allowlist = readJson<unknown[]>(files.allowlist, []);
  const cfg = dbConfig();
  const database = businessDatabase(cfg);
  let data: { online?: { name: string }[]; updatedAt?: number } = {};
  try {
    const response = await fetch(`http://127.0.0.1:${cfg.db_port ?? 3001}/api/sfmc/status`, { headers: cfg.http_auth ? { authorization: `Bearer ${cfg.http_auth}` } : {}, signal: AbortSignal.timeout(5000) });
    if (response.ok) data = await response.json() as typeof data;
  } catch { /* 未连接时使用未知状态 */ }
  const fresh = typeof data.updatedAt === "number" && Date.now() - data.updatedAt < 60_000;
  return { players: (data.online ?? []).map(row => ({ name: row.name, xuid: "", online: fresh ? true : null })), updatedAt: data.updatedAt ? new Date(data.updatedAt).toISOString() : "", fresh, allowlist, permissions: readJson<unknown[]>(files.permissions, []), sfmcPermissions: readJson<unknown[]>(files.sfmcPermissions, []), bindings: readQqBindings(database) };
}
/**
 * 向托管服务的标准输入写入一行命令。
 * 使用场景：services.send（控制台页手动命令）与 scoreboard.apply（计分板编辑生成的命令）。
 */
async function sendServiceLine(name: ServiceName, message: string): Promise<void> {
  if (/[\r\n]/.test(message) || !message.trim()) throw new Error("一次只能发送一行命令");
  const target = services[name]; if (!target.proc?.stdin || !target.running) throw new Error("服务未托管或没有命令输入通道");
  await withMaintenanceLock(ROOT, async () => { target.proc!.stdin!.write(message + "\n"); });
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
    case "handshake": return { protocolVersion: MANAGEMENT_PROTOCOL_VERSION, platformVersion: platformVersion(), host: { os: process.platform === "win32" ? "windows" : process.platform, arch: process.arch, release: os.release() }, root: ROOT, capabilities: ["services", "logs", "logs-range", "modules", "config", "packs", "players", "updates", "operations", "metrics", "manual-restart", "manual-backup", "pack-import-plan", "pack-icons", "pack-uninstall", "backup-delete", "pack-import-batch", "pack-version", ...LOCAL_CAPABILITIES], daemonPid: process.pid, daemonStartedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(), initialized: deploymentInitialized() };
    case "events.subscribe": return { subscribed: true };
    case "services.list": return { rows: await queryServicesRuntimeLocal() };
    case "services.start": case "services.stop": case "services.restart": {
      const requestedNames = p.name === "all" ? [...START_ORDER] : [service(p.name)];
      const reloadConfig = p.reloadConfig === true;
      if (reloadConfig && (p.name !== "all" || request.method !== "services.restart")) throw new Error("重新读取配置需要重启全部服务");
      return store.submit(request.method, async context => {
        context.phase("execute");
        const rows = await queryServicesRuntimeLocal();
        const names = p.runningOnly === true
          ? requestedNames.filter(name => rows.some(row => row.name === name && row.running))
          : requestedNames;
        if (rows.some(row => names.includes(row.name) && row.running && row.ownership === "external") && request.method !== "services.start") throw new Error("外部进程无法安全停止，请通过原管理器操作");
        if (request.method !== "services.start") for (const name of [...names].reverse()) await services[name].stop(false, false);
        if (reloadConfig) {
          const after = await queryServicesRuntimeLocal();
          if (after.some(row => requestedNames.includes(row.name) && row.running)) throw new Error("服务未完全退出，已中止配置刷新");
          refreshServices();
        }
        if (request.method !== "services.stop") {
          if (!reloadConfig) {
            const after = await queryServicesRuntimeLocal();
            if (request.method === "services.restart" && after.some(row => names.includes(row.name) && row.running)) throw new Error("服务未完全退出，已中止重启");
            const stopped = names.filter(name => !after.some(row => row.name === name && row.running));
            if (stopped.length) refreshServices(stopped);
          }
          const outcomes = [];
          for (const name of names) outcomes.push({ name, ...(await services[name].start()) });
          await verifyRunning(outcomes.filter(row => row.status !== "skipped").map(row => row.name));
          return { outcomes };
        }
        return { stopped: names };
      });
    }
    case "services.send": {
      await sendServiceLine(service(p.name), string(p.message, "命令"));
      return { delivered: true };
    }
    case "logs.tail": {
      const since = timeBound(p.since, "开始时间");
      const until = timeBound(p.until, "结束时间");
      if (since && until && until < since) throw new Error("结束时间不能早于开始时间");
      const limit = Math.min(LOG_TAIL_MAX, Math.max(1, Number(p.limit) || 1000));
      const ranged = Boolean(since || until);
      const entries = readDiskLogs({
        ...(ranged ? {} : { limit }),
        ...(since ? { since } : {}),
        ...(until ? { until } : {}),
        ...(Array.isArray(p.sources) ? { sources: p.sources.map(value => string(value, "日志来源")) } : {}),
        ...(Array.isArray(p.levels) ? { levels: p.levels as ("info" | "warn" | "error")[] } : {}),
      });
      const truncated = entries.length > limit;
      return { entries: (truncated ? entries.slice(entries.length - limit) : entries).map(log => ({ ...log, time: log.time.toISOString() })), ...(truncated ? { truncated: true } : {}) };
    }
    case "logs.delete": {
      const since = timeBound(p.since, "开始时间");
      const until = timeBound(p.until, "结束时间");
      if (!since || !until) throw new Error("删除日志需要开始和结束时间");
      if (until < since) throw new Error("结束时间不能早于开始时间");
      const source = p.source === undefined ? undefined : string(p.source, "日志来源");
      if (source !== undefined && (source.length > 128 || /[\r\n]/.test(source))) throw new Error("非法日志来源");
      const text = p.text === undefined ? undefined : string(p.text, "日志正文");
      return deleteStoredLogs({ since, until, ...(source === undefined ? {} : { source }), ...(text === undefined ? {} : { text }) });
    }
    case "operations.list": return { operations: store.list().filter(row => !Array.isArray(p.statuses) || p.statuses.includes(row.status)).slice(0, Math.min(Number(p.limit) || 100, 200)) };
    case "operations.get": return { operation: store.get(string(p.operationId, "任务编号")) };
    case "modules.list": return listModules();
    case "modules.search": return searchModules(typeof p.query === "string" ? p.query : "");
    case "modules.install": {
      const id = identifier(p.id);
      const linked = (await listModules()).modules.find(row => row.id === id || row.folder === id)?.linked;
      if (linked) throw new Error("保留本地链接模块，不通过包安装或卸载覆盖开发目录");
      const block = await moduleInstallBlock(id);
      if (block) throw new Error(block);
      return store.submit(request.method, async context => {
        context.phase("download", "下载并安装模块，服务器保持运行");
        const args = ["install", id];
        if (typeof p.source === "string" && p.source) args.push("--from", p.source);
        await runFetch(args);
        context.phase("execute", "重建行为包，等待手动重启 BDS");
        return { ...(await rebuildModules()), restartRequired: true };
      });
    }
    case "modules.uninstall": case "modules.toggle": {
      const id = identifier(p.id);
      if (request.method !== "modules.toggle") {
        const linked = (await listModules()).modules.find(row => row.id === id || row.folder === id)?.linked;
        if (linked) throw new Error("保留本地链接模块，不通过包安装或卸载覆盖开发目录");
      }
      return store.submit(request.method, async context => {
        context.phase("execute", "更新模块并重建行为包，等待手动重启 BDS");
        if (request.method === "modules.toggle") {
          const result = await (p.enabled === true ? cmdModuleEnable([id]) : cmdModuleDisable([id])); if (!result.ok) throw new Error(result.message);
        } else {
          await runFetch(["uninstall", id]);
        }
        return { ...(await rebuildModules()), restartRequired: true };
      });
    }
    case "config.list": return { keys: [...configFiles().keys()] };
    case "config.read": return readDocument(string(p.key, "配置名称"));
    case "config.save": {
      const key = string(p.key, "配置名称"); const text = string(p.text, "配置内容"); const expected = string(p.revision, "配置版本");
      const document = readDocument(key); validateDocument(document, text);
      if (document.revision !== expected) throw Object.assign(new Error("配置已变更，请重新读取"), { code: "conflict" });
      return store.submit(request.method, async context => {
        context.phase("execute", "保存配置文件，不重启服务");
        saveDocument(key, expected, text);
        return { saved: true, revision: revision(text), restartRequired: true };
      });
    }
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
        }); } catch (error) { throw Object.assign(new Error(`${saved ? "文件已保存，运行时应用失败" : "配置未保存"}: ${error instanceof Error ? error.message : String(error)}`), { code: "io", details: { saved, applied: false } }); }
      });
    }
    case "packs.list": return listPacks();
    case "packs.icon": return readPackIcon(identifier(p.id));
    case "packs.import.plan": return planPackImport(identifier(p.filename));
    case "packs.import": {
      const names = readImportFilenames(p);
      return store.submit(request.method, async context => {
        context.phase("execute", names.length > 1 ? `导入 ${names.length} 个世界包，等待手动重启 BDS` : "导入世界包，等待手动重启 BDS");
        return importPacks(names, { force: p.force === true, ...(p.revision === undefined ? {} : { revision: string(p.revision, "导入计划版本") }) });
      });
    }
    case "packs.toggle": return store.submit(request.method, async context => {
      context.phase("execute", "保存世界包状态，等待手动重启 BDS");
      return togglePack(identifier(p.id), p.enabled === true);
    });
    case "packs.uninstall": return store.submit(request.method, async context => {
      context.phase("execute", "卸载世界包并移入回收站，等待手动重启 BDS");
      return uninstallPack(identifier(p.id));
    });
    case "packs.version": {
      const id = identifier(p.id);
      const version = p.version;
      return store.submit(request.method, async context => {
        context.phase("execute", "写入资源包版本，等待手动重启 BDS");
        return setPackVersion(id, version);
      });
    }
    case "players.list": return players();
    case "metrics.read": return readRuntimeMetrics(request.params);
    case "scoreboard.read": return readScoreboard(request.params);
    case "scoreboard.apply": return applyScoreboard(request.params, line => sendServiceLine("bds", line));
    case "scoreboard.publicObjectives": return readPublicObjectives();
    case "scoreboard.setPublicObjective": return setPublicObjective(request.params);
    case "activity.query": return readActivityPage(businessDatabase(), parseActivityFilter(p), parseActivityPaging(p));
    case "activity.stats": return readActivityStats(businessDatabase(), parseActivityFilter(p));
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
      if (p.kind === "modules") return store.submit(request.method, context => withStoppedServices(context, [...START_ORDER], async () => { const result = await applyModulePlan(Array.isArray(p.ids) ? p.ids.map(identifier) : []); await rebuildModules(); return result; }));
      if (p.kind === "bds") return store.submit(request.method, context => withStoppedServices(context, [...START_ORDER], () => bdsUpdate(context)));
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
    case "backups.create": return store.submit(request.method, context => createBackup(context));
    case "backups.restore": {
      if (p.confirmDataLoss !== true) throw new Error("恢复数据需要明确确认丢弃备份之后的变更");
      return store.submit(request.method, context => withStoppedServices(context, [...START_ORDER], () => restoreSnapshot(identifier(p.id), context.phase)));
    }
    case "backups.delete": return store.submit(request.method, async context => {
      context.phase("execute", "删除备份目录");
      return deleteSnapshot(identifier(p.id));
    });
    case "startup.plan": return startupPlan();
    default: throw Object.assign(new Error(`不支持的管理方法: ${request.method}`), { code: "unsupported" });
  }
}
