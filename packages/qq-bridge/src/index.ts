#!/usr/bin/env node
/**
 * index.ts — QQ ↔ MC 桥接进程入口
 *
 * 双后端:
 *   official — 连接 QQ 开放平台 Gateway，只转发 GROUP_AT_MESSAGE_CREATE；C2C 走指令
 *   llbot    — 监听 WS:3002 接 LLBot reverse-ws（OneBot 11）
 *
 * 共同出站信封: POST db-server:3001/api/sfmc/messages
 * MC→QQ 由 db-server 按同一 qq_backend 直连官方 OpenAPI 或 LLBot HTTP
 *
 * QQ 侧指令在桥内拦截；official 可 sync 自定义菜单 / 群指令面板。
 */

import { createLlbotCommandRouter, createOfficialCommandRouter } from "./commands/index.js";
import { createInteractionRouter } from "./commands/interaction-router.js";
import { persistPanelIdToConfig, syncMenuAndPanel } from "./commands/menu-panel-sync.js";
import { loadInitialConfig } from "./config.js";
import { OneBotDispatcher } from "./onebot.js";
import { startWsServer } from "./ws-server.js";
import { startConsole } from "./console.js";
import { OfficialAtMessageDispatcher } from "./official/events.js";
import { startOfficialGateway } from "./official/gateway.js";
import { installQqRuntimeStatusHooks } from "./runtime-status.js";
import { log } from "./log.js";
import type { QQBridgeConfig } from "./types.js";

async function main(): Promise<void> {
  const cfg: QQBridgeConfig = loadInitialConfig();
  const startedAt = Date.now();

  if (!cfg.qq_enabled) {
    log.info("已禁用 (qq_enabled = false)");
    process.exit(0);
  }

  const botSelfIdRef: { value: string | null } = { value: null };
  const db = {
    host: cfg.db_host,
    port: cfg.db_port,
    channelId: cfg.bridge_channel_id,
  };

  if (cfg.qq_backend === "official") {
    if (!cfg.qq_app_id || !cfg.qq_app_secret) {
      log.error("官方后端需要配置 qq_app_id 与 qq_app_secret");
      process.exit(1);
    }

    const creds = {
      appId: cfg.qq_app_id,
      appSecret: cfg.qq_app_secret,
      sandbox: cfg.qq_sandbox,
    };
    const appId = cfg.qq_app_id;
    const commandRouter = createOfficialCommandRouter(
      creds,
      {
        sandbox: cfg.qq_sandbox,
        appIdHint: appId.length > 8 ? `${appId.slice(0, 4)}…${appId.slice(-4)}` : appId,
        dbHost: cfg.db_host,
        dbPort: cfg.db_port,
        groupOpenid: cfg.qq_group_openid,
        adminOpenids: Array.isArray(cfg.qq_admin_openids) ? cfg.qq_admin_openids : [],
        officialCreds: creds,
      },
      startedAt
    );

    const runSyncMenu = async (): Promise<void> => {
      if (cfg.qq_sync_menu_panel === false) {
        log.info("已跳过 menu/panel sync（qq_sync_menu_panel=false）");
        return;
      }
      await syncMenuAndPanel({
        creds,
        registry: commandRouter.registry,
        groupOpenid: cfg.qq_group_openid,
        panelId: String(cfg.qq_group_panel_id ?? ""),
        persistPanelId: (id) => {
          cfg.qq_group_panel_id = id;
          persistPanelIdToConfig(id);
        },
      });
    };

    const dispatcher = new OfficialAtMessageDispatcher({
      groupOpenid: cfg.qq_group_openid,
      db,
      commandRouter,
    });

    const interactionRouter = createInteractionRouter({
      creds,
      db: { host: cfg.db_host, port: cfg.db_port },
      adminOpenids: Array.isArray(cfg.qq_admin_openids) ? cfg.qq_admin_openids : [],
    });

    await startOfficialGateway({
      creds,
      dispatcher,
      interactionRouter,
    });

    // 不阻断 Gateway：失败只 warn
    void runSyncMenu().catch((e) => log.warn(`menu/panel sync 异常: ${(e as Error).message}`));

    installQqRuntimeStatusHooks("official");

    log.info(
      `官方后端已启动 (sandbox=${cfg.qq_sandbox}, group_openid=${cfg.qq_group_openid || "未配置"}, channel=${cfg.bridge_channel_id || "未配置"}, db=${cfg.db_host}:${cfg.db_port})`
    );

    startConsole({
      config: cfg,
      initialEnabled: cfg.qq_enabled,
      wsPort: 0,
      botSelfIdRef,
      backend: "official",
      onSyncMenu: runSyncMenu,
    });
  } else {
    const commandRouter = createLlbotCommandRouter(
      {
        host: cfg.llbot_host || "127.0.0.1",
        port: cfg.llbot_port || 3004,
        token: cfg.llbot_token || "",
        groupId: cfg.qq_group_id || "0",
      },
      {
        dbHost: cfg.db_host,
        dbPort: cfg.db_port,
        adminOpenids: Array.isArray(cfg.qq_admin_openids) ? cfg.qq_admin_openids : [],
      },
      startedAt
    );

    const dispatcher = new OneBotDispatcher({
      qqGroupId: cfg.qq_group_id,
      db,
      commandRouter,
    });

    Object.defineProperty(botSelfIdRef, "value", {
      get: () => dispatcher.selfId,
    });

    await startWsServer({ port: cfg.qq_ws_port, dispatcher });

    installQqRuntimeStatusHooks("llbot");

    log.info(
      `LLBot 后端等待连接 (主群: ${cfg.qq_group_id || "未配置"}, channel: ${cfg.bridge_channel_id || "未配置"}, db: ${cfg.db_host}:${cfg.db_port})`
    );

    startConsole({
      config: cfg,
      initialEnabled: cfg.qq_enabled,
      wsPort: cfg.qq_ws_port,
      botSelfIdRef,
      backend: "llbot",
    });
  }

  log.info("启动完成");
}

main().catch((e) => {
  log.error(`未捕获异常: ${(e as Error).message}`);
  process.exit(1);
});
