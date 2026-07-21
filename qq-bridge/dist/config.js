/**
 * config.ts — 加载 configs/qq_config.json
 *
 * 行为与旧 index.js 保持完全一致:
 *   - 文件不存在或解析失败: 进程退出 (旧版 process.exit(1))
 *   - 字段缺失: 走默认值
 *   - reload 时仅覆盖原对象 (mutate), 保留运行时引用的同一份对象
 */
import { existsSync, readFileSync } from "node:fs";
import { configPath, resolveRuntimeRoot } from "@sfmc/sdk/node/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { log } from "./log.js";
const __dirname = dirname(fileURLToPath(import.meta.url));
/** npm 模式从源码位置回退，supervisor/SEA 模式统一由 SFMC_ROOT 指定。 */
export const ROOT_DIR = resolveRuntimeRoot(resolve(__dirname, "..", ".."));
export const CFG_PATH = configPath(ROOT_DIR, "qq_config.json");
function applyDefaults(raw) {
    return {
        qq_enabled: raw.qq_enabled !== false,
        qq_ws_port: parseInt(String(raw.qq_ws_port ?? "3002"), 10),
        qq_group_id: String(raw.qq_group_id ?? ""),
        bridge_channel_id: String(raw.bridge_channel_id ?? ""),
        db_host: String(raw.db_host ?? "127.0.0.1"),
        db_port: parseInt(String(raw.db_port ?? "3001"), 10),
        mctoqq_prefix: String(raw.mctoqq_prefix ?? "[MC]"),
        ...raw,
    };
}
function readFromDisk() {
    if (!existsSync(CFG_PATH)) {
        throw new Error(`配置文件不存在: ${CFG_PATH}`);
    }
    const raw = JSON.parse(readFileSync(CFG_PATH, "utf-8"));
    return applyDefaults(raw);
}
/** 进程启动时加载一次。失败直接退出,与旧实现一致。 */
export function loadInitialConfig() {
    try {
        return readFromDisk();
    }
    catch (e) {
        log.error(`无法读取配置: ${CFG_PATH}: ${e.message}`);
        process.exit(1);
    }
}
/**
 * 重新读取配置文件,合并到传入对象上 (mutate)。
 * 旧实现是 Object.assign(cfg, newCfg),保留运行时对原 cfg 对象的引用 — 同样行为。
 */
export function reloadInto(cfg) {
    try {
        const fresh = readFromDisk();
        Object.assign(cfg, fresh);
    }
    catch (e) {
        // reload 失败不抛,旧实现也是只 log
        log.error(`重载配置失败: ${e.message}`);
    }
}
//# sourceMappingURL=config.js.map