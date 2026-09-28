/**
 * 模块随 BDS 启动的附属进程。
 * 使用场景：开服前扫描 modules/packages/<id>/sidecar.json。
 * 目前 Bluemap 用它拉起地图进程；日志正文由脚本打进 BDS，这里只报告启动和退出。
 */

import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

/** 模块包根目录里的 sidecar.json。 */
interface SidecarSpec {
  id: string;
  /** 相对模块包根目录的 Node 入口。 */
  entry: string;
  /** 相对 SFMC 根目录的配置文件。缺省不判断开关。 */
  configFile?: string;
  /** 配置里的点路径。值为 false 时不启动。缺省视为开启。 */
  when?: string;
}

/** 本轮 BDS 拉起的附属进程。停服时只结束这些，不碰用户另外开的进程。 */
const children = new Map<string, ChildProcess>();

function readJson(file: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** 沿点路径取值。中途不是对象则返回 undefined。 */
function readPath(source: Record<string, unknown>, dotted: string): unknown {
  let current: unknown = source;
  for (const part of dotted.split(".")) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function isEnabled(root: string, spec: SidecarSpec): boolean {
  if (!spec.when || !spec.configFile) return true;
  const config = readJson(path.join(root, spec.configFile));
  if (!config) return true;
  const flag = readPath(config, spec.when);
  return flag !== false;
}

function configuredPort(root: string, spec: SidecarSpec): number {
  if (!spec.configFile) return 0;
  const config = readJson(path.join(root, spec.configFile));
  const port = config?.port;
  return typeof port === "number" && port > 0 && port < 65536 ? port : 0;
}

/** 端口已有进程监听时不再启动第二个。 */
function portOpen(port: number): Promise<boolean> {
  if (!port) return Promise.resolve(false);
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    const done = (open: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(open);
    };
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.setTimeout(500, () => done(false));
  });
}

function loadSpecs(root: string): Array<{ spec: SidecarSpec; dir: string }> {
  const packagesDir = path.join(root, "modules", "packages");
  if (!fs.existsSync(packagesDir)) return [];
  const found: Array<{ spec: SidecarSpec; dir: string }> = [];
  for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    const dir = path.join(packagesDir, entry.name);
    const file = path.join(dir, "sidecar.json");
    if (!fs.existsSync(file)) continue;
    const raw = readJson(file);
    if (!raw || typeof raw.id !== "string" || typeof raw.entry !== "string") continue;
    const lock = readJson(path.join(root, "modules", "module-lock.json"));
    const modules = lock?.modules && typeof lock.modules === "object" ? (lock.modules as Record<string, unknown>) : {};
    const row = modules[raw.id];
    const enabled = !row || typeof row !== "object" || (row as { enabled?: boolean }).enabled !== false;
    if (!enabled) continue;
    const spec: SidecarSpec = { id: raw.id, entry: raw.entry };
    if (typeof raw.configFile === "string") spec.configFile = raw.configFile;
    if (typeof raw.when === "string") spec.when = raw.when;
    found.push({ spec, dir });
  }
  return found;
}

/**
 * 在 BDS 进程拉起之前启动附属进程。
 * 使用场景：services.ts 里 bds 的 start，在 beforeStart 之后调用。
 */
export async function startModuleSidecars(
  root: string,
  log: (line: string, stream: "stdout" | "stderr") => void
): Promise<void> {
  for (const { spec, dir } of loadSpecs(root)) {
    if (children.has(spec.id)) continue;
    if (!isEnabled(root, spec)) continue;
    const entry = path.join(dir, spec.entry);
    if (!fs.existsSync(entry)) {
      log(`[${spec.id}] 未找到附属进程入口: ${entry}`, "stderr");
      continue;
    }
    const port = configuredPort(root, spec);
    if (await portOpen(port)) {
      log(`[${spec.id}] 端口 ${port} 已在监听，跳过启动。`, "stdout");
      continue;
    }
    const child = spawn(process.execPath, [entry], {
      cwd: dir,
      env: { ...process.env, SFMC_ROOT: root },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    children.set(spec.id, child);
    log(`[${spec.id}] 已随服务器启动附属进程 (PID ${child.pid ?? 0})`, "stdout");
    child.on("exit", (code) => {
      if (children.get(spec.id) === child) children.delete(spec.id);
      log(`[${spec.id}] 附属进程退出 (code ${code ?? "?"})`, code === 0 ? "stdout" : "stderr");
    });
    child.on("error", (err) => {
      log(`[${spec.id}] 附属进程启动失败: ${err.message}`, "stderr");
    });
  }
}

/**
 * 结束本轮由开服拉起的附属进程。
 * 使用场景：BDS 服务 cleanup 时调用。用户自己另开的地图进程不会被关掉。
 */
export function stopModuleSidecars(): void {
  for (const [id, child] of children) {
    children.delete(id);
    try {
      child.kill();
    } catch {
      /* 进程已经结束时忽略。 */
    }
  }
}
