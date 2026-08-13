/**
 * bds-manager.ts — BDS 进程管理器
 *
 * 改进:
 *  - 优雅 stop (发送 stop 命令 → 等待退出 → SIGTERM → SIGKILL)
 *  - watchdog (崩溃自动重启)
 *  - 单例事件发射器
 *  - 完全异步 (fs/promises)
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { EventEmitter } from "node:events";
import { bdsExePath, bdsSpawnEnvExtra, ensureBdsExecutable } from "./host-platform.js";
import { isMainModule } from "./is-main.js";
import { loadConfig, ROOT_DIR } from "./paths.js";
import { log } from "./log.js";
import { postBdsLifecycleEvent } from "./qq-events-notify.js";
import { ensureEmitServerTelemetry } from "./server-properties.js";
import {
  clearBdsPidFile,
  isProcessAlive,
  isProcessAliveSync,
  killBedrockServerByImage,
  readBdsPidFile,
  writeBdsPidFile,
} from "./process-probe.js";

export interface BdsManager {
  start(): Promise<void>;
  stop(): Promise<void>;
  status(): Promise<boolean>;
  sendCommand(cmd: string): boolean;
  watch(): Promise<void>;
  events: EventEmitter;
  isManualStop: boolean;
  getPid(): number;
}

export interface BdsManagerOptions {
  detached?: boolean;
}

interface CachedProc {
  process: ReturnType<typeof spawn> | null;
  isManualStop: boolean;
  crashRestart: boolean;
  crashDelayMs: number;
  exePath: string;
  bdsPath: string;
}

let cached: CachedProc | null = null;

function ensureProc(): CachedProc {
  if (cached) return cached;
  const cfg = loadConfig();
  const bds_path = path.resolve(cfg.bds_path || process.cwd());
  const exePath = bdsExePath(bds_path);

  cached = {
    process: null,
    isManualStop: false,
    crashRestart: cfg.crash_restart !== false,
    crashDelayMs: (cfg.crash_restart_delay ?? 5) * 1000,
    exePath,
    bdsPath: bds_path,
  };
  return cached;
}

export function createBdsManager(options: BdsManagerOptions = {}): BdsManager {
  const events = new EventEmitter();
  events.setMaxListeners(100);

  const sendCommand = (cmd: string): boolean => {
    const p = ensureProc();
    const pid = readBdsPidFile(ROOT_DIR);
    if (!pid || !isProcessAliveSync(pid)) {
      log.warn("BDS 未运行");
      return false;
    }
    if (p.process && p.process.pid === pid && p.process.stdin) {
      try {
        p.process.stdin.write(cmd + "\n");
        log.info(`已发送命令: ${cmd}`);
        return true;
      } catch {
        return false;
      }
    }
    log.warn("BDS 由外部启动，无法发送命令到 stdin");
    return false;
  };

  const stop = async (): Promise<void> => {
    const p = ensureProc();
    // 无论自管 / 外部进程，手动 stop 都不报 crash
    p.isManualStop = true;
    const pid = readBdsPidFile(ROOT_DIR);
    if (!pid || !(await isProcessAlive(pid))) {
      log.info("BDS 未运行");
      clearBdsPidFile(ROOT_DIR);
      return;
    }

    if (p.process && p.process.pid === pid && p.process.stdin) {
      log.info("正在关闭 BDS...");
      try {
        p.process.stdin.write("stop\n");
      } catch (e) {
        log.warn(`发送 stop 命令失败: ${(e as Error).message}`);
      }

      await Promise.race([
        new Promise<void>((resolve) => p.process?.once("exit", () => resolve())),
        new Promise<void>((resolve) =>
          setTimeout(() => {
            log.warn("30s 超时，强制终止...");
            try {
              p.process?.kill("SIGTERM");
            } catch {}
            setTimeout(resolve, 5000);
          }, 30_000)
        ),
      ]);

      if (p.process && p.process.exitCode === null) {
        log.warn("强制结束进程...");
        try {
          p.process.kill("SIGKILL");
        } catch {}
      }
    } else {
      // 外部启动的 BDS — fallback 使用 taskkill / pkill
      log.info("BDS 由外部启动，使用 taskkill...");
      await killBedrockServerByImage();
    }

    clearBdsPidFile(ROOT_DIR);
    p.process = null;
    log.info("BDS 已停止");
  };

  const start = async (): Promise<void> => {
    const p = ensureProc();
    const existing = readBdsPidFile(ROOT_DIR);
    if (existing && (await isProcessAlive(existing))) {
      log.info("BDS 已在运行中");
      return;
    }

    if (!fs.existsSync(p.exePath)) {
      log.error(`未找到 ${p.exePath}`);
      throw new Error(`BDS 可执行文件不存在: ${p.exePath}`);
    }

    // 启动前幂等确保遥测开关（安装阶段也会写；旧目录首次启动时补上）
    ensureEmitServerTelemetry(p.bdsPath, log);
    ensureBdsExecutable(p.exePath);

    log.info("正在启动 BDS...");
    const child = spawn(p.exePath, [], {
      cwd: p.bdsPath,
      env: { ...process.env, ...bdsSpawnEnvExtra(p.bdsPath) },
      stdio: options.detached ? "ignore" : ["pipe", "pipe", "pipe"],
      detached: options.detached,
      windowsHide: true,
    });

    if (options.detached) child.unref();

    p.process = child;
    writeBdsPidFile(child.pid ?? 0, ROOT_DIR);
    log.info(`BDS 已启动 (PID: ${child.pid})`);
    void postBdsLifecycleEvent("start", `pid=${child.pid ?? 0}`);

    child.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      events.emit("output", text);
      if (isMain()) process.stdout.write(text);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      const text = `[STDERR] ${chunk.toString()}`;
      events.emit("output", text);
      if (isMain()) process.stderr.write(text);
    });

    child.on("exit", (code) => {
      log.info(`BDS 已退出 (code: ${code})`);
      clearBdsPidFile(ROOT_DIR);
      p.process = null;
      const wasManual = p.isManualStop;
      if (!wasManual) {
        void postBdsLifecycleEvent("crash", `code=${code ?? "?"}`);
      }
      if (!wasManual && p.crashRestart && isMain()) {
        log.info(`BDS 意外退出，${p.crashDelayMs / 1000}s 后自动重启...`);
        setTimeout(() => {
          start().catch((e) => log.error(`自动重启失败: ${e.message}`));
        }, p.crashDelayMs);
      }
      p.isManualStop = false;
    });
  };

  const status = async (): Promise<boolean> => {
    const pid = readBdsPidFile(ROOT_DIR);
    const alive = pid > 0 && (await isProcessAlive(pid));
    if (alive) {
      console.log(`BDS 运行中 (PID: ${pid})`);
    } else {
      console.log("BDS 未运行");
      clearBdsPidFile(ROOT_DIR);
    }
    return alive;
  };

  const watch = async (): Promise<void> => {
    log.info("启动监护模式...");
    while (true) {
      const pid = readBdsPidFile(ROOT_DIR);
      if (!pid || !(await isProcessAlive(pid))) {
        try {
          await start();
        } catch (e) {
          log.error(`自动启动失败: ${(e as Error).message}`);
        }
      }
      await new Promise((r) => setTimeout(r, 5_000));
    }
  };

  const getPid = (): number => {
    const p = ensureProc();
    return p.process?.pid ?? readBdsPidFile(ROOT_DIR);
  };

  return {
    start,
    stop,
    status,
    sendCommand,
    watch,
    events,
    isManualStop: false,
    getPid,
  };
}

export const bdsEvents: EventEmitter = new EventEmitter();
export const bdsEvents_enabled = (): void => {
  bdsEvents.setMaxListeners(100);
};
bdsEvents_enabled();

/** 判断当前是否作为 CLI 主入口运行（被 check-update 等 import 时为 false） */
function isMain(): boolean {
  // sfmc supervisor 通过 SFMC_SERVICE 拉起子进程时优先判定（与 check-update 对称）
  if (process.env.SFMC_SERVICE === "manager") return true;
  return isMainModule(import.meta.url);
}

// CLI 入口
if (isMain()) {
  const cmd = process.argv[2];
  const bds = createBdsManager();
  const args = process.argv.slice(3);

  switch (cmd) {
    case "start":
      bds.start().catch((e) => log.error(`启动失败: ${e.message}`));
      break;
    case "stop":
      bds.stop().catch((e) => log.error(`停止失败: ${e.message}`));
      break;
    case "restart":
      bds
        .stop()
        .then(() => bds.start())
        .catch((e) => log.error(`重启失败: ${e.message}`));
      break;
    case "status":
      bds.status();
      break;
    case "send":
      if (args[0]) bds.sendCommand(args.join(" "));
      else console.log("用法: node bds-manager.js send <command>");
      break;
    case "watch":
      bds.watch().catch((e) => log.error(`监护异常: ${e.message}`));
      break;
    default:
      console.log(`用法:
  start         启动 BDS
  stop          停止
  restart       重启
  status        检查状态
  send <cmd>    发送命令
  watch         监护模式（崩溃自动重启）`);
  }
}
