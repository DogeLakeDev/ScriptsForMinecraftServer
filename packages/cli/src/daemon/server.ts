/**
 * server.ts — 守护进程服务端：本机管道 listen + 将 RPC 分发给现有监管逻辑
 *
 * 仅在 `sfmc --daemon` 进程内运行；持有 Service 子进程、自动重启与 BDS stdin。
 * CLI 退出不断开本进程；`shutdown` 方法会先 stopAll 再退出。
 */

import net from "node:net";
import process from "node:process";
import {
  cmdRestart,
  cmdSend,
  cmdStart,
  cmdStartAll,
  cmdStatus,
  cmdStop,
  cmdStopAll,
  cmdUpdate,
} from "../commands.js";
import { onLog } from "../logs.js";
import { onServiceStateChange, queryServicesRuntimeLocal, stopAll } from "../services.js";
import {
  clearDaemonMeta,
  createDaemonToken,
  daemonPipePath,
  writeDaemonMeta,
  type DaemonMeta,
} from "./paths.js";
import type { DaemonEvent, DaemonRequest, DaemonResponse, DaemonResult } from "./protocol.js";
import { toLogPayload } from "./protocol.js";
import { markDaemonServer } from "./role.js";

/** 当前已订阅事件推送的 socket 集合 */
const subscribers = new Set<net.Socket>();

/** 是否已开始优雅退出（避免重复 shutdown） */
let shuttingDown = false;

/**
 * 向所有订阅者广播事件帧。
 * 使用场景：服务日志与启停状态需实时出现在已连接的 REPL。
 */
function broadcast(event: DaemonEvent): void {
  const line = JSON.stringify(event) + "\n";
  for (const sock of subscribers) {
    if (sock.destroyed) {
      subscribers.delete(sock);
      continue;
    }
    try {
      sock.write(line);
    } catch {
      subscribers.delete(sock);
    }
  }
}

function writeRes(sock: net.Socket, res: DaemonResponse): void {
  if (sock.destroyed) return;
  try {
    sock.write(JSON.stringify(res) + "\n");
  } catch {
    /* ignore */
  }
}

/**
 * 分发单条 RPC 到现有 cmd* / services API（本进程已是 daemon，cmd* 走本地实现）。
 */
async function dispatch(req: DaemonRequest): Promise<DaemonResult> {
  switch (req.method) {
    case "ping":
      return { kind: "pong" };
    case "status": {
      const text = await cmdStatus();
      const rows = await queryServicesRuntimeLocal();
      return { kind: "status", text, rows };
    }
    case "start": {
      const name = req.params?.name;
      if (!name) throw new Error("missing params.name");
      if (name === "all" || name === "-all" || name === "--all") {
        return { kind: "text", text: await cmdStartAll() };
      }
      return { kind: "text", text: await cmdStart(name) };
    }
    case "stop": {
      const name = req.params?.name;
      if (!name) throw new Error("missing params.name");
      if (name === "all" || name === "-all" || name === "--all") {
        return { kind: "text", text: await cmdStopAll() };
      }
      return { kind: "text", text: await cmdStop(name) };
    }
    case "restart": {
      const name = req.params?.name;
      if (!name) throw new Error("missing params.name");
      if (name === "all" || name === "-all" || name === "--all") {
        await cmdStopAll();
        return { kind: "text", text: await cmdStartAll() };
      }
      return { kind: "text", text: await cmdRestart(name) };
    }
    case "startAll":
      return { kind: "text", text: await cmdStartAll() };
    case "stopAll":
      return { kind: "text", text: await cmdStopAll() };
    case "send": {
      const name = req.params?.name;
      const message = req.params?.message;
      if (!name || message === undefined) throw new Error("missing params.name/message");
      return { kind: "text", text: await cmdSend(name, message) };
    }
    case "update":
      return { kind: "text", text: await cmdUpdate(req.params?.args ?? []) };
    case "subscribe":
      return { kind: "subscribed" };
    case "shutdown": {
      if (!shuttingDown) {
        shuttingDown = true;
        await stopAll();
        setTimeout(() => {
          clearDaemonMeta();
          process.exit(0);
        }, 50).unref();
      }
      return { kind: "shutdown" };
    }
    default:
      throw new Error(`unknown method: ${(req as DaemonRequest).method}`);
  }
}

