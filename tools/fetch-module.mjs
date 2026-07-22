#!/usr/bin/env node
/**
 * tools/fetch-module.mjs — 从 registry / GitHub / zip / dir 安装模块到 modules/packages/<id>/
 *
 * 安装成功后会把 sapi/manifest.json 投影写入 modules/catalog.json，
 * 并按 enabledByDefault 更新 modules/module-lock.json。
 *
 * Usage:
 *   node tools/fetch-module.mjs search
 *   node tools/fetch-module.mjs list [--from github:owner/repo@tag]
 *   node tools/fetch-module.mjs install <id> [id2 ...] [--from <source>] [--sha256 <hex>]
 *   node tools/fetch-module.mjs uninstall <id> [id2 ...]
 *
 * Sources: local:<zip> | dir:<path> | github:owner/repo[@tag]
 * 省略 --from 时查 Tanya7z/sfmc-modules index.json
 */

import fs, { createReadStream } from "node:fs";
import fsp from "node:fs/promises";
import { createHash } from "node:crypto";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { upsertCatalogEntry, removeCatalogEntry } from "./lib/catalog.mjs";
import { setModuleLockEnabled, removeModuleLock } from "./lib/lock.mjs";
import { PACKAGES_DIR, ROOT } from "./lib/paths.mjs";
import { exists } from "./lib/io.mjs";
import { parseRegistryIndex } from "./lib/registry-index.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARGET = PACKAGES_DIR;

const DEFAULT_REGISTRY_REPO = "Tanya7z/sfmc-modules";
const DEFAULT_REGISTRY_TAG = "main";
const DEFAULT_REGISTRY_INDEX_URL = `https://raw.githubusercontent.com/${DEFAULT_REGISTRY_REPO}/${DEFAULT_REGISTRY_TAG}/index.json`;
const REGISTRY_CACHE_PATH = path.join(__dirname, ".sfmc-registry-cache.json");
const REGISTRY_CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * @typedef {{ repo: string, tag: string }} RegistryEntry
 * @typedef {Record<string, RegistryEntry>} RegistryIndex
 * @typedef {{ fetchedAt: number, index: RegistryIndex }} RegistryCache
 */

function readCache() {
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_CACHE_PATH, "utf8"));
  } catch {
    return null;
  }
}

function writeCache(cache) {
  try {
    fs.writeFileSync(REGISTRY_CACHE_PATH, JSON.stringify(cache, null, 2));
  } catch {
    /* best-effort */
  }
}

