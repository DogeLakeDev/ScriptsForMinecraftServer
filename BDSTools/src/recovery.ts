/**
 * recovery.ts — 手动触发回滚
 *
 * 用法: node recovery.js
 * 读取 ROLLBACK_MARKER，然后从备份恢复 preserve 项。
 */

import { readRollbackMarker, rollbackFromBackup } from "./rollback.js";
import { logger, closeLogger } from "./logger.js";
import { clearPid } from "./paths.js";

async function run(): Promise<void> {
  const m = readRollbackMarker();
  if (!m) {
    logger.warn("未发现回滚标记，无需恢复。");
    return;
  }
  logger.info(`发现回滚标记: 时间 ${new Date(m.timestamp).toISOString()}`);
  logger.info(`目标: 从 ${m.backup_dir} 恢复 ${m.preserve.length} 项到 ${m.bds_path}`);

  const result = rollbackFromBackup(m);
  if (!result.ok) {
    logger.error(`回滚失败: ${result.reason}`);
    process.exit(1);
  }
  // 清理 pid 文件
  clearPid();
  logger.info("回滚完成，请手动检查并启动 BDS。");
}

function isMain(): boolean {
  if (require.main === module) return true;
  const entry = process.argv[1] ?? "";
  return entry.endsWith("recovery.js") || entry.endsWith("recovery.ts");
}

if (isMain()) {
  run()
    .then(() => {
      closeLogger();
      process.exit(0);
    })
    .catch((e) => {
      logger.error(`未捕获错误: ${(e as Error).message}`);
      closeLogger();
      process.exit(1);
    });
}
