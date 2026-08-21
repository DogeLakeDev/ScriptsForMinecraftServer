// @ts-check
/**
 * 用 SDK ensureCoreConfigs 播种 configs/（不启 HTTP）
 */
import fs from "node:fs";
import path from "node:path";
import { ensureCoreConfigs, configDir } from "@sfmc-bds/sdk/node/config";
import { CONFIGS_DIR, ROOT } from "../paths.mjs";
import { exists } from "../io.mjs";

const CORE_KINDS = ["db_config", "qq_config", "bds_updater", "permissions"];
const CORE_FILES = [
  "db_config.json",
  "qq_config.json",
  "bds_updater.json",
  "permissions.json",
];

/**
 * @param {string} [root]
 * @returns {{ ok: true } | { ok: false; error: string }}
 */
export function seedCoreConfigs(root = ROOT) {
  try {
    fs.mkdirSync(configDir(root), { recursive: true });
    // @ts-ignore ensureCoreConfigs 接受 root + kinds
    ensureCoreConfigs(root, CORE_KINDS);
    const missing = CORE_FILES.filter((n) => !fs.existsSync(path.join(configDir(root), n)));
    if (missing.length) {
      return { ok: false, error: `仍缺少 ${missing.join(", ")}` };
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message };
  }
}

/** @param {string} [root] */
export function coreConfigsReady(root = ROOT) {
  const absent = CORE_FILES.filter((n) => !exists(path.join(root === ROOT ? CONFIGS_DIR : path.join(root, "configs"), n)));
  return absent.length === 0 ? { ok: true } : { ok: false, error: `缺少: ${absent.join(", ")}` };
}
