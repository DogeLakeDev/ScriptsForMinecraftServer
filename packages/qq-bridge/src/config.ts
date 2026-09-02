/**
 * config.ts — QQ 桥接服务配置加载与热重载管理
 *
 * 配置源：`configs/qq_config.json`
 * 核心机制：
 * - 进程启动时调用 `loadInitialConfig()` 加载并校验配置；若配置文件缺失或损坏则退出
 * - 缺省字段自动回退至 SDK `DEFAULT_QQ_CONFIG` 权威默认值
 * - 支持 `reloadInto(cfg)` 就地合并更新运行时对象，保持内存引用一致
 */

import {
  configPath,
  DEFAULT_QQ_CONFIG,
  loadEnsuredConfig,
  stripConfigMeta,
} from "@sfmc-bds/sdk/node/config";
import { log } from "./log.js";
import { PROJECT_ROOT } from "./project-root.js";
import type { QQBridgeConfig } from "./types.js";

/** 统一通过 SDK 解析项目根目录（SFMC_ROOT 优先于上溯查找）。 */
export const ROOT_DIR: string = PROJECT_ROOT;
export const CFG_PATH: string = configPath(ROOT_DIR, "qq_config.json");

function applyDefaults(raw: Partial<QQBridgeConfig>): QQBridgeConfig {
  /* 以 SDK DEFAULT_QQ_CONFIG 为唯一缺省权威（DRY/LSP），再叠运行时派生字段 */
  const merged = { ...DEFAULT_QQ_CONFIG, ...raw } as Partial<QQBridgeConfig> & Record<string, unknown>;
  const stripped = stripConfigMeta(merged);
  const backendRaw = String(stripped.qq_backend ?? DEFAULT_QQ_CONFIG.qq_backend ?? "official");
  const qq_backend = backendRaw === "llbot" ? ("llbot" as const) : ("official" as const);
  return {
    ...stripped,
    qq_enabled: stripped.qq_enabled !== false,
    qq_backend,
    qq_app_id: String(stripped.qq_app_id ?? DEFAULT_QQ_CONFIG.qq_app_id ?? ""),
    qq_app_secret: String(stripped.qq_app_secret ?? DEFAULT_QQ_CONFIG.qq_app_secret ?? ""),
    qq_sandbox: stripped.qq_sandbox === true,
    qq_group_openid: String(stripped.qq_group_openid ?? DEFAULT_QQ_CONFIG.qq_group_openid ?? ""),
    qq_group_panel_id: String(stripped.qq_group_panel_id ?? DEFAULT_QQ_CONFIG.qq_group_panel_id ?? ""),
    qq_sync_menu_panel: stripped.qq_sync_menu_panel !== false,
    qq_admin_openids: Array.isArray(stripped.qq_admin_openids)
      ? (stripped.qq_admin_openids as unknown[]).map((x) => String(x).trim()).filter(Boolean)
      : [],
    qq_ws_port: parseInt(String(stripped.qq_ws_port ?? DEFAULT_QQ_CONFIG.qq_ws_port ?? 3002), 10),
    qq_group_id: String(stripped.qq_group_id ?? DEFAULT_QQ_CONFIG.qq_group_id ?? "0"),
    bridge_channel_id: String(stripped.bridge_channel_id ?? DEFAULT_QQ_CONFIG.bridge_channel_id ?? ""),
    db_host: String(stripped.db_host ?? "127.0.0.1"),
    db_port: parseInt(String(stripped.db_port ?? "3001"), 10),
    mctoqq_prefix: String(stripped.mctoqq_prefix ?? DEFAULT_QQ_CONFIG.mctoqq_prefix ?? "[MC]"),
  };
}

function readFromDisk(): QQBridgeConfig {
  const raw = loadEnsuredConfig(
    ROOT_DIR,
    "qq_config.json",
    "qq_config",
    { ...DEFAULT_QQ_CONFIG } as Record<string, unknown>
  );
  return applyDefaults(raw as Partial<QQBridgeConfig>);
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

