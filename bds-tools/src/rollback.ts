/**
 * rollback.ts — 回滚支持
 *
 * 在更新开始前记录: 当前 BDS 目录 + 备份目录。
 * 主流程任意阶段失败时，尝试反向恢复 preserves 到 BDS_PATH，
 * 然后从备份重新放回 preserve 内容，恢复旧配置。
 *
 * 持久化: ROLLBACK_MARKER (BDSTools/.last_update_rollback.json) 用于跨进程记录。
 */

import { readJson, writeJson } from "@sfmc-bds/sdk/node/config";
import fs from "node:fs";
import path from "node:path";
import { ROLLBACK_MARKER } from "./paths.js";
import { copyDirSync, getDirSize, emptyDirSync } from "./fsx.js";
import { log } from "./log.js";

export interface RollbackMarker {
  timestamp: number;
  bds_path: string;
  backup_dir: string;
  preserve: string[];
  previous_version: string;
}

/** 在备份完成后调用: 记录快照指示符。 */
export function writeRollbackMarker(marker: RollbackMarker): void {
  try {
    writeJson(ROLLBACK_MARKER, marker);
    log.info(`[回滚] 已记录回滚标记 -> ${ROLLBACK_MARKER}`);
  } catch (e) {
    log.warn(`[回滚] 无法写入标记: ${(e as Error).message}`);
  }
}

export function clearRollbackMarker(): void {
  try {
    if (fs.existsSync(ROLLBACK_MARKER)) fs.unlinkSync(ROLLBACK_MARKER);
  } catch {
    /* ignore */
  }
}

export function readRollbackMarker(): RollbackMarker | null {
  return readJson<RollbackMarker>(ROLLBACK_MARKER) ?? null;
}

/**
 * 紧急回滚: 把 preserve 项从 backup_dir 拷回 bds_path。
 * 用法: 在 catch 分支调用，如果主流程失败导致 BDS 目录破坏。
 */
export function rollbackFromBackup(marker: RollbackMarker): { ok: boolean; reason?: string } {
  const { bds_path, backup_dir, preserve } = marker;
  if (!fs.existsSync(backup_dir)) {
    return { ok: false, reason: `备份目录不存在: ${backup_dir}` };
  }
  log.warn(`[回滚] 开始恢复 ${preserve.length} 项到 ${bds_path}`);
  for (const item of preserve) {
    const src = path.join(backup_dir, item);
    const dest = path.join(bds_path, item);
    if (!fs.existsSync(src)) {
      log.warn(`[回滚] 跳过 (备份中不存在): ${item}`);
      continue;
    }
    try {
      // 先确保目标目录存在 (BDS 目录可能已被解压覆盖为空)
      const destDir = path.dirname(dest);
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
      if (fs.statSync(src).isDirectory()) {
        // 先删除目标，再复制目录
        if (fs.existsSync(dest)) emptyDirSync(dest);
        copyDirSync(src, dest);
      } else {
        fs.copyFileSync(src, dest);
      }
      log.info(`[回滚] 已恢复: ${item}`);
    } catch (e) {
      log.warn(`[回滚] 恢复失败 ${item}: ${(e as Error).message}`);
    }
  }
  return { ok: true };
}

/** 检查 BDS_PATH 中关键文件是否都还在 (更新后完整性 sanity check) */
export function verifyBdsInstall(bds_path: string, expected: string[]): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  for (const f of expected) {
    if (!fs.existsSync(path.join(bds_path, f))) missing.push(f);
  }
  return { ok: missing.length === 0, missing };
}

export { getDirSize };
