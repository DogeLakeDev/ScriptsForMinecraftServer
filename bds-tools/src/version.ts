/**
 * version.ts — 版本号工具 / 版本缓存
 */

import { readJson, writeJson } from "@sfmc/sdk/node/config";
import fs from "node:fs";
import { VERSION_CACHE } from "./paths.js";
import { hashFileSync, hashFileAsync } from "./fsx.js";
import { log } from "./log.js";

/** 4段 → 3段 (去尾) */
export function toVer3(v: string): string {
  return v.split(".").slice(0, 3).join(".");
}

/** 3段 → 4段 (补 0) */
export function toVer4(v: string): string {
  const p = v.split(".");
  while (p.length < 4) p.push("0");
  return p.join(".");
}

/** 版本比较 (按 4 段数字排序) */
export function compareVersions(a: string, b: string): number {
  const sa = a.replace(/-preview$/, "");
  const sb = b.replace(/-preview$/, "");
  const pa = sa.split(".").map(Number);
  const pb = sb.split(".").map(Number);
  for (let i = 0; i < 4; i++) {
    const ai = pa[i] ?? 0;
    const bi = pb[i] ?? 0;
    if (ai !== bi) return ai - bi;
  }
  // preview 低于不带 -preview 的同一数字
  if (a.endsWith("-preview") && !b.endsWith("-preview")) return -1;
  if (!a.endsWith("-preview") && b.endsWith("-preview")) return 1;
  return 0;
}

/** 简单的真值校验 (按版本号外形) */
export function isValidVersion(v: string): boolean {
  return /^\d+\.\d+\.\d+(\.\d+)?(-preview)?$/.test(v);
}

/** 缓存条目类型 */
interface CacheEntry {
  sha256: string;
  verified_at: number;
}

function readCache(): Record<string, CacheEntry> {
  return readJson<Record<string, CacheEntry>>(VERSION_CACHE) ?? {};
}

/** 仅保留最近 3 条版本缓存 (避免无限增长) */
function trimCache(cache: Record<string, CacheEntry>): Record<string, CacheEntry> {
  const keys = Object.keys(cache).sort(compareVersions).slice(-3);
  const trimmed: Record<string, CacheEntry> = {};
  for (const k of keys) trimmed[k] = cache[k]!;
  return trimmed;
}

export function saveVersionCache(version: string, sha256: string): void {
  const cache = readCache();
  cache[version] = { sha256, verified_at: Date.now() };
  try {
    writeJson(VERSION_CACHE, trimCache(cache));
  } catch {
    /* ignore */
  }
}

/**
 * 异步识别当前 BDS 版本
 * 优先通过 SHA256 反查缓存，失败则回退 `current_version.txt`（如果存在）
 */
export async function getCurrentVersionAsync(exePath: string): Promise<string> {
  if (!fs.existsSync(exePath)) return "0.0.0.0";
  const actual = await hashFileAsync(exePath, "sha256");
  if (!actual) return "0.0.0.0";

  const cache = readCache();
  for (const [ver, entry] of Object.entries(cache)) {
    if (entry.sha256 === actual) return ver;
  }
  log.warn("[BDSUpdater] bedrock_server.exe 哈希未匹配缓存，疑似被改动或首次启动");
  return "0.0.0.0";
}

/** 同步版本 (兼容旧流程) */
export function getCurrentVersionSync(exePath: string): string {
  if (!fs.existsSync(exePath)) return "0.0.0.0";
  const actual = hashFileSync(exePath, "sha256");
  if (!actual) return "0.0.0.0";
  const cache = readCache();
  for (const [ver, entry] of Object.entries(cache)) {
    if (entry.sha256 === actual) return ver;
  }
  log.warn("[BDSUpdater] bedrock_server.exe 哈希未匹配缓存");
  return "0.0.0.0";
}
