"use strict";
/**
 * paths.ts — 路径常量 & 加载 bds_updater.json
 *
 * SCRIPT_DIR = 编译产物上一级目录 (即 BDSTools/)
 * 这样无论从 src/ 还是 dist/ 调用，都能找到 scripts/bds-manager.js 等。
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLLBACK_MARKER = exports.PID_FILE = exports.VERSION_CACHE = exports.LOG_PATH = exports.CFG_PATH = exports.ROOT_DIR = exports.SCRIPT_DIR = void 0;
exports.loadConfig = loadConfig;
exports.resolvePaths = resolvePaths;
exports.clearPid = clearPid;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
// __dirname 在 dist/ 时 = BDSTools/dist/，在 src/ 时 = BDSTools/src/
// 用 basename 判断是否在 dist 子目录 → 上跳一层回到 BDSTools
function detectScriptDir() {
    const here = __dirname;
    const base = node_path_1.default.basename(here);
    if (base === "dist" || base === "src") {
        return node_path_1.default.resolve(here, "..");
    }
    return here;
}
exports.SCRIPT_DIR = detectScriptDir();
exports.ROOT_DIR = node_path_1.default.resolve(exports.SCRIPT_DIR, "..");
exports.CFG_PATH = node_path_1.default.join(exports.ROOT_DIR, "configs", "bds_updater.json");
exports.LOG_PATH = node_path_1.default.join(exports.SCRIPT_DIR, "update.log");
exports.VERSION_CACHE = node_path_1.default.join(exports.SCRIPT_DIR, ".version_cache.json");
exports.PID_FILE = node_path_1.default.join(exports.SCRIPT_DIR, ".bds.pid");
exports.ROLLBACK_MARKER = node_path_1.default.join(exports.SCRIPT_DIR, ".last_update_rollback.json");
/** 加载并解析 bds_updater.json */
function loadConfig() {
    try {
        const raw = node_fs_1.default.readFileSync(exports.CFG_PATH, "utf-8");
        const cfg = JSON.parse(raw);
        delete cfg._comment;
        return cfg;
    }
    catch (e) {
        throw new Error(`无法读取 ${exports.CFG_PATH}: ${e.message}`);
    }
}
function resolvePaths(cfg) {
    const bds_path = node_path_1.default.resolve(cfg.bds_path || process.cwd());
    const backup_dir = node_path_1.default.resolve(cfg.backup_dir || node_path_1.default.join(bds_path, "..", "backups"));
    const preserve = Array.isArray(cfg.preserve) ? cfg.preserve : [];
    return { bds_path, backup_dir, preserve, cfg };
}
/** 删除 PID 文件 */
function clearPid() {
    try {
        if (node_fs_1.default.existsSync(exports.PID_FILE))
            node_fs_1.default.unlinkSync(exports.PID_FILE);
    }
    catch {
        /* ignore */
    }
}
//# sourceMappingURL=paths.js.map