/**
 * server.ts — HTTP 服务 + 控制台
 */

import http from "node:http";
import net from "node:net";
import readline from "node:readline";
import type { DatabaseSync } from "node:sqlite";

import { log } from "./lib/log.js";

interface CheckResult {
  ok: boolean;
  port: number;
  error?: string;
}

/**
 * 检测指定端口是否冲突可用。
 *
 * @param port 待检测的端口号。
 * @returns 包含端口可用性状态的检测结果对象。
 */
export function checkPortConflict(port: number): Promise<CheckResult> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (err: NodeJS.ErrnoException) => {
      const result: { ok: false; port: number; error?: string } = { ok: false, port };
      if (err.code) {
        result.error = err.code;
      }
      resolve(result);
    });
    server.once("listening", () => {
      server.close();
      resolve({ ok: true, port });
    });
    server.listen(port, "127.0.0.1");
  });
}

export type ServerEnv = {
  PORT: number;
  HOST: string;
  AUTH_TOKEN?: string;
};

export type Handler = (req: http.IncomingMessage, res: http.ServerResponse) => void | Promise<void>;

export interface ServerOptions {
  env: ServerEnv;
  handle: Handler;
  onListening?: (server: http.Server) => void;
}

/**
 * 创建并配置 db-server 的原生 HTTP 服务实例（集成请求耗时监控与状态码日志）。
 *
 * @param options 服务端启动配置选项。
 * @returns 原生 http.Server 实例。
 */
export function createServer({ handle, env, onListening }: ServerOptions): http.Server {
  const server = http.createServer((req, res) => {
    const startedAt = Date.now();
    let bodyStr = "";
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      bodyStr = Buffer.concat(chunks).toString("utf-8").slice(0, 300);
      (req as http.IncomingMessage & { bodyBuffer: string }).bodyBuffer = bodyStr;
    });
    res.once("finish", () => {
      const quietPoll = (req.url ?? "").startsWith("/api/sfmc/messages?") && res.statusCode < 400;
      const bodySnippet = req.method === "GET" ? "" : ` ${bodyStr.slice(0, 200)}`;
      if (!quietPoll)
        log.info(`[HTTP] ${req.method} ${req.url} ${res.statusCode} ${Date.now() - startedAt}ms${bodySnippet}`);
    });
    void handle(req, res);
  });

  server.listen(env.PORT, env.HOST, () => {
    log.success(`HTTP 服务已启动，端口 ${env.PORT} (loopback only)`);
    log.info(`API 健康检查: http://${env.HOST}:${env.PORT}/api/health`);
    log.info(`鉴权: ${env.AUTH_TOKEN ? "已启用 token" : "未启用"}`);
    if (onListening) onListening(server);
  });

  return server;
}

/**
 * 启动交互式控制台 REPL 界面，支持在终端输入 `help`、`status`、`stop` 运维管理指令。
 *
 * @param server HTTP 服务实例。
 * @param db 数据库连接实例。
 * @returns 控制台 Readline 接口对象。
 */
export function startConsole(server: http.Server, db: DatabaseSync | null): readline.Interface {

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.on("line", (line: string) => {
    const cmd = line.trim().toLowerCase();
    if (cmd === "help") {
      console.log("DB Server 可用命令:");
      console.log("  help    — 显示帮助");
      console.log("  status  — 显示服务状态");
      console.log("  stop    — 停止服务");
    } else if (cmd === "status") {
      console.log(`状态: 运行中`);
      console.log(`  HTTP 端口: ${(server.address() as { port: number }).port}`);
      console.log(`  数据库: ${db ? "(已连接)" : "(未连接)"}`);
    } else if (cmd === "stop") {
      log.info("正在停止服务...");
      rl.close();
      server.close();
      if (db) db.close();
      process.exit(0);
    } else {
      log.warn(`未知命令: ${cmd}，输入 help 查看帮助`);
    }
  });
  rl.on("SIGINT", () => process.exit());
  return rl;
}