/**
 * 处理单条连接上的请求行；鉴权失败则关闭。
 */
async function handleLine(sock: net.Socket, line: string, expectedToken: string): Promise<void> {
  let req: DaemonRequest;
  try {
    req = JSON.parse(line) as DaemonRequest;
  } catch {
    writeRes(sock, { type: "res", id: "?", ok: false, error: "invalid json" });
    return;
  }
  if (!req?.id || !req.method) {
    writeRes(sock, { type: "res", id: req?.id ?? "?", ok: false, error: "invalid request" });
    return;
  }
  if (req.token !== expectedToken) {
    writeRes(sock, { type: "res", id: req.id, ok: false, error: "unauthorized" });
    sock.end();
    return;
  }

  if (req.method === "subscribe") {
    subscribers.add(sock);
    sock.once("close", () => subscribers.delete(sock));
    writeRes(sock, { type: "res", id: req.id, ok: true, result: { kind: "subscribed" } });
    return;
  }

  try {
    const result = await dispatch(req);
    writeRes(sock, { type: "res", id: req.id, ok: true, result });
  } catch (e) {
    writeRes(sock, {
      type: "res",
      id: req.id,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

/**
 * 启动守护进程：标记角色、listen 管道、落盘 daemon.json，并转发日志/状态事件。
 * 本函数在成功 listen 后永不返回（进程常驻）。
 */
export async function runDaemonServer(): Promise<void> {
  markDaemonServer();
  clearDaemonMeta();

  const token = createDaemonToken();
  const pipe = daemonPipePath();
  const meta: DaemonMeta = {
    pid: process.pid,
    pipe,
    token,
    startedAt: new Date().toISOString(),
  };

  const unsubLog = onLog((log) => {
    broadcast({ type: "event", event: "log", payload: toLogPayload(log) });
  });
  const unsubState = onServiceStateChange((ev) => {
    broadcast({ type: "event", event: "state", payload: ev });
  });

  const server = net.createServer((sock) => {
    let buf = "";
    sock.setEncoding("utf8");
    sock.on("data", (chunk: string) => {
      buf += chunk;
      let idx: number;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line) continue;
        void handleLine(sock, line, token);
      }
    });
    sock.on("error", () => {
      subscribers.delete(sock);
    });
    sock.on("close", () => {
      subscribers.delete(sock);
    });
  });

  await new Promise<void>((resolve, reject) => {
    const onErr = (err: NodeJS.ErrnoException): void => {
      /* 另一实例已占用管道：安静退出，避免双守护进程 */
      if (err.code === "EADDRINUSE") {
        process.exit(0);
      }
      reject(err);
    };
    server.once("error", onErr);
    server.listen(pipe, () => {
      server.off("error", onErr);
      resolve();
    });
  });

  writeDaemonMeta(meta);

  const cleanup = (): void => {
    unsubLog();
    unsubState();
    try {
      server.close();
    } catch {
      /* ignore */
    }
    clearDaemonMeta();
  };

  process.on("exit", cleanup);
  process.on("SIGTERM", () => {
    if (shuttingDown) return;
    shuttingDown = true;
    void stopAll().finally(() => {
      cleanup();
      process.exit(0);
    });
  });
  /* 守护进程忽略 SIGINT：脱离终端后不应因信号停服；显式 shutdown 退出 */
  process.on("SIGINT", () => {
    /* no-op */
  });

  await new Promise<never>(() => {
    /* park forever */
  });
}
