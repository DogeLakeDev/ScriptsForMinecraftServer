/**
 * client.ts — CLI 侧守护进程客户端：ensureDaemon + RPC + 日志订阅
 *
 * 若 `.sfmc/daemon.json` 对应进程不在或管道不可连，则 spawn `sfmc --daemon`
 *（detached + windowsHide），再轮询直到 ping 成功。
 */

import { isProcessAlive } from "@sfmc-bds/bds-tools/process-probe";
import { logsDir } from "@sfmc-bds/sdk/node/config";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import process from "node:process";
import { EventEmitter } from "node:events";
import { ingestRemoteLog } from "../logs.js";
import { ROOT } from "../runtime.js";
import type { ServiceStateEvent, ServiceStatus } from "../services.js";
import {
  clearDaemonMeta,
  daemonLogPath,
  daemonMetaPath,
  readDaemonMeta,
  type DaemonMeta,
} from "./paths.js";
import type {
  DaemonEvent,
  DaemonFrame,
  DaemonMethod,
  DaemonParams,
  DaemonRequest,
  DaemonResult,
} from "./protocol.js";
import { isLogPayload } from "./protocol.js";
import { isDaemonServer } from "./role.js";
import { fileURLToPath } from "node:url";
import type { ManagementEvent } from "@sfmc-bds/management";
import { maintenanceToken } from "@sfmc-bds/management/node";

export function onDaemonManagementEvent(callback: (event: ManagementEvent) => void): () => void {
  remoteStateBus.on("management", callback);
  return () => { remoteStateBus.off("management", callback); };
}
export function disconnectDaemonClient(): void { shared?.disconnect(); shared = null; }

/** 单次 RPC 默认超时（毫秒） */
const CALL_TIMEOUT_MS = 120_000;
/** ensureDaemon 等待守护进程就绪的总时长 */
const READY_TIMEOUT_MS = 15_000;
/** 轮询间隔 */
const READY_POLL_MS = 150;

/** 共享连接（同一 CLI 进程复用） */
let shared: DaemonConnection | null = null;

/** 本地状态事件总线：把 daemon 推送的 state 转给 CLI 侧 onServiceStateChange 订阅者 */
const remoteStateBus = new EventEmitter();

/**
 * 订阅守护进程推送的服务启停事件（CLI 进程用）。
 * 使用场景：REPL 根据 running 集合刷新发送目标 / 服务窗，无需本地持有 ChildProcess。
 */
export function onRemoteServiceStateChange(fn: (ev: ServiceStateEvent) => void): () => void {
  remoteStateBus.on("state", fn);
  return () => {
    remoteStateBus.off("state", fn);
  };
}

/** 单条连接：请求/响应匹配 + 可选事件订阅 */
class DaemonConnection {
  private sock: net.Socket;
  private meta: DaemonMeta;
  private buf = "";
  private pending = new Map<
    string,
    { resolve: (r: DaemonResult) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }
  >();
  private subscribed = false;
  closed = false;

  constructor(sock: net.Socket, meta: DaemonMeta) {
    this.sock = sock;
    this.meta = meta;
    sock.setEncoding("utf8");
    sock.on("data", (chunk: string) => this.onData(chunk));
    sock.on("close", () => this.onClose(new Error("daemon connection closed")));
    sock.on("error", (e) => this.onClose(e instanceof Error ? e : new Error(String(e))));
  }

  private onData(chunk: string): void {
    this.buf += chunk;
    let idx: number;
    while ((idx = this.buf.indexOf("\n")) >= 0) {
      const line = this.buf.slice(0, idx).trim();
      this.buf = this.buf.slice(idx + 1);
      if (!line) continue;
      let frame: DaemonFrame;
      try {
        frame = JSON.parse(line) as DaemonFrame;
      } catch {
        continue;
      }
      if (frame.type === "event") {
        this.handleEvent(frame);
        continue;
      }
      if (frame.type === "res") {
        const wait = this.pending.get(frame.id);
        if (!wait) continue;
        this.pending.delete(frame.id);
        clearTimeout(wait.timer);
        if (frame.ok && frame.result) wait.resolve(frame.result);
        else wait.reject(new Error(frame.error ?? "daemon error"));
      }
    }
  }