async function fetchRegistryIndexFresh() {
  const res = await fetch(DEFAULT_REGISTRY_INDEX_URL, { headers: { "User-Agent": "sfmc-fetch-module" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${DEFAULT_REGISTRY_INDEX_URL}`);
  const json = await res.json();
  return parseRegistryIndex(json);
}

async function resolveRegistryIndex() {
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
  } catch (err) {
    if (cache) {
      console.warn(
        `[fetch-module] registry offline (${err.message}); using cached index from ${new Date(cache.fetchedAt).toISOString()}`
      );
      return { index: cache.index, stale: true };
    }
    throw new Error(
      `registry unreachable and no cache: ${err.message}. Pass --from explicitly to skip the registry.`
    );
  }
}

async function defaultSourceFor(id) {
  const { index } = await resolveRegistryIndex();
  const entry = index[id];
  if (!entry || !entry.repo) {
    const known = Object.keys(index).sort().join(", ");
    throw new Error(
      `module "${id}" not found in first-party registry. Known: ${known || "(empty)"}. Pass --from explicitly.`
    );
  }
  return `github:${entry.repo}@${entry.tag}`;
}

function die(msg, code = 1) {
  console.error(`[fetch-module] ${msg}`);
  process.exit(code);
}

function parseArgs(args) {
  const flags = { from: null, sha256: null };
  /** @type {string[]} */
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--from") flags.from = args[++i];
    else if (a === "--sha256") flags.sha256 = args[++i];
    else if (a.startsWith("--from=")) flags.from = a.slice("--from=".length);
    else if (a.startsWith("--")) die(`unknown flag: ${a}`);
    else positional.push(a);
  }
  return { flags, positional };
}

async function ensureTarget(id) {
  const dir = path.join(TARGET, id);
  await fsp.rm(dir, { recursive: true, force: true });
  await fsp.mkdir(dir, { recursive: true });
  return dir;
}

async function sha256OfFile(file) {
  const hash = createHash("sha256");
  await pipeline(createReadStream(file), async function* (src) {
    for await (const chunk of src) {
      hash.update(chunk);
      yield chunk;
    }
  });
  return hash.digest("hex");
}

async function fetchToBuffer(url) {
  const res = await fetch(url, { headers: { "User-Agent": "sfmc-fetch-module" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/** 安装落盘后同步 catalog + lock */
function afterInstall(folder) {
  const entry = upsertCatalogEntry(folder);
  setModuleLockEnabled(entry.id, entry.enabledByDefault !== false);
  console.log(`[fetch-module]   catalog+lock: ${entry.id} (enabled=${entry.enabledByDefault !== false})`);
  return entry;
}

async function fromLocal(id, source, flags) {
  const zipPath = source.slice("local:".length);
  if (!exists(zipPath)) die(`local zip not found: ${zipPath}`);
  const actual = await sha256OfFile(zipPath);
  if (flags.sha256 && flags.sha256.toLowerCase() !== actual) {
    die(`SHA-256 mismatch (local): expected ${flags.sha256}, got ${actual}`);
  }
  const dir = await ensureTarget(id);
  await unzip(zipPath, dir);
  console.log(`[fetch-module] installed ${id} from ${zipPath}`);
  console.log(`[fetch-module]   sha256: ${actual}`);
  console.log(`[fetch-module]   target: ${dir}`);
  afterInstall(id);
}

async function fromDir(id, source) {
  const srcDir = source.slice("dir:".length);
  if (!exists(srcDir)) die(`local dir not found: ${srcDir}`);
  const dir = await ensureTarget(id);
  await copyDir(srcDir, dir);
  console.log(`[fetch-module] installed ${id} from dir ${srcDir}`);
  console.log(`[fetch-module]   target: ${dir}`);
  afterInstall(id);
}

async function fromGithub(id, source, flags) {
  let owner,
    repo,
    tag = "latest";
  const body = source.slice("github:".length);
  const tagIdx = body.lastIndexOf("@");
  if (tagIdx > 0) {
    tag = body.slice(tagIdx + 1);
    [owner, repo] = body.slice(0, tagIdx).split("/");
  } else {
    [owner, repo] = body.split("/");
  }
  if (!owner || !repo) die(`invalid github source: ${source}`);

  const releasePath = tag === "latest" ? "latest" : `tags/${encodeURIComponent(tag)}`;
  const releaseUrl = `https://api.github.com/repos/${owner}/${repo}/releases/${releasePath}`;
  const relRes = await fetch(releaseUrl, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "sfmc-fetch-module" },
  });
  if (!relRes.ok) die(`github release ${releaseUrl} → HTTP ${relRes.status}`);
  const rel = await relRes.json();

  const assetRe = /^sfmc-module-([a-z0-9-]+)-(\d+\.\d+\.\d+)\.zip$/;
  let asset = null;
  for (const a of rel.assets ?? []) {
    const m = assetRe.exec(a.name);
    if (m && m[1] === id) {
      asset = a;
      break;
    }
  }
  if (!asset) die(`module ${id} not found in release ${rel.tag_name ?? tag}`);

  const versionMatch = assetRe.exec(asset.name);
  const version = versionMatch[2];
  console.log(`[fetch-module] fetching ${asset.name} (${(asset.size / 1024).toFixed(1)} KB)`);

  const zipBuf = await fetchToBuffer(asset.browser_download_url);
  const actual = createHash("sha256").update(zipBuf).digest("hex");

  if (!flags.sha256) {
    const shaUrl = asset.browser_download_url.replace(/\.zip$/, ".sha256");
    try {
      const shaBuf = await fetchToBuffer(shaUrl);
      const text = shaBuf.toString("utf8").trim().split(/\s+/)[0];
      if (/^[a-f0-9]{64}$/.test(text)) flags.sha256 = text;
    } catch {
      /* optional */
    }
  }

  if (flags.sha256 && flags.sha256.toLowerCase() !== actual) {
    die(`SHA-256 mismatch (github): expected ${flags.sha256}, got ${actual}`);
  }

  const dir = await ensureTarget(id);
  const stagedZip = path.join(dir, "_staged.zip");
  await fsp.writeFile(stagedZip, zipBuf);
  await unzip(stagedZip, dir);
  await fsp.rm(stagedZip, { force: true });
  console.log(`[fetch-module] installed ${id} v${version} from ${owner}/${repo}@${rel.tag_name ?? tag}`);
  console.log(`[fetch-module]   sha256: ${actual}`);
  console.log(`[fetch-module]   target: ${dir}`);
  afterInstall(id);
}

async function listGithub(source) {
  let owner,
    repo,
    tag = "latest";
  const body = source.slice("github:".length);
  const tagIdx = body.lastIndexOf("@");
  if (tagIdx > 0) {
    tag = body.slice(tagIdx + 1);
    [owner, repo] = body.slice(0, tagIdx).split("/");
  } else {
    [owner, repo] = body.split("/");
  }
  if (!owner || !repo) die(`invalid github source: ${source}`);
  const releasePath = tag === "latest" ? "latest" : `tags/${encodeURIComponent(tag)}`;
  const releaseUrl = `https://api.github.com/repos/${owner}/${repo}/releases/${releasePath}`;
  const relRes = await fetch(releaseUrl, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "sfmc-fetch-module" },
  });
  if (!relRes.ok) die(`github release ${releaseUrl} → HTTP ${relRes.status}`);
  const rel = await relRes.json();
  console.log(`Release: ${rel.tag_name ?? tag} (${rel.name ?? ""})`);
  const assetRe = /^sfmc-module-([a-z0-9-]+)-(\d+\.\d+\.\d+)\.zip$/;
  for (const a of rel.assets ?? []) {
    const m = assetRe.exec(a.name);
    if (m) console.log(`  ${m[1].padEnd(28)} v${m[2].padEnd(8)} ${(a.size / 1024).toFixed(1)} KB`);
  }
}

