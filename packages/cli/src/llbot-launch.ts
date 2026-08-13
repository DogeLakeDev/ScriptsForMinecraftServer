/**
 * llbot-launch.ts — 解析 LLBot 可执行文件与工作目录
 *
 * 历史向导曾把 llbot_path 写成「目录」；schema 语义是可执行文件。
 * 此处兼容二者，避免 spawn 目录导致 ENOENT。
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function defaultLlbotDir(platform = process.platform): string {
  return platform === "win32" ? "D:\\LLBot-CLI-win-x64" : path.join(os.homedir(), "LLBot");
}

export function llbotExeName(platform = process.platform): string {
  return platform === "win32" ? "llbot.exe" : "llbot";
}

export type LlbotLaunch = {
  /** spawn 用的可执行文件绝对/规范化路径 */
  exe: string;
  /** 工作目录 */
  cwd: string;
};

/**
 * @param pathRaw qq_config.llbot_path（可为 exe 或目录）
 * @param cwdRaw qq_config.llbot_cwd（目录；可空）
 */
export function resolveLlbotLaunch(pathRaw: unknown, cwdRaw: unknown): LlbotLaunch {
  const exeName = llbotExeName();
  const raw = String(pathRaw ?? "").trim();
  const cwdHint = String(cwdRaw ?? "").trim();

  const looksLikeDir = (p: string): boolean => {
    try {
      if (fs.existsSync(p) && fs.statSync(p).isDirectory()) return true;
    } catch {
      /* ignore */
    }
    // 尚不存在时：无扩展名且不以 exe 名结尾 → 按目录处理
    const base = path.basename(p);
    if (/^llbot(\.exe)?$/i.test(base)) return false;
    return !path.extname(p);
  };

  if (!raw) {
    const cwd = cwdHint || defaultLlbotDir();
    return { exe: path.join(cwd, exeName), cwd };
  }

  if (looksLikeDir(raw)) {
    const cwd = raw;
    return { exe: path.join(cwd, exeName), cwd: cwdHint || cwd };
  }

  // 明确是可执行文件路径
  const exe = raw;
  const cwd = cwdHint || path.dirname(exe) || defaultLlbotDir();
  return { exe, cwd };
}