  private handleEvent(ev: DaemonEvent): void {
    if (ev.event === "management") { remoteStateBus.emit("management", ev.payload); return; }
    if (ev.event === "log" && isLogPayload(ev.payload)) {
      ingestRemoteLog(ev.payload.text, ev.payload.source, ev.payload.level);
      return;
    }
    if (ev.event === "state") {
      remoteStateBus.emit("state", ev.payload as ServiceStateEvent);
    }
  }

  private onClose(err: Error): void {
    if (this.closed) return;
    this.closed = true;
    for (const [, wait] of this.pending) {
      clearTimeout(wait.timer);
      wait.reject(err);
    }
    this.pending.clear();
    if (shared === this) shared = null;
  }

  /** 发送 RPC 并等待匹配 id 的响应 */
  call(method: DaemonMethod, params?: DaemonParams, timeoutMs = CALL_TIMEOUT_MS): Promise<DaemonResult> {
    if (this.closed || this.sock.destroyed) {
      return Promise.reject(new Error("daemon not connected"));
    }
    const id = randomBytes(8).toString("hex");
    const req: DaemonRequest = params
      ? { id, token: this.meta.token, method, params }
      : { id, token: this.meta.token, method };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`daemon call timeout: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.sock.write(JSON.stringify(req) + "\n");
      } catch (e) {
        this.pending.delete(id);
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }

  /** 订阅日志与状态事件（同一连接上继续发 RPC） */
  async subscribe(): Promise<void> {
    if (this.subscribed) return;
    await this.call("subscribe");
    this.subscribed = true;
  }

  /** 断开连接（不停守护进程） */
  disconnect(): void {
    this.closed = true;
    try {
      this.sock.end();
    } catch {
      /* ignore */
    }
    if (shared === this) shared = null;
  }
}

function connectSocket(pipe: string, timeoutMs = 3000): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection(pipe);
    const timer = setTimeout(() => {
      sock.destroy();
      reject(new Error("connect timeout"));
    }, timeoutMs);
    sock.once("connect", () => {
      clearTimeout(timer);
      resolve(sock);
    });
    sock.once("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}

/**
 * 尝试连接已有 daemon；成功则返回连接，失败返回 null。
 */
async function tryConnectExisting(): Promise<DaemonConnection | null> {
  const meta = readDaemonMeta();
  if (!meta) return null;
  if (!(await isProcessAlive(meta.pid))) {
    return null;
  }
  try {
    const sock = await connectSocket(meta.pipe);
    const conn = new DaemonConnection(sock, meta);
    await conn.call("ping", undefined, 3000);
    return conn;
  } catch {
    return null;
  }
}

/**
 * 拉起守护进程子进程（detached，日志写入 daemon.log）。
 * 入口脚本复用当前 CLI 的 argv[1]（即 sfmc 主入口）。
 */
function spawnDaemonProcess(): void {
  const lockFile = path.join(ROOT, ".sfmc", "maintenance.lock");
  if (fs.existsSync(lockFile)) {
    const owner = JSON.parse(fs.readFileSync(lockFile, "utf8")) as { nonce: string };
    if ((maintenanceToken(ROOT) ?? process.env.SFMC_MAINTENANCE_TOKEN) !== owner.nonce) throw new Error("实例正在维护；后台切换完成前不会创建另一个守护进程");
  }
  const entry = process.env.SFMC_DAEMON_ENTRY ?? fileURLToPath(new URL("../main.js", import.meta.url));
  if (!entry) throw new Error("cannot resolve sfmc entry for daemon spawn");
  fs.mkdirSync(logsDir(ROOT), { recursive: true });
  const logFd = fs.openSync(daemonLogPath(), "a");
  const child = spawn(process.env.SFMC_NODE_BINARY ?? process.execPath, [entry, "--daemon"], {
    detached: true,
    windowsHide: true,
    stdio: ["ignore", logFd, logFd],
    env: { ...process.env, SFMC_ROOT: ROOT },
    cwd: ROOT,
  });
  child.unref();
  try {
    fs.closeSync(logFd);
  } catch {
    /* ignore */
  }
}

/**
 * 确保守护进程可用并返回共享连接。
 * 守护进程进程内调用会抛错（应直接走本地 cmd*）。
 */
export async function ensureDaemon(): Promise<DaemonConnection> {
  if (isDaemonServer()) {
    throw new Error("ensureDaemon must not run inside daemon server");
  }
  if (shared && !shared.closed) return shared;

  let conn = await tryConnectExisting();
  if (conn) {
    shared = conn;
    return conn;
  }

  const existing = readDaemonMeta();
  if (existing && (await isProcessAlive(existing.pid))) {
    /* PID 仍在但暂时连不上：短暂重试，禁止再 spawn 第二套守护进程 */
    const deadline = Date.now() + READY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, READY_POLL_MS));
      conn = await tryConnectExisting();
      if (conn) {
        shared = conn;
        return conn;
      }
    }
    throw new Error(`daemon pid ${existing.pid} is alive but pipe is unreachable`);
  }

  spawnDaemonProcess();
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, READY_POLL_MS));
    if (!fs.existsSync(daemonMetaPath())) continue;
    conn = await tryConnectExisting();
    if (conn) {
      shared = conn;
      return conn;
    }
  }
  throw new Error("failed to start or connect sfmc daemon");
}

/**
 * 调用守护进程方法；自动 ensureDaemon。
 * 使用场景：CLI 侧 status/start/stop/send/update 等运维命令的统一出口。
 */
export async function callDaemon(method: DaemonMethod, params?: DaemonParams): Promise<DaemonResult> {
  const conn = await ensureDaemon();
  const token = maintenanceToken(ROOT) ?? process.env.SFMC_MAINTENANCE_TOKEN;
  return conn.call(method, token ? { ...params, maintenanceToken: token } : params);
}

/**
 * 确保已连接并订阅远程日志/状态；返回断开函数（不停守护进程）。
 * 使用场景：REPL 启动时挂上实时日志流，退出时只 disconnect。
 */
export async function ensureDaemonSubscription(): Promise<() => void> {
  const conn = await ensureDaemon();
  await conn.subscribe();
  return () => {
    conn.disconnect();
  };
}

/**
 * 请求守护进程 stopAll 后退出（`sfmc daemon stop`）。
 */
export async function shutdownDaemon(): Promise<string> {
  try {
    const conn = await ensureDaemon();
    const token = maintenanceToken(ROOT) ?? process.env.SFMC_MAINTENANCE_TOKEN;
    await conn.call("shutdown", token ? { maintenanceToken: token } : undefined);
    conn.disconnect();
  } catch (e) {
    const meta = readDaemonMeta();
    if (!meta || !await isProcessAlive(meta.pid)) { clearDaemonMeta(); return "守护进程已停止"; }
    throw e;
  }
  /* 短暂等待 meta 清理 */
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (!readDaemonMeta()) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  const remaining = readDaemonMeta();
  if (remaining && await isProcessAlive(remaining.pid)) throw new Error("守护进程尚未退出，保留连接信息");
  clearDaemonMeta();
  return "";
}

/**
 * 从守护进程拉取运行态行；失败时返回空数组由调用方降级。
 */
export async function queryRuntimeViaDaemon(): Promise<ServiceStatus[]> {
  const result = await callDaemon("status");
  if (result.kind === "status") return result.rows;
  return [];
}

/**
 * 从守护进程拉取格式化 status 文本。
 */
export async function statusTextViaDaemon(): Promise<string> {
  const result = await callDaemon("status");
  if (result.kind === "status") return result.text;
  if (result.kind === "text") return result.text;
  return "";
}

/**
 * 通用「返回 text」类 RPC 辅助。
 */
export async function textViaDaemon(method: DaemonMethod, params?: DaemonParams): Promise<string> {
  const result = await callDaemon(method, params);
  if (result.kind === "text") return result.text;
  if (result.kind === "status") return result.text;
  return "";
}
