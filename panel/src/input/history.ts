/**
 * input/history.ts — 命令历史
 *
 * - 持久化到 ~/.bds-panel.history
 * - ↑/↓ 在 history 中前后翻
 * - Ctrl+R 进入反向搜索（fzf 风格实时过滤）
 *
 * 与 store.history 字段同步：
 *   submitCommand() → pushHistory()
 *   input.focus 上 ↑ → setInput(history[cursor])
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { get, set } from "../store.js";

const HISTORY_PATH = path.join(os.homedir(), ".bds-panel.history");
const MAX_HISTORY = 500;

let _diskLoaded = false;

function loadFromDisk(): string[] {
  if (_diskLoaded) return [];
  _diskLoaded = true;
  try {
    const raw = fs.readFileSync(HISTORY_PATH, "utf-8");
    return raw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(-MAX_HISTORY);
  } catch {
    return [];
  }
}

function appendToDisk(line: string): void {
  try {
    fs.appendFileSync(HISTORY_PATH, line + "\n", "utf-8");
  } catch {
    /* non-fatal */
  }
}

/** 启动时把磁盘历史灌入 store.history（最新在末尾）。 */
export function loadHistory(): void {
  const disk = loadFromDisk();
  if (disk.length > 0) set({ history: disk });
}

/** 提交一条命令：去重（与最近一条相同则不重复入栈），追加，写盘。 */
export function pushHistory(line: string): void {
  const trimmed = line.trim();
  if (!trimmed) return;
  set((s) => {
    const last = s.history[s.history.length - 1];
    if (last === trimmed) return {}; // 去重
    const next = s.history.concat(trimmed).slice(-MAX_HISTORY);
    appendToDisk(trimmed);
    return { history: next };
  });
}

/** 反向搜索命中（fzf 风格：subsequence 匹配）。 */
export function fzfMatch(needle: string, hay: string): { score: number } | null {
  if (!needle) return { score: 0 };
  let ni = 0;
  let score = 0;
  let lastMatch = -1;
  for (let i = 0; i < hay.length && ni < needle.length; i++) {
    if (hay[i] === needle[ni]) {
      score += i - lastMatch === 1 ? 2 : 1;
      lastMatch = i;
      ni++;
    }
  }
  return ni === needle.length ? { score } : null;
}

/** 在 history 中找出 needle 的所有匹配，按 score 排序。 */
export function searchHistory(needle: string): string[] {
  const list = get().history;
  const hits: Array<{ line: string; score: number }> = [];
  for (const line of list) {
    const m = fzfMatch(needle, line);
    if (m) hits.push({ line, score: m.score });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.map((h) => h.line);
}
