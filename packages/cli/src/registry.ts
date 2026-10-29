/**
 * registry.ts — first-party sfmc-modules index resolution, shared between
 * the module CLI and the startup unknown-source warning.
 *
 * Talks to https://raw.githubusercontent.com/Tanya7z/sfmc-modules/main/index.json
 * and its jsDelivr mirror (see scripts/module-install/lib/network-sources.mjs)
 * (the registry lives in a separate repo to keep this one free of "what
 * modules exist" governance). Caches to <sfmc/src/.sfmc-registry-cache.json>
 * with a 1h TTL so a brief network blip doesn't degrade the CLI.
 *
 * Both helpers are best-effort: failures are surfaced as `null` and a
 * console warning, never an exception, because the CLI must still boot
 * when the registry is unreachable.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { DEFAULT_REGISTRY_REPO, DEFAULT_REGISTRY_TAG, MODULE_INDEX_URLS, fetchFirstJson } from "../scripts/module-install/lib/network-sources.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = path.join(__dirname, ".sfmc-registry-cache.json");
const TTL_MS = 60 * 60 * 1000;

export interface RegistryEntry {
  npm?: string;
  version?: string;
  sdk?: string;
  repo?: string;
  tag?: string;
  /** 索引里的展示名。旧缓存可能没有。 */
  name?: string;
  description?: string;
  category?: string;
  license?: string;
  official?: boolean;
  /**
   * 安装前必须已经启用的模块 id。
   * 字段缺失表示这份索引没有声明依赖，调用方应拒绝安装。
   */
  requires?: string[];
}
export type RegistryIndex = Record<string, RegistryEntry>;

interface RegistryCache {
  fetchedAt: number;
  index: RegistryIndex;
}

function readCache(): RegistryCache | null {
  try {
    if (!existsSync(CACHE_PATH)) return null;
    return JSON.parse(readFileSync(CACHE_PATH, "utf8")) as RegistryCache;
  } catch {
    return null;
  }
}

function writeCache(cache: RegistryCache): void {
  try {
    mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  } catch {
    /* cache write is best-effort */
  }
}

/**
 * 解析 first-party index.json。
 * 契约与 scripts/module-install/lib/registry-index.mjs#parseRegistryIndex 保持一致：
 * `{ modules: { <id>: { npm? | repo+tag, name?, description?, requires? } } }`。忽略 `_` 前缀元数据键。
 * requires 只有在全部是非空字符串时才保留；缺了这个字段就表示索引没有给出依赖声明。
 */
function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** 索引 requires。格式不对时返回 undefined，让安装方拒绝，而不是当成没有依赖。 */
function optionalRequires(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !item.trim()) return undefined;
    items.push(item.trim());
  }
  return items;
}

export function parseRegistryIndex(json: unknown): RegistryIndex {
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    throw new Error("registry index must be a JSON object with a 'modules' field");
  }
  const root = json as Record<string, unknown>;
  const modulesRaw = root.modules;
  if (typeof modulesRaw !== "object" || modulesRaw === null || Array.isArray(modulesRaw)) {
    throw new Error("registry index must have a 'modules' object mapping id → entry");
  }
  const filtered: RegistryIndex = {};
  for (const [k, v] of Object.entries(modulesRaw as Record<string, unknown>)) {
    if (k.startsWith("_")) continue;
    if (typeof v !== "object" || v === null || Array.isArray(v)) continue;
    const entry = v as Record<string, unknown>;
    const npm = optionalText(entry.npm);
    const repo = optionalText(entry.repo);
    const tag = optionalText(entry.tag);
    const hasNpm = Boolean(npm);
    const hasGh = Boolean(repo && tag);
    if (!hasNpm && !hasGh) continue;
    const out: RegistryEntry = {};
    if (npm) out.npm = npm;
    const version = optionalText(entry.version);
    const sdk = optionalText(entry.sdk);
    const name = optionalText(entry.name);
    const description = optionalText(entry.description);
    const category = optionalText(entry.category);
    const license = optionalText(entry.license);
    const requires = optionalRequires(entry.requires);
    if (version) out.version = version;
    if (sdk) out.sdk = sdk;
    if (repo) out.repo = repo;
    if (repo && tag) out.tag = tag;
    if (name) out.name = name;
    if (description) out.description = description;
    if (category) out.category = category;
    if (license) out.license = license;
    if (typeof entry.official === "boolean") out.official = entry.official;
    // 空数组表示没有额外依赖，必须保留；缺字段才表示索引没声明。
    if (requires !== undefined) out.requires = requires;
    filtered[k] = out;
  }
  return filtered;
}

async function fetchFresh(): Promise<RegistryIndex> {
  // 与 fetch-module 共用候选地址：GitHub 与 jsDelivr 同时请求，取先返回的一份。
  const { json } = await fetchFirstJson(MODULE_INDEX_URLS, {
    headers: { "User-Agent": "sfmc-cli" },
    timeoutMs: 3000,
  });
  return parseRegistryIndex(json);
}

export interface RegistryResult {
  index: RegistryIndex;
  /** True when the index came from a stale cache because the live fetch failed. */
  stale: boolean;
}

/**
 * Resolve the first-party index.
 *
 * Order (default):
 *   1. If the cache is fresh (< TTL): return it without trying the network.
 *   2. Otherwise attempt a live fetch.
 *      - success → write cache, return fresh.
 *      - failure + cache exists → return cache with `stale: true` and a warning.
 *      - failure + no cache → return `{ index: {}, stale: true }` and warn.
 *
 * `force: true` 跳过 TTL 早退,始终尝试拉网(供 `mod search` 主动刷新列表)。
 * 失败时仍回退到缓存,永不抛异常。
 */
export async function resolveRegistryIndex(opts?: { force?: boolean }): Promise<RegistryResult> {
  const cache = readCache();
  if (!opts?.force && cache && Date.now() - cache.fetchedAt < TTL_MS) {
    return { index: cache.index, stale: false };
  }
  try {
    const fresh = await fetchFresh();
    writeCache({ fetchedAt: Date.now(), index: fresh });
    return { index: fresh, stale: false };
  } catch (err) {
    if (cache) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[sfmc] registry offline (${msg}); using cached index from ${new Date(cache.fetchedAt).toISOString()}\n`);
      return { index: cache.index, stale: true };
    }
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[sfmc] registry unreachable and no cache: ${msg}\n`);
    return { index: {}, stale: true };
  }
}

/**
 * 从本地缓存同步读出 registry 模块 id(供 Tab 补全)。
 * 无缓存时返回空数组,不触发网络。
 */
export function listRegistryModuleIdsSync(): string[] {
  const cache = readCache();
  if (!cache) return [];
  return Object.keys(cache.index).sort((a, b) => a.localeCompare(b));
}

/**
 * Compare a set of installed module ids to the registry and return the
 * subset that isn't published in the first-party index. The "best-effort"
 * guarantee: this returns an empty array when the registry can't be reached
 * (we don't want a network outage to mark every local module as unknown).
 */
export async function findUnknownModules(installedIds: string[]): Promise<string[]> {
  const { index, stale } = await resolveRegistryIndex();
  if (stale && Object.keys(index).length === 0) {
    /* No cache either — silently treat every module as "we couldn't tell".
     * Otherwise offline mode would scream warnings at every boot. */
    return [];
  }
  return installedIds.filter((id) => !index[id]);
}

export { DEFAULT_REGISTRY_REPO, DEFAULT_REGISTRY_TAG };