/**
 * config.ts — QQ 桥接服务配置加载与热重载管理
 *
 * 配置源：`configs/qq_config.json`
 * 核心机制：
 * - 进程启动时调用 `loadInitialConfig()` 加载并校验配置；若配置文件缺失或损坏则退出
 * - 缺省字段自动回退至 SDK `DEFAULT_QQ_CONFIG` 权威默认值
 * - 支持 `reloadInto(cfg)` 就地合并更新运行时对象，保持内存引用一致
 */

import { configPath, DEFAULT_QQ_CONFIG, loadEnsuredConfig, stripConfigMeta, type QQBridgeConfig as DiskQQConfig } from "@sfmc-bds/sdk/node/config";
import { log } from "./log.js";
import { PROJECT_ROOT } from "./project-root.js";
import type { QQBridgeConfig } from "./types.js";

/** 统一通过 SDK 解析项目根目录（SFMC_ROOT 优先于上溯查找）。 */
export const ROOT_DIR: string = PROJECT_ROOT;
export const CFG_PATH: string = configPath(ROOT_DIR, "qq_config.json");

function applyDefaults(raw: DiskQQConfig): QQBridgeConfig {
  /* 以 SDK DEFAULT_QQ_CONFIG 为唯一缺省权威（DRY/LSP），再叠运行时派生字段 */
  const merged = { ...DEFAULT_QQ_CONFIG, ...raw } as DiskQQConfig & Record<string, unknown>;
  const stripped = stripConfigMeta(merged);
  const backendRaw = String(stripped.qq_backend ?? DEFAULT_QQ_CONFIG.qq_backend ?? "official");
  const qq_backend = backendRaw === "llbot" ? ("llbot" as const) : ("official" as const);
  const official = raw.official ?? {};
  const officialDefaults = DEFAULT_QQ_CONFIG.official ?? {};
  const llbot = raw.llbot ?? {};
  const llbotDefaults = DEFAULT_QQ_CONFIG.llbot ?? {};
  const publicRaw = raw.public_server;
  const publicServer = publicRaw && typeof publicRaw === "object" ? publicRaw : {};
  return {
    public_server: {
      address: typeof publicServer.address === "string" ? publicServer.address.trim().slice(0, 253) : "",
      version: typeof publicServer.version === "string" ? publicServer.version.trim().slice(0, 120) : "",
      port:
        Number.isInteger(publicServer.port) && publicServer.port! > 0 && publicServer.port! <= 65535
          ? publicServer.port!
          : 19132,
    },
    qq_enabled: raw.qq_enabled !== false,
    qq_backend,
    qq_official_transport: official.transport === "webhook" ? "webhook" : "websocket",
    qq_webhook_port: Number(official.webhook?.port ?? officialDefaults.webhook?.port ?? 3005),
    qq_webhook_path: String(official.webhook?.path ?? officialDefaults.webhook?.path ?? "/qqbot/webhook"),
    qq_app_id: String(official.app_id ?? officialDefaults.app_id ?? ""),
    qq_app_secret: String(official.app_secret ?? officialDefaults.app_secret ?? ""),
    qq_sandbox: official.sandbox === true,
    qq_group_openid: String(official.group_openid ?? officialDefaults.group_openid ?? ""),
    qq_group_panel_id: String(official.group_panel_id ?? officialDefaults.group_panel_id ?? ""),
    qq_sync_menu_panel: official.sync_menu_panel !== false,
    qq_admin_openids: Array.isArray(official.admin_openids)
      ? official.admin_openids.map((x) => String(x).trim()).filter(Boolean)
      : [],
    qq_ws_port: Number(llbot.ws_port ?? llbotDefaults.ws_port ?? 3002),
    qq_group_id: String(llbot.group_id ?? llbotDefaults.group_id ?? "0"),
    llbot_enabled: llbot.enabled ?? llbotDefaults.enabled ?? false,
    llbot_path: llbot.path ?? llbotDefaults.path ?? "",
    llbot_cwd: llbot.cwd ?? llbotDefaults.cwd ?? "",
    llbot_host: llbot.host ?? llbotDefaults.host ?? "127.0.0.1",
    llbot_port: llbot.port ?? llbotDefaults.port ?? 3004,
    llbot_token: llbot.token ?? llbotDefaults.token ?? "",
    llbot_http: llbot.http ?? llbotDefaults.http ?? "",
    bridge_channel_id: String(raw.bridge_channel_id ?? DEFAULT_QQ_CONFIG.bridge_channel_id ?? ""),
    db_host: String(raw.db_host ?? "127.0.0.1"),
    db_port: Number(raw.db_port ?? 3001),
    mctoqq_prefix: String(raw.mctoqq_prefix ?? DEFAULT_QQ_CONFIG.mctoqq_prefix ?? "[MC]"),
  };
}

function readFromDisk(): QQBridgeConfig {
  const raw = loadEnsuredConfig(ROOT_DIR, "qq_config.json", "qq_config", { ...DEFAULT_QQ_CONFIG } as Record<
    string,
    unknown
  >);
  return applyDefaults(raw as DiskQQConfig);
}

/**
 * 进程启动时加载初始配置。
 *
 * @returns 规整化后的 QQ 桥接配置对象。
 */
export function loadInitialConfig(): QQBridgeConfig {
  try {
    return readFromDisk();
  } catch (e) {
    log.error(`无法读取配置: ${CFG_PATH}: ${(e as Error).message}`);
    process.exit(1);
  }
}

/**
 * 重新从磁盘读取配置文件，并就地合并到当前配置对象中（保持运行时对象引用不变）。
 *
 * @param cfg 需同步更新的目标配置对象。
 */
export function reloadInto(cfg: QQBridgeConfig): void {
  try {
    const fresh = readFromDisk();
    Object.assign(cfg, fresh);
  } catch (e) {
    log.error(`重载配置失败: ${(e as Error).message}`);
  }
}
