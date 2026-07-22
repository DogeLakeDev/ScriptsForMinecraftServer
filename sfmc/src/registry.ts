/**
 * registry.ts — first-party sfmc-modules index resolution, shared between
 * the module CLI and the startup unknown-source warning.
 *
 * Talks to https://raw.githubusercontent.com/Tanya7z/sfmc-modules/main/index.json
 * (the registry lives in a separate repo to keep this one free of "what
 * modules exist" governance). Caches to <sfmc/src/.sfmc-registry-cache.json>
 * with a 1h TTL so a brief network blip doesn't degrade the CLI.
 *
 * Both helpers are best-effort: failures are surfaced as `null` and a
 * console warning, never an exception, because the SEA must still boot
 * when the registry is unreachable.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = path.join(__dirname, ".sfmc-registry-cache.json");
const TTL_MS = 60 * 60 * 1000;

const DEFAULT_REGISTRY_REPO = "Tanya7z/sfmc-modules";
const DEFAULT_REGISTRY_TAG = "main";
const INDEX_URL = `https://raw.githubusercontent.com/${DEFAULT_REGISTRY_REPO}/${DEFAULT_REGISTRY_TAG}/index.json`;

export interface RegistryEntry {
  repo: string;
  tag: string;
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
 * 解析 registry index.json。
 * 契约与 tools/lib/registry-index.mjs#parseRegistryIndex 保持一致：
 * `{ modules: { <folder>: { repo, tag } } }`。忽略 `_` 前缀元数据键。
 */
export function parseRegistryIndex(json: unknown): RegistryIndex {
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    throw new Error("registry index must be a JSON object with a 'modules' field");
  }
  const root = json as Record<string, unknown>;
  const modules = root.modules;
  if (typeof modules !== "object" || modules === null || Array.isArray(modules)) {
    throw new Error("registry index must have a 'modules' object mapping id → { repo, tag }");
  }
  const filtered: RegistryIndex = {};
  for (const [k, v] of Object.entries(modules as Record<string, unknown>)) {
    if (k.startsWith("_")) continue;
    if (typeof v !== "object" || v === null || Array.isArray(v)) continue;
    const entry = v as Record<string, unknown>;
    if (typeof entry.repo !== "string" || typeof entry.tag !== "string") continue;
    filtered[k] = { repo: entry.repo, tag: entry.tag };
  }
  return filtered;
}

async function fetchFresh(): Promise<RegistryIndex> {
  const res = await fetch(INDEX_URL, { headers: { "User-Agent": "sfmc-cli" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${INDEX_URL}`);
  const json = (await res.json()) as unknown;
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
 * Order:
 *   1. If the cache is fresh (< TTL): return it without trying the network.
 *   2. Otherwise attempt a live fetch.
 *      - success → write cache, return fresh.
 *      - failure + cache exists → return cache with `stale: true` and a warning.
 *      - failure + no cache → return `{ index: {}, stale: true }` and warn.
 *
 * Never throws: the unknown-source warning is best-effort.
 */
export async function resolveRegistryIndex(): Promise<RegistryResult> {
  const cache = readCache();
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) {
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
 * Compare a set of installed module ids to the registry and return the
 * subset that isn't published in the first-party index. The "best-effort"
 * guarantee: this returns an empty array when the registry can't be reached
 * (we don't want a network outage to mark every local module as unknown).
 */
export async function findUnknownModules(installedIds: string[]): Promise<string[]> {
  const { index, stale } = await resolveRegistryIndex();
  if (stale && Object.keys(index).length === 0) {
    /* No cache either — silently treat every module as "we couldn't tell".
     * Otherwise an offline SEA would scream warnings at every boot. */
    return [];
  }
  return installedIds.filter((id) => !index[id]);
}

export { DEFAULT_REGISTRY_REPO, DEFAULT_REGISTRY_TAG };