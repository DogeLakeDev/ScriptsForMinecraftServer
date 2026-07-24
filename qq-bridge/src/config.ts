/**
 * config.ts — 加载 configs/qq_config.json
 *
 * 行为与旧 index.js 保持完全一致:
 *   - 文件不存在或解析失败: 进程退出 (旧版 process.exit(1))
 *   - 字段缺失: 走默认值
 *   - reload 时仅覆盖原对象 (mutate), 保留运行时引用的同一份对象
 */

import {
  configPath,
  DEFAULT_QQ_CONFIG,
  loadEnsuredConfig,
  resolveRuntimeRoot,
  stripConfigMeta,
} from "@sfmc-bds/sdk/node/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { log } from "./log.js";
import type { QQBridgeConfig } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** 统一通过 SDK 解析项目根:env SFMC_ROOT > __dirname 上溯。 */
export const ROOT_DIR: string = resolveRuntimeRoot(resolve(__dirname, "..", ".."));
export const CFG_PATH: string = configPath(ROOT_DIR, "qq_config.json");

function applyDefaults(raw: Partial<QQBridgeConfig>): QQBridgeConfig {
  /* 以 SDK DEFAULT_QQ_CONFIG 为唯一缺省权威（DRY/LSP），再叠运行时派生字段 */
  const merged = { ...DEFAULT_QQ_CONFIG, ...raw } as Partial<QQBridgeConfig> & Record<string, unknown>;
  const stripped = stripConfigMeta(merged);
  return {
    qq_enabled: stripped.qq_enabled !== false,
    qq_ws_port: parseInt(String(stripped.qq_ws_port ?? DEFAULT_QQ_CONFIG.qq_ws_port ?? 3002), 10),
    qq_group_id: String(stripped.qq_group_id ?? DEFAULT_QQ_CONFIG.qq_group_id ?? "0"),
    bridge_channel_id: String(stripped.bridge_channel_id ?? DEFAULT_QQ_CONFIG.bridge_channel_id ?? ""),
    db_host: String(stripped.db_host ?? "127.0.0.1"),
    db_port: parseInt(String(stripped.db_port ?? "3001"), 10),
    mctoqq_prefix: String(stripped.mctoqq_prefix ?? DEFAULT_QQ_CONFIG.mctoqq_prefix ?? "[MC]"),
    ...stripped,
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

/** 进程启动时加载一次。失败直接退出,与旧实现一致。 */
export function loadInitialConfig(): QQBridgeConfig {
  try {
    return readFromDisk();
  } catch (e) {
    log.error(`无法读取配置: ${CFG_PATH}: ${(e as Error).message}`);
    process.exit(1);
  }
}

/**
 * 重新读取配置文件,合并到传入对象上 (mutate)。
 * 旧实现是 Object.assign(cfg, newCfg),保留运行时对原 cfg 对象的引用 — 同样行为。
 */
export function reloadInto(cfg: QQBridgeConfig): void {
  try {
    const fresh = readFromDisk();
    Object.assign(cfg, fresh);
  } catch (e) {
    // reload 失败不抛,旧实现也是只 log
    log.error(`重载配置失败: ${(e as Error).message}`);
  }
}
