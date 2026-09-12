/**
 * ui-studio/save.ts — UI 工程文件的原子保存（Node 侧写路径唯一收口）。
 *
 * 设计文档「保存、兼容与恢复」要求：
 * - 写入限定在 ui/ 工程根内，拒绝绝对路径与 `..` 越界；
 * - 保存采用临时文件 + 原子替换，避免半截文件；
 * - 首次改写旧版本前创建可恢复备份（每会话每文件一次）；
 * - 客户端在内存中保留原始 JSON 对象，未知字段随文档整体回写，不丢失。
 *
 * 切片 2 仅允许覆盖「已存在」的文件；新建页面文件在后续切片开放。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { isInside } from "./project.js";

/** 保存失败时抛出，消息面向 Studio 用户。 */
export class UiStudioSaveError extends Error {}

export interface SaveUiProjectFileOptions {
  /** ui/ 工程根绝对路径。 */
  uiRoot: string;
  /** 目标文件相对 uiRoot 的路径（如 feature.ui.json、screens/home.ui.json）。 */
  relativePath: string;
  /** 完整文件文档（将序列化为两空格缩进 JSON）。 */
  document: unknown;
  /** 会话标识，用于备份文件命名。 */
  sessionId: string;
  /** 会话内已完成备份的文件（绝对路径），由调用方持有。 */
  backupsDone: Set<string>;
}

/** 备份目录：uiRoot/.ui-studio/backups/。 */
function backupDir(uiRoot: string): string {
  return path.join(uiRoot, ".ui-studio", "backups");
}

/** 备份文件名：相对路径中的分隔符拍平为 __，附加会话标识。 */
function backupName(relativePath: string, sessionId: string): string {
  const flat = relativePath.split(/[\\/]+/).join("__");
  return `${flat}.${sessionId}.bak`;
}

let tmpCounter = 0;

/**
 * 原子保存一个工程文件，返回目标绝对路径。
 * 流程：路径校验 → 首次备份 → 写临时文件 → rename 替换。
 */
export async function saveUiProjectFile(
  options: SaveUiProjectFileOptions,
): Promise<string> {
  const { uiRoot, relativePath, document, sessionId, backupsDone } = options;

  // 路径安全：必须相对、限定 uiRoot 内、且为 .json 文件。
  if (!relativePath || path.isAbsolute(relativePath)) {
    throw new UiStudioSaveError(`非法文件路径：${relativePath || "（空）"}`);
  }
  const target = path.resolve(uiRoot, relativePath);
  if (!isInside(uiRoot, target)) {
    throw new UiStudioSaveError(`文件路径越出 ui 目录，已拒绝写入：${relativePath}`);
  }
  if (!target.toLowerCase().endsWith(".json")) {
    throw new UiStudioSaveError(`仅允许写入 .json 文件：${relativePath}`);
  }

  // 切片 2：只允许覆盖已存在文件，避免误建孤儿文件。
  try {
    const stat = await fs.stat(target);
    if (!stat.isFile()) throw new UiStudioSaveError(`目标不是文件：${relativePath}`);
  } catch (error) {
    if (error instanceof UiStudioSaveError) throw error;
    throw new UiStudioSaveError(`目标文件不存在（新建文件将在后续版本支持）：${relativePath}`);
  }

  // 首次改写前备份旧版本，每会话每文件一次。
  if (!backupsDone.has(target)) {
    const dir = backupDir(uiRoot);
    await fs.mkdir(dir, { recursive: true });
    await fs.copyFile(target, path.join(dir, backupName(relativePath, sessionId)));
    backupsDone.add(target);
  }

  // 临时文件 + rename：同目录保证同一文件系统，rename 为原子操作。
  const text = `${JSON.stringify(document, null, 2)}\n`;
  tmpCounter += 1;
  const tmp = path.join(
    path.dirname(target),
    `.${path.basename(target)}.tmp-${process.pid}-${tmpCounter}`,
  );
  try {
    await fs.writeFile(tmp, text, "utf8");
    await fs.rename(tmp, target);
  } catch (error) {
    await fs.rm(tmp, { force: true }).catch(() => undefined);
    throw new UiStudioSaveError(
      `写入 ${relativePath} 失败：${(error as Error).message}`,
    );
  }
  return target;
}
