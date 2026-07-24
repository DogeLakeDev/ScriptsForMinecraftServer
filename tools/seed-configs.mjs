#!/usr/bin/env node
/**
 * seed-configs.mjs — 用 SDK ensureCoreConfigs 播种 configs/（不启 HTTP 服务）
 *
 * 替代 ootb 里「拉起 db-server 等 /api/health」的脆弱路径（DIP：依赖配置抽象而非服务进程）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ensureCoreConfigs,
  configDir,
} from "@sfmc-bds/sdk/node/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.SFMC_ROOT ? path.resolve(process.env.SFMC_ROOT) : path.resolve(__dirname, "..");

const kinds = ["db_config", "qq_config", "bds_updater", "permissions", "remote"];

fs.mkdirSync(configDir(ROOT), { recursive: true });
ensureCoreConfigs(ROOT, kinds);

const need = ["db_config.json", "qq_config.json", "bds_updater.json", "permissions.json", "remote.json"];
const missing = need.filter((n) => !fs.existsSync(path.join(configDir(ROOT), n)));
if (missing.length) {
  console.error(`[seed-configs] FAIL: 仍缺少 ${missing.join(", ")}`);
  process.exit(1);
}

for (const n of need) {
  console.log(`[seed-configs] ok ${n}`);
}
