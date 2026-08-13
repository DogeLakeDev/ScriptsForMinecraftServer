/**
 * console.ts — 交互式控制台 (readline)
 *
 * 命令:
 *   help       显示帮助
 *   reload     重新读取 configs/qq_config.json
 *   status     显示当前状态
 *   sync-menu  重推官方菜单/指令面板（仅 official）
 *   stop       退出进程
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
  backend: "official" | "llbot";
  onSyncMenu?: () => Promise<void>;
}

function showHelp(backend: "official" | "llbot"): void {
  console.log("可用命令:");
  console.log("  help       — 显示本帮助");
  console.log("  reload     — 重新读取 qq_config.json");
  console.log("  status     — 显示当前状态");
  if (backend === "official") {
    console.log("  sync-menu  — 重推官方自定义菜单 / 群指令面板");
  }
  console.log("  stop       — 停止服务");
}

function showStatus(opts: ConsoleOptions): void {
  const { config: cfg, initialEnabled, wsPort, botSelfIdRef, backend } = opts;
  console.log("=== QQBridge 状态 ===");
  console.log(`  启用:        ${initialEnabled}`);
  console.log(`  后端:        ${backend}`);
  if (backend === "official") {
    console.log(`  沙箱:        ${cfg.qq_sandbox}`);
    console.log(`  AppID:       ${cfg.qq_app_id || "未配置"}`);
    console.log(`  群 openid:   ${cfg.qq_group_openid || "未配置"}`);
    console.log(`  面板 id:     ${cfg.qq_group_panel_id || "未配置"}`);
    console.log(`  sync 菜单:   ${cfg.qq_sync_menu_panel !== false}`);
  } else {
    console.log(`  WS 端口:     ${wsPort}`);
    console.log(`  QQ 群号:     ${cfg.qq_group_id || "未配置"}`);
    console.log(`  Bot self_id: ${botSelfIdRef.value || "未捕获"}`);
  }
  console.log(`  Channel:     ${cfg.bridge_channel_id || "未配置"}`);
  console.log(`  db-server:   ${cfg.db_host}:${cfg.db_port}`);
  console.log(`  MC→QQ 前缀:  ${cfg.mctoqq_prefix}`);
  console.log(`  MC→QQ 出站:  (由 db-server 按 qq_backend 直连)`);
}

function handleCommand(line: string, opts: ConsoleOptions, rl: RLInterface): boolean {
  const cmd = line.trim().toLowerCase();
  switch (cmd) {
    case "help":
      showHelp(opts.backend);
      return false;
    case "reload": {
      reloadInto(opts.config);
      log.info(
        `配置已重载 (backend=${opts.config.qq_backend}, channel=${opts.config.bridge_channel_id}, db=${opts.config.db_host}:${opts.config.db_port})`
      );
      log.warn("reload 只更新内存配置引用；切换 backend / AppID 需重启进程");
      return false;
    }
    case "status":
      showStatus(opts);
      return false;
    case "sync-menu": {
      if (opts.backend !== "official") {
        log.info("sync-menu 仅 official 后端可用");
        return false;
      }
      if (!opts.onSyncMenu) {
        log.warn("sync-menu 未接线");
        return false;
      }
      void opts.onSyncMenu().then(
        () => log.info("sync-menu 完成"),
        (e) => log.warn(`sync-menu 失败: ${(e as Error).message}`)
      );
      return false;
    }
    case "stop":
    case "exit":
    case "quit":
      log.info("正在停止...");
      rl.close();
      process.exit(0);
      return true;
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
