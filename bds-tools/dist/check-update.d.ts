/**
 * check-update.ts — BDS 自动更新器 (主流程)
 *
 *   1. 临时 staging 目录 (mkdtempSync) - 避免污染 SCRIPT_DIR
 *   2. 下载/解压失败 → 自动从备份回滚 preserves
 *   3. 流式 SHA256 校验 - 不把 250MB 文件读入内存
 *   4. 兼容版本白名单 - 不匹配则跳过升级
 *   5. QQ 通知统一加 5s 超时 - 永远不阻塞主流程
 *   6. Rollback marker 落盘 - 跨进程 / 跨重启可恢复
 */
export declare function runUpdate(): Promise<number>;
//# sourceMappingURL=check-update.d.ts.map