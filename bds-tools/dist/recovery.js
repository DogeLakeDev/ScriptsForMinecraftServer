"use strict";
/**
 * recovery.ts — 手动触发回滚
 *
 * 用法: node recovery.js
 * 读取 ROLLBACK_MARKER，然后从备份恢复 preserve 项。
 */
Object.defineProperty(exports, "__esModule", { value: true });
const rollback_js_1 = require("./rollback.js");
const logger_js_1 = require("./logger.js");
const paths_js_1 = require("./paths.js");
async function run() {
    const m = (0, rollback_js_1.readRollbackMarker)();
    if (!m) {
        logger_js_1.logger.warn("未发现回滚标记，无需恢复。");
        return;
    }
    logger_js_1.logger.info(`发现回滚标记: 时间 ${new Date(m.timestamp).toISOString()}`);
    logger_js_1.logger.info(`目标: 从 ${m.backup_dir} 恢复 ${m.preserve.length} 项到 ${m.bds_path}`);
    const result = (0, rollback_js_1.rollbackFromBackup)(m);
    if (!result.ok) {
        logger_js_1.logger.error(`回滚失败: ${result.reason}`);
        process.exit(1);
    }
    // 清理 pid 文件
    (0, paths_js_1.clearPid)();
    logger_js_1.logger.info("回滚完成，请手动检查并启动 BDS。");
}
function isMain() {
    if (require.main === module)
        return true;
    const entry = process.argv[1] ?? "";
    return entry.endsWith("recovery.js") || entry.endsWith("recovery.ts");
}
if (isMain()) {
    run()
        .then(() => {
        (0, logger_js_1.closeLogger)();
        process.exit(0);
    })
        .catch((e) => {
        logger_js_1.logger.error(`未捕获错误: ${e.message}`);
        (0, logger_js_1.closeLogger)();
        process.exit(1);
    });
}
//# sourceMappingURL=recovery.js.map