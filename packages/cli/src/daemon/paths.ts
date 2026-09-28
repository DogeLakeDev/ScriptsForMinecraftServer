/**
 * paths.ts — 守护进程连接信息与管道路径
 *
 * 权威落盘：`<SFMC_ROOT>/.sfmc/daemon.json`（与 stateDir 一致）。
 * 同一 ROOT 只允许一个守护进程；CLI 通过本文件解析管道并校验 token。
 */

import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { logsDir, stateDir } from "@sfmc-bds/sdk/node/config";
import { ROOT } from "../runtime.js";

/** 守护进程元数据：PID、管道路径、鉴权 token */
export interface DaemonMeta {
  /** 守护进程 PID */
  pid: number;
  /** 命名管道（Windows）或 Unix socket 绝对路径 */
  pipe: string;
  /** 连接鉴权 token（随机） */
  token: string;
  /** ISO 启动时间 */
  startedAt: string;
}

/** 守护进程元数据文件路径 */
export function daemonMetaPath(root: string = ROOT): string {
  return path.join(stateDir(root), "daemon.json");
}

/** 守护进程自身日志（stdout/stderr 追加） */
export function daemonLogPath(root: string = ROOT): string {
  return path.join(logsDir(root), "daemon.log");
}

/**
 * 为本机 ROOT 生成唯一管道名。
 * Windows：`\\.\pipe\sfmc-<hash>`；POSIX：`.sfmc/daemon.sock`
 */
export function daemonPipePath(root: string = ROOT): string {
  const hash = createHash("sha256").update(path.resolve(root)).digest("hex").slice(0, 16);
  if (process.platform === "win32") {
    return `\\\\.\\pipe\\sfmc-${hash}`;
  }
  return path.join(stateDir(root), "daemon.sock");
}

/** 生成连接鉴权 token */
export function createDaemonToken(): string {
  return randomBytes(24).toString("hex");
}

/** 读取守护进程元数据；文件缺失或损坏时返回 null */
export function readDaemonMeta(root: string = ROOT): DaemonMeta | null {
  const file = daemonMetaPath(root);
  try {
    if (!fs.existsSync(file)) return null;
    const raw = JSON.parse(fs.readFileSync(file, "utf-8")) as Partial<DaemonMeta>;
    if (
      typeof raw.pid !== "number" ||
      typeof raw.pipe !== "string" ||
      typeof raw.token !== "string" ||
      !raw.pipe ||
      !raw.token
    ) {
      return null;
    }
    return {
      pid: raw.pid,
      pipe: raw.pipe,
      token: raw.token,
      startedAt: typeof raw.startedAt === "string" ? raw.startedAt : "",
    };
  } catch {
    return null;
  }
}

/** 写入守护进程元数据（启动 listen 成功后调用） */
export function writeDaemonMeta(meta: DaemonMeta, root: string = ROOT): void {
  const dir = stateDir(root);
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(logsDir(root), { recursive: true });
  fs.writeFileSync(daemonMetaPath(root), JSON.stringify(meta, null, 2) + "\n", "utf-8");
}

/** 清除守护进程元数据与 POSIX socket 文件 */
export function clearDaemonMeta(root: string = ROOT): void {
  const meta = readDaemonMeta(root);
  try {
    fs.unlinkSync(daemonMetaPath(root));
  } catch {
    /* ignore */
  }
  if (process.platform !== "win32") {
    const sock = meta?.pipe ?? daemonPipePath(root);
    try {
      if (fs.existsSync(sock)) fs.unlinkSync(sock);
    } catch {
      /* ignore */
    }
  }
}
