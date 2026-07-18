/**
 * console.ts — 交互式控制台 (readline)
 *
 * 命令:
 *   help    显示帮助
 *   reload  重新读取 configs/qq_config.json
 *   status  显示当前状态
 *   stop    退出进程
 *
 * 行为与旧实现完全一致。
 */

import { createInterface, type Interface as RLInterface } from "node:readline";
import { log } from "./log.js";
import { reloadInto } from "./config.js";
import type { QQBridgeConfig } from "./types.js";

export interface ConsoleOptions {
  config: QQBridgeConfig;
  initialEnabled: boolean;
  wsPort: number;
  botSelfIdRef: { value: string | null };
}

function showHelp(): void {
  console.log("可用命令:");
  console.log("  help    — 显示本帮助");
  console.log("  reload  — 重新读取 qq_config.json");
  console.log("  status  — 显示当前状态");
  console.log("  stop    — 停止服务");
}

function showStatus(opts: ConsoleOptions): void {
  const { config: cfg, initialEnabled, wsPort, botSelfIdRef } = opts;
  console.log("=== QQBridge 状态 ===");
  console.log(`  启用:        ${initialEnabled}`);
  console.log(`  WS 端口:     ${wsPort}`);
  console.log(`  LLBot HTTP:  (db-server 直连,不经过本进程)`);
  console.log(`  QQ 群:       ${cfg.qq_group_id || "未配置"}`);
  console.log(`  Channel:     ${cfg.bridge_channel_id || "未配置"}`);
  console.log(`  db-server:   ${cfg.db_host}:${cfg.db_port}`);
  console.log(`  Bot self_id: ${botSelfIdRef.value || "未捕获"}`);
  console.log(`  MC→QQ 前缀:  ${cfg.mctoqq_prefix}`);
}

function handleCommand(line: string, opts: ConsoleOptions, rl: RLInterface): boolean {
  const cmd = line.trim().toLowerCase();
  switch (cmd) {
    case "help":
      showHelp();
      return false;
    case "reload": {
      const before = {
        qq_group_id: opts.config.qq_group_id,
        bridge_channel_id: opts.config.bridge_channel_id,
        db_host: opts.config.db_host,
        db_port: opts.config.db_port,
      };
      reloadInto(opts.config);
      log.info(
        `配置已重载 (qq_group_id=${opts.config.qq_group_id}, channel=${opts.config.bridge_channel_id}, db=${opts.config.db_host}:${opts.config.db_port})`
      );
      // 静默消费未使用变量警告
      void before;
      return false;
    }
    case "status":
      showStatus(opts);
      return false;
    case "stop":
    case "exit":
    case "quit":
      log.info("正在停止...");
      rl.close();
      process.exit(0);
      return true; // 不可达,但满足 noImplicitReturns
    case "":
      return false;
    default:
      log.info(`未知命令: ${cmd} (输入 help 查看帮助)`);
      return false;
  }
}

export function startConsole(opts: ConsoleOptions): void {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  rl.on("line", (line) => {
    handleCommand(line, opts, rl);
  });
}