async function unzip(zipPath, dstDir) {
  const JSZip = (await import("jszip")).default;
  const data = await fsp.readFile(zipPath);
  const zip = await JSZip.loadAsync(data);
  for (const e of Object.values(zip.files)) {
    // Windows zip 可能带 `\`；必须归一化，否则 Linux 会写出字面量 `sapi\manifest.json`
    const rel = String(e.name).replace(/\\/g, "/");
    if (!rel || rel.includes("..")) continue;
    const out = path.join(dstDir, ...rel.split("/").filter(Boolean));
    if (e.dir) {
      await fsp.mkdir(out, { recursive: true });
      continue;
    }
    await fsp.mkdir(path.dirname(out), { recursive: true });
    await fsp.writeFile(out, await e.async("nodebuffer"));
  }
}

async function copyDir(src, dst) {
  await fsp.mkdir(dst, { recursive: true });
  for (const e of await fsp.readdir(src, { withFileTypes: true })) {
    const sp = path.join(src, e.name);
    const dp = path.join(dst, e.name);
    if (e.isDirectory()) await copyDir(sp, dp);
    else if (e.isFile()) await fsp.copyFile(sp, dp);
  }
}

async function installOne(id, flags) {
  let from = flags.from;
  if (!from) {
    from = await defaultSourceFor(id);
    console.log(`[fetch-module] no --from given; using first-party registry → ${from}`);
  }
  // 每模块可共用同一 --from(github monorepo release)
  const perFlags = { ...flags, from };
  if (from.startsWith("local:")) return fromLocal(id, from, perFlags);
  if (from.startsWith("dir:")) {
    // dir: 多模块时，默认 dir 指向 packages 父目录则拼 folder
    const base = from.slice("dir:".length);
    const candidate = path.join(base, id);
    const src = exists(path.join(base, "sapi", "manifest.json"))
      ? from
      : exists(path.join(candidate, "sapi", "manifest.json"))
        ? `dir:${candidate}`
        : from;
    return fromDir(id, src);
  }
  if (from.startsWith("github:")) return fromGithub(id, from, perFlags);
  die(`unknown source: ${from}`);
}

async function uninstallOne(id) {
  const dir = path.join(TARGET, id);
  const removed = removeCatalogEntry(id);
  if (removed) removeModuleLock(removed.id);
  else removeModuleLock(id);
  if (exists(dir)) {
    await fsp.rm(dir, { recursive: true, force: true });
    console.log(`[fetch-module] uninstalled ${id} (removed ${dir})`);
  } else {
    console.log(`[fetch-module] uninstalled ${id} (no package dir; catalog/lock cleaned)`);
  }
  if (removed) console.log(`[fetch-module]   catalog removed: ${removed.id}`);
}

function printHelp() {
  console.log(`tools/fetch-module.mjs — populate ./modules/packages/<id>/

Commands:
  search                              list first-party registry
  list [--from github:owner/repo@tag] list release assets (default: first-party)
  install <id> [id2 ...] [--from ...] install one or more modules + sync catalog/lock
  uninstall <id> [id2 ...]            remove package dir + catalog/lock entries

Sources:
  local:/abs/path/to/foo.zip
  dir:/abs/path/to/foo/          (or dir:/path/to/packages for multi-install)
  github:owner/repo[@tag]
`);
}

async function main() {
  const [, , verb, ...rest] = process.argv;
  if (!verb) {
    printHelp();
    return;
  }

  if (verb === "search") {
    const { index, stale } = await resolveRegistryIndex();
    const ids = Object.keys(index).sort();
    if (stale) console.warn("[fetch-module] registry cache may be stale (offline mode)");
    console.log(`First-party registry (${DEFAULT_REGISTRY_REPO}@${DEFAULT_REGISTRY_TAG}) — ${ids.length} modules:`);
    for (const id of ids) {
      const e = index[id];
      console.log(`  ${id.padEnd(28)} ${e.repo}@${e.tag}`);
    }
    return;
  }

  if (verb === "list") {
    const { flags } = parseArgs(rest);
    if (!flags.from) {
      flags.from = `github:${DEFAULT_REGISTRY_REPO}@modules-v0.4.0`;
      console.log(`[fetch-module] no --from given; listing ${flags.from}`);
    }
    if (!flags.from.startsWith("github:")) die("--from github:owner/repo[@tag] required");
    await listGithub(flags.from);
    return;
  }

  if (verb === "uninstall") {
    const { positional } = parseArgs(rest);
    if (positional.length === 0) die("usage: uninstall <id> [id2 ...]");
    for (const id of positional) await uninstallOne(id);
    return;
  }

  if (verb !== "install") die(`unknown verb: ${verb}`);

  const { flags, positional } = parseArgs(rest);
  if (positional.length === 0) die("usage: install <id> [id2 ...] [--from <source>]");

  for (const id of positional) {
    await installOne(id, flags);
  }
}

main().catch((e) => die(e?.message ?? String(e)));
