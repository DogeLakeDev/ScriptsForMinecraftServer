// @ts-check
/**
 * 官方模块索引缓存。
 * fetch-module 与模块更新共用同一份缓存文件，避免两套 TTL。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseRegistryIndex } from "./registry-index.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 与历史 fetch-module 常量一致，供 search 文案引用。 */
export const DEFAULT_REGISTRY_REPO = "Tanya7z/sfmc-modules";
export const DEFAULT_REGISTRY_TAG = "main";
export const DEFAULT_REGISTRY_INDEX_URL = `https://raw.githubusercontent.com/${DEFAULT_REGISTRY_REPO}/${DEFAULT_REGISTRY_TAG}/index.json`;

/** 缓存落在 module-install 目录，和原先 fetch-module 旁边的文件是同一个。 */
const REGISTRY_CACHE_PATH = path.join(__dirname, "..", ".sfmc-registry-cache.json");
const REGISTRY_CACHE_TTL_MS = 60 * 60 * 1000;

function readCache() {
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_CACHE_PATH, "utf8"));
  } catch {
    return null;
  }
}

/** 只读缓存，安装落盘时用来判断模块是否属于官方索引，不再打一次网络。 */
export function readCachedRegistryIndex() {
  const cache = readCache();
  return cache?.index ?? null;
}

/**
 * @param {{ fetchedAt: number, index: Record<string, import("./registry-index.mjs").RegistryEntry> }} cache
 */
function writeCache(cache) {
  try {
    fs.writeFileSync(REGISTRY_CACHE_PATH, JSON.stringify(cache, null, 2));
  } catch {
    /* best-effort */
  }
}

async function fetchRegistryIndexFresh() {
  // BDS beforeStart 会等这次索引请求。8 秒超时与 dist-tag 同量级，超时或失败后仍由 resolveRegistryIndex 的 catch 回退缓存。
  const res = await fetch(DEFAULT_REGISTRY_INDEX_URL, {
    headers: { "User-Agent": "sfmc-fetch-module" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${DEFAULT_REGISTRY_INDEX_URL}`);
  return parseRegistryIndex(await res.json());
}

/**
 * 解析官方索引。
 * 缓存未过期时仍尝试拉新；失败则用缓存。完全没有缓存且网络失败时抛出。
 * @returns {Promise<{ index: Record<string, import("./registry-index.mjs").RegistryEntry>, stale: boolean }>}
 */
export async function resolveRegistryIndex() {
  const cache = readCache();
  if (cache && Date.now() - cache.fetchedAt < REGISTRY_CACHE_TTL_MS) {
    try {
      const fresh = await fetchRegistryIndexFresh();
      writeCache({ fetchedAt: Date.now(), index: fresh });
      return { index: fresh, stale: false };
    } catch {
      return { index: cache.index, stale: false };
    }
  }
  try {
    const fresh = await fetchRegistryIndexFresh();
    writeCache({ fetchedAt: Date.now(), index: fresh });
    return { index: fresh, stale: false };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (cache) {
      console.warn(
        `[fetch-module] registry offline (${message}); using cached index from ${new Date(cache.fetchedAt).toISOString()}`
      );
      return { index: cache.index, stale: true };
    }
    throw new Error(`registry unreachable and no cache: ${message}. Pass --from explicitly to skip the registry.`);
  }
}
