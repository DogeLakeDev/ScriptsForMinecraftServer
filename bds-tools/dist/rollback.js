"use strict";
/**
 * rollback.ts — 回滚支持
 *
 * 在更新开始前记录: 当前 BDS 目录 + 备份目录。
 * 主流程任意阶段失败时，尝试反向恢复 preserves 到 BDS_PATH，
 * 然后从备份重新放回 preserve 内容，恢复旧配置。
 *
 * 持久化: ROLLBACK_MARKER (BDSTools/.last_update_rollback.json) 用于跨进程记录。
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDirSize = void 0;
exports.writeRollbackMarker = writeRollbackMarker;
exports.clearRollbackMarker = clearRollbackMarker;
exports.readRollbackMarker = readRollbackMarker;
exports.rollbackFromBackup = rollbackFromBackup;
exports.verifyBdsInstall = verifyBdsInstall;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const paths_js_1 = require("./paths.js");
const fsx_js_1 = require("./fsx.js");
Object.defineProperty(exports, "getDirSize", { enumerable: true, get: function () { return fsx_js_1.getDirSize; } });
const log_js_1 = require("./log.js");
/** 在备份完成后调用: 记录快照指示符。 */
function writeRollbackMarker(marker) {
    try {
        node_fs_1.default.writeFileSync(paths_js_1.ROLLBACK_MARKER, JSON.stringify(marker, null, 2));
        log_js_1.log.info(`[回滚] 已记录回滚标记 -> ${paths_js_1.ROLLBACK_MARKER}`);
    }
    catch (e) {
        log_js_1.log.warn(`[回滚] 无法写入标记: ${e.message}`);
    }
}
function clearRollbackMarker() {
    try {
        if (node_fs_1.default.existsSync(paths_js_1.ROLLBACK_MARKER))
            node_fs_1.default.unlinkSync(paths_js_1.ROLLBACK_MARKER);
    }
    catch {
        /* ignore */
    }
}
function readRollbackMarker() {
    try {
        if (!node_fs_1.default.existsSync(paths_js_1.ROLLBACK_MARKER))
            return null;
        return JSON.parse(node_fs_1.default.readFileSync(paths_js_1.ROLLBACK_MARKER, "utf-8"));
    }
    catch {
        return null;
    }
}
/**
 * 紧急回滚: 把 preserve 项从 backup_dir 拷回 bds_path。
 * 用法: 在 catch 分支调用，如果主流程失败导致 BDS 目录破坏。
 */
function rollbackFromBackup(marker) {
    const { bds_path, backup_dir, preserve } = marker;
    if (!node_fs_1.default.existsSync(backup_dir)) {
        return { ok: false, reason: `备份目录不存在: ${backup_dir}` };
    }
    log_js_1.log.warn(`[回滚] 开始恢复 ${preserve.length} 项到 ${bds_path}`);
    for (const item of preserve) {
        const src = node_path_1.default.join(backup_dir, item);
        const dest = node_path_1.default.join(bds_path, item);
        if (!node_fs_1.default.existsSync(src)) {
            log_js_1.log.warn(`[回滚] 跳过 (备份中不存在): ${item}`);
            continue;
        }
        try {
            // 先确保目标目录存在 (BDS 目录可能已被解压覆盖为空)
            const destDir = node_path_1.default.dirname(dest);
            if (!node_fs_1.default.existsSync(destDir))
                node_fs_1.default.mkdirSync(destDir, { recursive: true });
            if (node_fs_1.default.statSync(src).isDirectory()) {
                // 先删除目标，再复制目录
                if (node_fs_1.default.existsSync(dest))
                    (0, fsx_js_1.emptyDirSync)(dest);
                (0, fsx_js_1.copyDirSync)(src, dest);
            }
            else {
                node_fs_1.default.copyFileSync(src, dest);
            }
            log_js_1.log.info(`[回滚] 已恢复: ${item}`);
        }
        catch (e) {
            log_js_1.log.warn(`[回滚] 恢复失败 ${item}: ${e.message}`);
        }
    }
    return { ok: true };
}
/** 检查 BDS_PATH 中关键文件是否都还在 (更新后完整性 sanity check) */
function verifyBdsInstall(bds_path, expected) {
    const missing = [];
    for (const f of expected) {
        if (!node_fs_1.default.existsSync(node_path_1.default.join(bds_path, f)))
            missing.push(f);
    }
    return { ok: missing.length === 0, missing };
}
//# sourceMappingURL=rollback.js.map