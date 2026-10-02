import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { withMaintenanceLock } from "@sfmc-bds/management/node";
import { toManagementError, type OperationRecord } from "@sfmc-bds/management";
import { atomicJson } from "./tasks.js";
import { readJson, runProcess } from "./domain.js";
import { createSnapshot, runPnpm } from "./maintenance.js";
import { callDaemon, disconnectDaemonClient } from "../daemon/client.js";
import { ROOT } from "../runtime.js";
import { START_ORDER } from "../services.js";
import { readDaemonMeta } from "../daemon/paths.js";

/** 本进程在独立 Node 中常驻，平台换包不会删除其当前版本目录。 */
async function main() {
  const requestFile = process.argv[2];
  if (!requestFile) throw new Error("缺少维护任务文件");
  const request = readJson<{ id: string; target: string; running: string[]; previous: { entry: string } | null }>(requestFile, { id: "", target: "", running: [], previous: null });
  if (!/^[\w-]+$/.test(request.id) || !/^\d+\.\d+\.\d+$/.test(request.target)) throw new Error("非法维护请求");
  const recordFile = path.join(ROOT, ".sfmc", "operations", `${request.id}.json`);
  let record = readJson<OperationRecord>(recordFile, {} as OperationRecord);
  const phase = (name: string, message?: string) => {
    record = readJson<OperationRecord>(recordFile, record);
    const previous = record.phases.at(-1); if (previous?.status === "running") previous.status = "done";
    record.phases.push({ name, status: "running", ...(message ? { message } : {}) }); record.status = "running"; record.updatedAt = new Date().toISOString(); atomicJson(recordFile, record);
  };
  const runtime = path.join(ROOT, ".sfmc", "runtime");
  const release = path.join(runtime, "releases", `${request.target}-${request.id}`);
  const activeFile = path.join(runtime, "active.json");
  let switched = false;
  let preparedEntry = "";
  const waitExit = async (pid: number) => {
    const deadline = Date.now() + 30_000;
    for (;;) {
      let alive = true; try { process.kill(pid, 0); } catch (error) { alive = (error as NodeJS.ErrnoException).code !== "ESRCH"; }
      if (!alive) return;
      if (Date.now() > deadline) throw new Error("守护进程尚未退出，禁止切换平台");
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };
  const shutdown = async () => {
    const meta = readDaemonMeta();
    if (!meta) return;
    const status = await callDaemon("status");
    if (status.kind !== "status") throw new Error("无法确认当前服务状态");
    if (status.rows.some(row => row.running)) {
      const stopped = await callDaemon("maintenanceStop");
      if (stopped.kind !== "status" || stopped.rows.some(row => row.running)) throw new Error("服务没有优雅退出");
    }
    await callDaemon("shutdown"); disconnectDaemonClient(); await waitExit(meta.pid);
  };
  try {
    // 提交进程保存 workerPid 后才释放锁；等待接管，禁止竞态覆盖记录。
    await new Promise(resolve => setTimeout(resolve, 500));
    let acquired = false;
    for (let attempt = 0; attempt < 100 && !acquired; attempt++) {
      try {
        await withMaintenanceLock(ROOT, async () => {
          acquired = true;
          try {
          phase("prepare", `准备平台 ${request.target}`);
          fs.mkdirSync(release, { recursive: true });
          atomicJson(path.join(release, "package.json"), { private: true, dependencies: {} });
          await runPnpm(["add", "--ignore-workspace", "--prod", "--ignore-scripts", "--save-exact", `@sfmc-bds/sfmc@${request.target}`], release);
          const linked = path.join(release, "node_modules", "@sfmc-bds", "sfmc", "bin", "sfmc.mjs");
          if (!fs.existsSync(linked)) throw new Error("平台入口不存在");
          // pnpm 的依赖链接在真实包目录旁。从 junction 路径 createRequire 会找不到 @sfmc-bds/cli。
          const entry = fs.realpathSync(linked);
          // 发布的平台必须包含本次桌面所需管理协议。
          const resolver = createRequire(entry);
          const cli = path.join(path.dirname(resolver.resolve("@sfmc-bds/cli/package.json")), "dist", "management", "stdio.js");
          if (!fs.existsSync(cli)) throw new Error("最新平台尚未发布管理入口，保留当前部署；请先完成平台发版");
          const targetSdk = readJson<{ version: string }>(resolver.resolve("@sfmc-bds/sdk/package.json"), { version: "" }).version;
          const { satisfiesSdk } = await import(pathToFileURL(path.join(path.dirname(cli), "../..", "scripts/module-install/lib/semver.mjs")).href) as { satisfiesSdk: (version: string, range: string) => boolean };
          const modules = path.join(ROOT, "modules", "packages");
          if (fs.existsSync(modules)) for (const folder of fs.readdirSync(modules)) {
            const pkg = readJson<{ peerDependencies?: Record<string, string> }>(path.join(modules, folder, "package.json"), {});
            const manifest = readJson<{ sdk?: string }>(path.join(modules, folder, "sapi", "manifest.json"), {});
            const range = pkg.peerDependencies?.["@sfmc-bds/sdk"] ?? manifest.sdk;
            if (range && !satisfiesSdk(targetSdk, range)) throw new Error(`模块 ${folder} 与目标 SDK ${targetSdk} 不兼容 (${range})；保留固定版本及本地链接，已停止升级`);
          }
          preparedEntry = entry;
          phase("stop-services");
          const lock = readJson<{ nonce: string }>(path.join(ROOT, ".sfmc", "maintenance.lock"), { nonce: "" });
          process.env.SFMC_MAINTENANCE_TOKEN = lock.nonce;
          await shutdown();
          await createSnapshot(request.id, phase);
          phase("execute"); atomicJson(activeFile, { entry, version: request.target, pnpm: process.env.SFMC_PNPM_ENTRY }); switched = true;
          const launcher = path.join(runtime, "launcher.mjs");
          fs.writeFileSync(launcher, "import fs from 'node:fs'; import path from 'node:path'; import {pathToFileURL,fileURLToPath} from 'node:url'; const base=path.dirname(fileURLToPath(import.meta.url)); const active=JSON.parse(fs.readFileSync(path.join(base,'active.json'),'utf8')); process.env.SFMC_DAEMON_ENTRY=fileURLToPath(import.meta.url); process.env.SFMC_NODE_BINARY=process.execPath; if(active.pnpm) process.env.SFMC_PNPM_ENTRY=active.pnpm; await import(pathToFileURL(active.entry).href);\n");
          for (const key of Object.keys(process.env)) if (key.startsWith("SFMC_SERVICE_") && key.endsWith("_ENTRY") || ["SFMC_FETCH_MODULE", "SFMC_PLATFORM_VERSION"].includes(key)) delete process.env[key];
          process.env.SFMC_DAEMON_ENTRY = launcher;
          phase("verify");
          await runProcess(process.execPath, [launcher, "status"], ROOT);
          const handshake = await callDaemon("management", { request: { id: request.id, method: "handshake" } });
          if (handshake.kind !== "management" || !handshake.response.ok || (handshake.response.result as { platformVersion?: string }).platformVersion !== request.target) throw new Error("目标平台握手验证失败");
          phase("restore");
          for (const service of START_ORDER.filter(name => request.running.includes(name))) await callDaemon("start", { name: service });
          await new Promise(resolve => setTimeout(resolve, 3000));
          const status = await callDaemon("status");
          if (status.kind !== "status" || request.running.some(name => !status.rows.some(row => row.name === name && row.running))) throw new Error("此前运行的服务未全部恢复");
          record.result = { version: request.target, backupId: request.id }; record.status = "succeeded";
          } catch (error) {
            // 回退也必须在同一把锁内完成，防止其他客户端在入口切换期间写入。
            let rolledBack = false;
            if (switched && request.previous) {
              try { await shutdown(); atomicJson(activeFile, request.previous); rolledBack = true; }
              catch (rollbackError) { phase("rollback-blocked", `无法安全停止目标版本；保留入口和备份，不覆盖玩家数据: ${String(rollbackError)}`); }
            }
            record.result = { programRolledBack: rolledBack, backupId: request.id, dataRestoreRequired: switched, preparedEntry };
            throw error;
          }
        });
      } catch (error) {
        if (!acquired && (error as { code?: string }).code === "locked") { await new Promise(resolve => setTimeout(resolve, 200)); continue; }
        throw error;
      }
    }
    if (!acquired) throw new Error("无法接管维护锁");
  } catch (error) {
    record.status = "failed"; record.error = toManagementError(error);
    record.result ??= { programRolledBack: false, backupId: request.id, dataRestoreRequired: switched, preparedEntry };
  } finally {
    record.updatedAt = new Date().toISOString(); const last = record.phases.at(-1); if (last) last.status = record.status === "succeeded" ? "done" : "failed";
    atomicJson(recordFile, record);
    fs.rmSync(requestFile, { force: true });
    disconnectDaemonClient();
  }
}
void main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
