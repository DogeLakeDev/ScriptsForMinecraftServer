/**
 * rollback.ts — 回滚支持
 *
 * 在更新开始前记录: 当前 BDS 目录 + 备份目录。
 * 主流程任意阶段失败时，尝试反向恢复 preserves 到 BDS_PATH，
 * 然后从备份重新放回 preserve 内容，恢复旧配置。
 *
 * 持久化: ROLLBACK_MARKER (BDSTools/.last_update_rollback.json) 用于跨进程记录。
 */
import { getDirSize } from "./fsx.js";
export interface RollbackMarker {
    timestamp: number;
    bds_path: string;
    backup_dir: string;
    preserve: string[];
    previous_version: string;
}
/** 在备份完成后调用: 记录快照指示符。 */
export declare function writeRollbackMarker(marker: RollbackMarker): void;
export declare function clearRollbackMarker(): void;
export declare function readRollbackMarker(): RollbackMarker | null;
/**
 * 紧急回滚: 把 preserve 项从 backup_dir 拷回 bds_path。
 * 用法: 在 catch 分支调用，如果主流程失败导致 BDS 目录破坏。
 */
export declare function rollbackFromBackup(marker: RollbackMarker): {
    ok: boolean;
    reason?: string;
};
/** 检查 BDS_PATH 中关键文件是否都还在 (更新后完整性 sanity check) */
export declare function verifyBdsInstall(bds_path: string, expected: string[]): {
    ok: boolean;
    missing: string[];
};
export { getDirSize };
//# sourceMappingURL=rollback.d.ts.map