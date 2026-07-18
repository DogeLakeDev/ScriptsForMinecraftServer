/**
 * logger.ts — 单例流式日志 (避免断行 / 文件描述符泄漏)
 *
 * appendFileSync 在长消息或高频调用下可能撞到 buffer 边界，导致行被截断。
 * 这里使用 createWriteStream + 缓冲行，单例保持一个 FD。
 */

import fs from "node:fs";
import path from "node:path";
import { LOG_PATH } from "./paths.js";
import type { Logger } from "./types.js";

let stream: fs.WriteStream | null = null;
function getStream(): fs.WriteStream {
  if (stream) return stream;
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  stream = fs.createWriteStream(LOG_PATH, { flags: "a", encoding: "utf-8" });
  stream.on("error", () => {
    // 退化到 console.error；不抛出以避免中断主流程
  });
  return stream;
}

function ts(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function write(level: "INFO" | "WARN" | "ERROR", msg: string): void {
  const line = `[${ts()}] [${level}] ${msg}`;
  // 控制台
  if (level === "ERROR") console.error(line);
  else console.log(line);
  // 文件
  try {
    getStream().write(line + "\n");
  } catch {
    /* ignore */
  }
}

export const logger: Logger = {
  info(msg) { write("INFO", msg); },
  warn(msg) { write("WARN", msg); },
  error(msg) { write("ERROR", msg); },
};

export function closeLogger(): void {
  if (stream) {
    stream.end();
    stream = null;
  }
}
