/**
 * services/manager.ts — 统一进程管理
 *
 * 与原版基本一致：
 *   - 4 个服务（bds / db / qq / llbot）的事件发射
 *   - start / stop / restart / send / log 方法
 *
 * 改动：
 *   - 不再调用 BDSTools/check-update.js（改由 db-server /api/sfmc/version 提供）
 *   - 输出绑定到 log/buffer.ts 的 pushLog（通过 bindServiceOutput）
 */

import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ServiceName } from "../store.js";
import { set } from "../store.js";

export type ManagedServiceName = Exclude<ServiceName, "panel">;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..");

function loadCfg(name: string): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "configs", name), "utf-8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

const bdsCfg = loadCfg("bds_updater.json") as {
  bds_path?: string;
  crash_restart?: boolean;
  crash_restart_delay?: number;
};
const qqCfg = loadCfg("qq_config.json") as {
  llbot_path?: string;
  llbot_cwd?: string;
  llbot_enabled?: boolean;
};

type CreateOpts = {
  title: string;
  cmd: string;
  args?: string[];
  cwd?: string;
  shell?: boolean;
  stopTimeout?: number;
  autoRestart?: boolean;
  restartDelay?: number;
  validate?: () => string | null;
};

type Svc = {
  name: ManagedServiceName;
  title: string;
  pid: number;
  running: boolean;
  events: EventEmitter;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  restart: () => Promise<void>;
  send: (cmd: string) => boolean;
};

function createService(name: ManagedServiceName, opts: CreateOpts): Svc {
  let proc: ReturnType<typeof spawn> | null = null;
  let isManualStop = false;
  const events = new EventEmitter();
  events.setMaxListeners(100);

  const svc: Svc = {
    name,
    title: opts.title,
    pid: 0,
    running: false,
    events,
    async start() {
      if (proc) return;
      if (opts.validate) {
        try {
          const v = opts.validate();
          if (v) {
            events.emit("output", `启动失败: ${v}`, "error");
            return;
          }
        } catch (e) {
          events.emit("output", `校验失败: ${(e as Error).message}`, "error");
          return;
        }
      }
      events.emit("output", `启动中...`, "info");
      const child = spawn(opts.cmd, opts.args ?? [], {
        cwd: opts.cwd ?? ROOT_DIR,
        stdio: ["pipe", "pipe", "pipe"],
        shell: opts.shell ?? false,
      });
      proc = child;
      svc.pid = child.pid ?? 0;
      svc.running = true;
      isManualStop = false;
      set((s) => ({ services: { ...s.services, [name]: { ...s.services[name], running: true, pid: svc.pid } } }));
      child.once("error", (e) => {
        events.emit("output", `启动失败: ${e.message}`, "error");
        if (proc === child) {
          proc = null;
          svc.pid = 0;
          svc.running = false;
          set((s) => ({ services: { ...s.services, [name]: { ...s.services[name], running: false, pid: 0 } } }));
        }
      });
      child.stdout?.on("data", (d: Buffer) => events.emit("output", d.toString(), "info"));
      child.stderr?.on("data", (d: Buffer) => events.emit("output", d.toString(), "error"));
      child.on("exit", (code) => {
        svc.running = false;
        svc.pid = 0;
        set((s) => ({ services: { ...s.services, [name]: { ...s.services[name], running: false, pid: 0 } } }));
        events.emit("output", `已退出 (code: ${code})`, "info");
        if (!isManualStop && opts.autoRestart) {
          setTimeout(() => {
            void svc.start();
          }, opts.restartDelay ?? 5000);
        }
        proc = null;
      });
    },
    async stop() {
      if (!proc) return;
      isManualStop = true;
      events.emit("output", "正在停止...", "info");
      if (name === "bds") {
        proc.stdin?.write("stop\n");
      } else {
        proc.kill("SIGTERM");
      }
      const timeout = setTimeout(() => {
        if (proc) {
          events.emit("output", "超时，强制终止", "error");
          try {
            proc.kill("SIGKILL");
          } catch {
            /* ignore */
          }
        }
      }, opts.stopTimeout ?? 10000);
      proc.on("exit", () => {
        clearTimeout(timeout);
        proc = null;
        svc.running = false;
        svc.pid = 0;
        set((s) => ({ services: { ...s.services, [name]: { ...s.services[name], running: false, pid: 0 } } }));
      });
    },
    async restart() {
      await svc.stop();
      await svc.start();
    },
    send(cmd: string) {
      if (proc?.stdin) {
        proc.stdin.write(cmd + "\n");
        return true;
      }
      return false;
    },
  };
  return svc;
}

export const services: Record<ManagedServiceName, Svc> = {
  bds: createService("bds", {
    title: "BDS",
    cmd: "bedrock_server.exe",
    cwd: path.resolve(bdsCfg.bds_path ?? path.join(ROOT_DIR, "..")),
    stopTimeout: 30000,
    autoRestart: bdsCfg.crash_restart !== false,
    restartDelay: (bdsCfg.crash_restart_delay ?? 5) * 1000,
    validate: () => {
      const cwd = path.resolve(bdsCfg.bds_path ?? path.join(ROOT_DIR, ".."));
      const exe = path.join(cwd, "bedrock_server.exe");
      if (!fs.existsSync(exe)) return `找不到 bedrock_server.exe (${cwd})`;
      return null;
    },
  }),
  db: createService("db", {
    title: "DB Server",
    cmd: "node",
    args: ["db-server/server.js"],
    cwd: ROOT_DIR,
    autoRestart: true,
    restartDelay: 3000,
    validate: () => null,
  }),
  qq: createService("qq", {
    title: "QQ Bridge",
    cmd: "node",
    args: ["qq-bridge/index.js"],
    cwd: ROOT_DIR,
    autoRestart: true,
    restartDelay: 3000,
    validate: () => null,
  }),
  llbot: createService("llbot", {
    title: "LLBot",
    cmd: qqCfg.llbot_path ?? "D:\\LLBot-CLI-win-x64\\llbot.exe",
    cwd: qqCfg.llbot_cwd ?? "D:\\LLBot-CLI-win-x64",
    autoRestart: true,
    restartDelay: 5000,
    validate: () => {
      const exe = qqCfg.llbot_path ?? "D:\\LLBot-CLI-win-x64\\llbot.exe";
      if (!qqCfg.llbot_enabled) return "LLBot 管理已禁用 (llbot_enabled=false)";
      if (!fs.existsSync(exe)) return `找不到 ${exe}`;
      return null;
    },
  }),
};

const START_ORDER: ManagedServiceName[] = ["db", "qq", "llbot", "bds"];
const STOP_ORDER = [...START_ORDER].reverse();

export async function startAll(): Promise<void> {
  for (const name of START_ORDER) {
    const svc = services[name];
    if (!svc) continue;
    svc.events.emit("output", "准备启动...", "info");
    try {
      await svc.start();
    } catch (e) {
      svc.events.emit("output", `启动异常: ${(e as Error).message}`, "error");
    }
  }
}

export async function stopAll(): Promise<void> {
  for (const name of STOP_ORDER) {
    const svc = services[name];
    if (!svc) continue;
    if (svc.running) await svc.stop();
  }
}
