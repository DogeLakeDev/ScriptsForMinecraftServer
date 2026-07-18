/**
 * paths.ts — 路径常量 & 加载 bds_updater.json
 *
 * SCRIPT_DIR = 编译产物上一级目录 (即 BDSTools/)
 * 这样无论从 src/ 还是 dist/ 调用，都能找到 scripts/bds-manager.js 等。
 */
import type { BdsUpdaterConfig } from "./types.js";
export declare const SCRIPT_DIR: string;
export declare const ROOT_DIR: string;
export declare const CFG_PATH: string;
export declare const LOG_PATH: string;
export declare const VERSION_CACHE: string;
export declare const PID_FILE: string;
export declare const ROLLBACK_MARKER: string;
/** 加载并解析 bds_updater.json */
export declare function loadConfig(): BdsUpdaterConfig;
/** 解析后的 BDS 路径 / 备份目录 */
export interface BdsPaths {
    bds_path: string;
    backup_dir: string;
    preserve: string[];
    cfg: BdsUpdaterConfig;
}
export declare function resolvePaths(cfg: BdsUpdaterConfig): BdsPaths;
/** 删除 PID 文件 */
export declare function clearPid(): void;
//# sourceMappingURL=paths.d.ts.map