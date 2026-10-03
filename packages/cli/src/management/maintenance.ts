import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ROOT, isMonorepoLayout, isSourceCheckout } from "../runtime.js";
import { queryServicesRuntimeLocal, services, START_ORDER, type ServiceName } from "../services.js";
import { resolveBdsContext } from "../pack-lifecycle.js";
import { atomicJson, type TaskContext, type TaskStore } from "./tasks.js";
import { readJson, runProcess } from "./domain.js";
import type { AttachmentPlan } from "@sfmc-bds/management";
import { isDaemonServer } from "../daemon/role.js";
import { callDaemon } from "../daemon/client.js";
import { platformReleaseNotes } from "@sfmc-bds/management/node";

async function runtimeRows() {
  if (isDaemonServer()) return queryServicesRuntimeLocal();
  const result = await callDaemon("status");
  if (result.kind !== "status") throw new Error("无法读取守护进程服务状态");
  return result.rows;
}

const require = createRequire(import.meta.url);
export function platformVersion(): string {
  if (isMonorepoLayout(ROOT)) return readJson<{ version: string }>(path.join(ROOT, "packages", "meta", "package.json"), { version: "unknown" }).version;
  if (process.env.SFMC_PLATFORM_VERSION) return process.env.SFMC_PLATFORM_VERSION;
  const active = readJson<{ version?: string }>(path.join(ROOT, ".sfmc", "runtime", "active.json"), {});
  if (active.version) return active.version;
  const deployed = readJson<{ version?: string }>(path.join(ROOT, "node_modules", "@sfmc-bds", "sfmc", "package.json"), {});
  if (deployed.version) return deployed.version;
  try { return (require("@sfmc-bds/sfmc/package.json") as { version: string }).version; }
  catch { return (readJson<{ version: string }>(path.join(fileURLToPath(new URL("../../..", import.meta.url)), "package.json"), { version: "unknown" })).version; }
}
export async function attachmentPlan(includeReleaseNotes = true): Promise<AttachmentPlan> {
  const development = isMonorepoLayout(ROOT) || isSourceCheckout();
  const currentVersion = platformVersion();
  let targetVersion = currentVersion;
  if (!development) {
    const response = await fetch("https://registry.npmjs.org/@sfmc-bds%2fsfmc/latest", { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`平台版本检查失败 (${response.status})`);
    const metadata = await response.json() as { version?: string };
    if (!metadata.version || !/^\d+\.\d+\.\d+$/.test(metadata.version)) throw new Error("latest 没有指向有效的稳定平台版本");
    targetVersion = metadata.version;
  }
  const [rows, releaseNotes] = await Promise.all([runtimeRows(), includeReleaseNotes && !development ? platformReleaseNotes(targetVersion) : undefined]);
  return { currentVersion, targetVersion, development, upgradeRequired: !development && targetVersion !== currentVersion, externalServices: rows.filter(row => row.running && row.ownership === "external").map(row => row.name), steps: development ? ["保留源码工作区，连接当前开发部署"] : ["下载固定版本的平台依赖组合", "停止受影响服务并确认进程退出", "备份配置、模块、数据库与世界", "切换平台并验证", "恢复此前运行的服务"], ...(releaseNotes ? { releaseNotes } : {}) };
}
export async function stopForMaintenance(names: ServiceName[], phase: TaskContext["phase"]): Promise<ServiceName[]> {
  const before = await queryServicesRuntimeLocal();
  const affected = before.filter(row => names.includes(row.name) && row.running);
  if (affected.some(row => row.ownership === "external")) throw Object.assign(new Error("存在无法通过当前守护进程优雅停止的外部服务；请先通过原管理器停止后重新接入"), { code: "conflict" });
  phase("stop-services", "优雅停止并确认进程退出");
  const running = affected.map(row => row.name);
  for (const name of [...START_ORDER].reverse().filter(name => names.includes(name))) await services[name].stop(false, false);
  const after = await queryServicesRuntimeLocal();
  if (after.some(row => names.includes(row.name) && row.running)) throw new Error("服务未完全退出，已中止文件操作");
  return running;
}
export async function restoreRunning(names: ServiceName[], phase: TaskContext["phase"]) {
  phase("restore", "恢复维护前运行的服务");
  for (const name of START_ORDER.filter(name => names.includes(name))) {
    const result = await services[name].start();
    if (result.status === "skipped") throw new Error(`恢复 ${name} 失败: ${result.reason}`);
  }
  await verifyRunning(names);
}
export async function verifyRunning(names: ServiceName[]) {
  if (!names.length) return;
  await new Promise(resolve => setTimeout(resolve, 2000));
  for (const name of names) {
    if (!services[name].running || !services[name].pid) throw new Error(`${name} 启动后已退出`);
  }
  if (names.includes("db")) {
    const cfg = readJson<{ db_port?: number; http_auth?: string }>(path.join(ROOT, "configs", "db_config.json"), {});
    const response = await fetch(`http://127.0.0.1:${cfg.db_port ?? 3001}/api/sfmc/status`, { headers: cfg.http_auth ? { authorization: `Bearer ${cfg.http_auth}` } : {}, signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`DB 健康检查失败 (${response.status})`);
  }
}
function snapshotTargets() {
  const db = readJson<{ dbDir?: string }>(path.join(ROOT, "configs", "db_config.json"), {});
  const bds = resolveBdsContext().bdsRoot;
  return { configs: path.join(ROOT, "configs"), modules: path.join(ROOT, "modules"), data: path.dirname(path.resolve(ROOT, db.dbDir ?? "data/sfmc_data.db")), bds };
}
export async function createSnapshot(id: string, phase: TaskContext["phase"]) {
  phase("backup", "创建已停服的一致备份");
  const destination = path.join(ROOT, ".sfmc", "backups", id);
  fs.mkdirSync(destination, { recursive: true });
  const targets = snapshotTargets();
  for (const target of Object.values(targets)) {
    const absolute = path.resolve(target);
    if (absolute === path.parse(absolute).root || absolute === path.resolve(ROOT) || destination.startsWith(absolute + path.sep)) throw new Error("备份目标包含实例根目录或备份目录，已中止");
  }
  for (const [key, target] of Object.entries(targets)) {
    if (fs.existsSync(target)) await fs.promises.cp(target, path.join(destination, key), { recursive: true, dereference: false });
  }
  atomicJson(path.join(destination, "manifest.json"), { createdAt: new Date().toISOString(), targets, complete: true });
  return destination;
}
export async function restoreSnapshot(id: string, phase: TaskContext["phase"]) {
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) throw new Error("非法备份编号");
  const source = path.join(ROOT, ".sfmc", "backups", id);
  const manifest = readJson<{ complete: boolean; targets: Record<string, string> }>(path.join(source, "manifest.json"), { complete: false, targets: {} });
  if (!manifest.complete) throw new Error("备份不完整，禁止恢复");
  const targets = snapshotTargets();
  phase("restore-data", "按用户明确选择恢复配置、模块、数据库和世界");
  for (const [key, target] of Object.entries(targets)) {
    if (path.resolve(manifest.targets[key] ?? "") !== path.resolve(target)) throw new Error("备份目标与当前部署不一致");
    const saved = path.join(source, key);
    if (!fs.existsSync(saved)) continue;
    const absolute = path.resolve(target);
    if (absolute === path.parse(absolute).root || absolute === path.resolve(ROOT) || fs.lstatSync(saved).isSymbolicLink()) throw new Error("不安全的恢复目标");
    await fs.promises.rm(absolute, { recursive: true, force: true });
    await fs.promises.cp(saved, absolute, { recursive: true, dereference: false });
  }
  return { restored: id };
}
/** 只回退程序内容，世界、玩家权限和数据库始终保留在当前状态。 */
async function restoreProgramSnapshot(id: string, kind: "modules" | "bds") {
  const source = path.join(ROOT, ".sfmc", "backups", id);
  const manifest = readJson<{ complete: boolean; targets: Record<string, string> }>(path.join(source, "manifest.json"), { complete: false, targets: {} });
  const targets = snapshotTargets();
  if (!manifest.complete || path.resolve(manifest.targets[kind] ?? "") !== path.resolve(targets[kind])) throw new Error("程序备份不完整或目标不匹配");
  const saved = path.join(source, kind);
  if (kind === "modules") {
    if (!fs.existsSync(saved)) return;
    await fs.promises.rm(targets.modules, { recursive: true, force: true });
    await fs.promises.cp(saved, targets.modules, { recursive: true, dereference: false });
    return;
  }
  const cfg = readJson<{ preserve?: string[] }>(path.join(ROOT, "configs", "bds_updater.json"), {});
  const preserved = new Set(["worlds", "config", "server.properties", "allowlist.json", "whitelist.json", "permissions.json", ...(cfg.preserve ?? []).map(name => name.split(/[\\/]/)[0]!)]);
  if (!fs.existsSync(saved)) throw new Error("缺少原 BDS 程序备份");
  const target = path.resolve(targets.bds);
  if (target === path.parse(target).root || target === path.resolve(ROOT)) throw new Error("不安全的程序回退目标");
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(target)) if (!preserved.has(entry)) await fs.promises.rm(path.join(target, entry), { recursive: true, force: true });
  for (const entry of fs.readdirSync(saved)) if (!preserved.has(entry)) await fs.promises.cp(path.join(saved, entry), path.join(target, entry), { recursive: true, dereference: false });
}
export async function withStoppedServices<T>(context: TaskContext, names: ServiceName[], action: () => Promise<T>, backup = true, rollbackPrograms?: "modules" | "bds"): Promise<T> {
  const running = await stopForMaintenance(names, context.phase);
  try {
    if (backup) await createSnapshot(context.id, context.phase);
    context.phase("execute");
    const result = await action();
    context.phase("verify");
    await restoreRunning(running, context.phase);
    return result;
  } catch (error) {
    // 失败后保持停服，不猜测未知数据迁移是否可以安全恢复运行。
    for (const name of [...START_ORDER].reverse().filter(name => running.includes(name))) await services[name].stop(false, false).catch(() => {});
    let programRolledBack = false;
    let rollbackError: string | undefined;
    if (rollbackPrograms) {
      context.phase("rollback-program", "回退程序版本，保留当前玩家数据");
      try { await restoreProgramSnapshot(context.id, rollbackPrograms); programRolledBack = true; }
      catch (failure) { rollbackError = String(failure); }
    }
    throw Object.assign(new Error(`维护失败，服务保持停止；备份编号 ${context.id}: ${error instanceof Error ? error.message : String(error)}`), { code: "io", details: { backupId: context.id, programRolledBack, dataRestoreRequired: Boolean(rollbackPrograms), ...(rollbackError ? { rollbackError } : {}), ...((error as { details?: object }).details ?? {}) } });
  }
}
export async function launchPlatformUpdate(store: TaskStore, context: TaskContext, target: string) {
  if (isMonorepoLayout(ROOT)) throw new Error("源码部署不覆盖工作区；请使用正常开发发布流程");
  if (!/^\d+\.\d+\.\d+$/.test(target)) throw new Error("需要固定稳定版本");
  const rows = await runtimeRows();
  if (rows.some(row => row.running && row.ownership === "external")) throw new Error("外部服务必须先通过原管理器优雅停止");
  const request = path.join(ROOT, ".sfmc", "operations", `${context.id}.request.json`);
  const previous = readJson(path.join(ROOT, ".sfmc", "runtime", "active.json"), { entry: fs.existsSync(path.join(ROOT, "node_modules", "@sfmc-bds", "sfmc", "bin", "sfmc.mjs")) ? path.join(ROOT, "node_modules", "@sfmc-bds", "sfmc", "bin", "sfmc.mjs") : process.env.SFMC_DAEMON_ENTRY, version: platformVersion() });
  atomicJson(request, { root: ROOT, id: context.id, target, running: rows.filter(row => row.running).map(row => row.name), previous });
  const entry = fileURLToPath(new URL("./platform-worker.js", import.meta.url));
  fs.mkdirSync(path.join(ROOT, ".sfmc", "logs"), { recursive: true });
  const fd = fs.openSync(path.join(ROOT, ".sfmc", "logs", "maintenance.log"), "a");
  const child = spawn(process.execPath, [entry, request], { cwd: ROOT, env: { ...process.env, SFMC_ROOT: ROOT }, detached: true, windowsHide: true, stdio: ["ignore", fd, fd] });
  fs.closeSync(fd);
  await new Promise<void>((resolve, reject) => { child.once("spawn", resolve); child.once("error", reject); });
  child.unref();
  const record = store.get(context.id) as ReturnType<TaskStore["get"]> & { workerPid?: number };
  record.status = "running"; if (child.pid) record.workerPid = child.pid;
  store.save(record);
  return { detached: true };
}
export async function runPnpm(args: string[], cwd: string) {
  const script = process.env.SFMC_PNPM_ENTRY;
  if (script) return runProcess(process.execPath, [script, ...args], cwd);
  const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const crossSpawn = require("cross-spawn") as typeof spawn;
  await new Promise<void>((resolve, reject) => {
    const child = crossSpawn(command, args, { cwd, env: process.env, windowsHide: true, stdio: "ignore" });
    child.on("error", reject); child.on("close", code => code === 0 ? resolve() : reject(new Error(`pnpm 执行失败 (${code})`)));
  });
}
