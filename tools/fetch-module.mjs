#!/usr/bin/env node
/**
 * tools/fetch-module.mjs — populate ./modules/packages/<id>/ from a source.
 *
 * Sources:
 *   local:<zip-path>      extract a local zip into modules/packages/<id>/
 *   dir:<dir-path>        copy a directory into modules/packages/<id>/
 *   github:<owner>/<repo>[@<tag>]   fetch sfmc-module-<id>-<version>.zip
 *                                   from GitHub Releases (optionally verify
 *                                   against the .sha256 sidecar)
 *
 * Default source (first-party registry):
 *   If --from is omitted, look up <id> in the index at
 *   https://raw.githubusercontent.com/Tanya7z/sfmc-modules/main/index.json
 *   → { "<id>": { "repo": "...", "tag": "..." } } → translate to github:<repo>@<tag>.
 *   The index is cached at tools/.sfmc-registry-cache.json for 1h.
 *
 * Usage:
 *   node tools/fetch-module.mjs list                                    # list installed
 *   node tools/fetch-module.mjs search                                  # list first-party registry
 *   node tools/fetch-module.mjs install <id>                            # install from first-party registry
 *   node tools/fetch-module.mjs install <id> --from github:owner/repo[@tag]
 *   node tools/fetch-module.mjs install <id> --from local:/abs/path/to/foo.zip
 *   node tools/fetch-module.mjs install <id> --from dir:/abs/path/to/foo/
 *
 * Install target:
 *   modules/packages/<id>/
 *
 * SHA-256 verification:
 *   For github: source, the .sha256 sidecar is fetched and verified if present.
 *   For local: source, --sha256 <hex> may be passed.
 *
 * Note: This is a build-time / one-shot tool. The SEA itself never calls this;
 * it only reads from the resulting `modules/packages/<id>/` directories.
 */

import fs, { createReadStream } from "node:fs";
import fsp from "node:fs/promises";
import { createHash } from "node:crypto";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TARGET = path.join(ROOT, "modules", "packages");

/* ── first-party registry (Tanya7z/sfmc-modules) ─────────────── */
const DEFAULT_REGISTRY_REPO = "Tanya7z/sfmc-modules";
const DEFAULT_REGISTRY_TAG = "main"; // index.json lives on main, not a release tag
const DEFAULT_REGISTRY_INDEX_URL = `https://raw.githubusercontent.com/${DEFAULT_REGISTRY_REPO}/${DEFAULT_REGISTRY_TAG}/index.json`;
const REGISTRY_CACHE_PATH = path.join(__dirname, ".sfmc-registry-cache.json");
const REGISTRY_CACHE_TTL_MS = 60 * 60 * 1000; // 1h

/**
 * @typedef {{ repo: string, tag: string }} RegistryEntry
 * @typedef {Record<string, RegistryEntry>} RegistryIndex
 * @typedef {{ fetchedAt: number, index: RegistryIndex }} RegistryCache
 */

function readCache() /** @returns {RegistryCache | null} */ {
  try {
    const raw = fs.readFileSync(REGISTRY_CACHE_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeCache(/** @type {RegistryCache} */ cache) {
  try {
    fs.writeFileSync(REGISTRY_CACHE_PATH, JSON.stringify(cache, null, 2));
  } catch {
    /* cache is best-effort */
  }
}

/** @returns {Promise<RegistryIndex>} */
async function fetchRegistryIndexFresh() {
  const res = await fetch(DEFAULT_REGISTRY_INDEX_URL, { headers: { "User-Agent": "sfmc-fetch-module" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${DEFAULT_REGISTRY_INDEX_URL}`);
  const json = await res.json();
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    throw new Error("registry index must be a JSON object with a 'modules' field");
  }
  const modules = json.modules;
  if (typeof modules !== "object" || modules === null || Array.isArray(modules)) {
    throw new Error("registry index must have a 'modules' object mapping id → { repo, tag }");
  }
  // filter out comment keys starting with "_"
  const filtered = {};
  for (const [k, v] of Object.entries(modules)) {
    if (k.startsWith("_")) continue;
    filtered[k] = v;
  }
  return /** @type {RegistryIndex} */ (filtered);
}

/**
 * Resolve the first-party registry index. Prefer the live fetch; on network
 * failure fall back to a 1h TTL cache; on both failing, raise.
 *
 * @returns {Promise<{ index: RegistryIndex, stale: boolean }>}
 */
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
      console.warn(`[fetch-module] registry offline (${err.message}); using cached index from ${new Date(cache.fetchedAt).toISOString()}`);
      return { index: cache.index, stale: true };
    }
    throw new Error(`registry unreachable and no cache: ${err.message}. Pass --from explicitly to skip the registry.`);
  }
}

/** @param {string} id @returns {Promise<string>} */
async function defaultSourceFor(id) {
  const { index } = await resolveRegistryIndex();
  const entry = index[id];
  if (!entry || !entry.repo) {
    const known = Object.keys(index).sort().join(", ");
    throw new Error(`module "${id}" not found in first-party registry. Known: ${known || "(empty)"}. Pass --from explicitly to install from another source.`);
  }
  return `github:${entry.repo}@${entry.tag}`;
}

const [, , verb, ...rest] = process.argv;

function die(msg, code = 1) {
  console.error(`[fetch-module] ${msg}`);
  process.exit(code);
}

function parseFlags(args) {
  const flags = { from: null, sha256: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--from") flags.from = args[++i];
    else if (a === "--sha256") flags.sha256 = args[++i];
  }
  return flags;
}

async function ensureTarget(id) {
  const dir = path.join(TARGET, id);
  await fsp.rm(dir, { recursive: true, force: true });
  await fsp.mkdir(dir, { recursive: true });
  return dir;
}

async function sha256OfStream(stream) {
  const hash = createHash("sha256");
  await pipeline(stream, async function* (src) {
    for await (const chunk of src) {
      hash.update(chunk);
      yield chunk;
    }
  });
  return hash.digest("hex");
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

/* ── source: local:<zip-path> ─────────────────────────────── */
async function fromLocal(id, source, flags) {
  const zipPath = source.slice("local:".length);
  if (!fs.existsSync(zipPath)) die(`local zip not found: ${zipPath}`);
  const actual = await sha256OfFile(zipPath);
  if (flags.sha256 && flags.sha256.toLowerCase() !== actual) {
    die(`SHA-256 mismatch (local): expected ${flags.sha256}, got ${actual}`);
  }
  const dir = await ensureTarget(id);
  await unzip(zipPath, dir);
  console.log(`[fetch-module] installed ${id} from ${zipPath}`);
  console.log(`[fetch-module]   sha256: ${actual}`);
  console.log(`[fetch-module]   target: ${dir}`);
}

/* ── source: dir:<dir-path> ───────────────────────────────── */
async function fromDir(id, source) {
  const srcDir = source.slice("dir:".length);
  if (!fs.existsSync(srcDir)) die(`local dir not found: ${srcDir}`);
  const dir = await ensureTarget(id);
  await copyDir(srcDir, dir);
  console.log(`[fetch-module] installed ${id} from dir ${srcDir}`);
  console.log(`[fetch-module]   target: ${dir}`);
}

/* ── source: github:<owner>/<repo>[@<tag>] ────────────────── */
async function fromGithub(id, source, flags) {
  let owner, repo, tag = "latest";
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
  const relRes = await fetch(releaseUrl, { headers: { Accept: "application/vnd.github+json", "User-Agent": "sfmc-fetch-module" } });
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

  /* Try sidecar .sha256 file */
  if (!flags.sha256) {
    const shaUrl = asset.browser_download_url.replace(/\.zip$/, ".sha256");
    try {
      const shaBuf = await fetchToBuffer(shaUrl);
      const text = shaBuf.toString("utf8").trim().split(/\s+/)[0];
      if (/^[a-f0-9]{64}$/.test(text)) flags.sha256 = text;
    } catch {
      /* sidecar optional */
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
}

async function listGithub(source) {
  let owner, repo, tag = "latest";
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
  const relRes = await fetch(releaseUrl, { headers: { Accept: "application/vnd.github+json", "User-Agent": "sfmc-fetch-module" } });
  if (!relRes.ok) die(`github release ${releaseUrl} → HTTP ${relRes.status}`);
  const rel = await relRes.json();
  console.log(`Release: ${rel.tag_name ?? tag} (${rel.name ?? ""})`);
  const assetRe = /^sfmc-module-([a-z0-9-]+)-(\d+\.\d+\.\d+)\.zip$/;
  for (const a of rel.assets ?? []) {
    const m = assetRe.exec(a.name);
    if (m) console.log(`  ${m[1].padEnd(28)} v${m[2].padEnd(8)} ${(a.size / 1024).toFixed(1)} KB`);
  }
}

/* ── unzip via Node built-in (Node 22+ has node:zlib; here we use JSZip) ── */
async function unzip(zipPath, dstDir) {
  const JSZip = (await import("jszip")).default;
  const data = await fsp.readFile(zipPath);
  const zip = await JSZip.loadAsync(data);
  const entries = Object.values(zip.files);
  for (const e of entries) {
    // Windows 打的 zip 常带反斜杠；统一成 POSIX 再 join，避免 Linux 写出字面量 "sapi\manifest.json"
    const rel = String(e.name || "").replace(/\\/g, "/").replace(/^\/+/, "");
    if (!rel || rel.includes("..")) continue;
    const out = path.join(dstDir, ...rel.split("/"));
    if (e.dir || rel.endsWith("/")) {
      await fsp.mkdir(out, { recursive: true });
      continue;
    }
    await fsp.mkdir(path.dirname(out), { recursive: true });
    const buf = await e.async("nodebuffer");
    await fsp.writeFile(out, buf);
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

/** 安装/变更 packages 后重建本地 catalog mirror（单一真相：磁盘上的 manifest）。 */
function rebuildCatalogMirror() {
  const script = path.join(ROOT, "tools", "rebuild-catalog.js");
  if (!fs.existsSync(script)) {
    console.warn("[fetch-module] tools/rebuild-catalog.js missing; skip catalog rebuild");
    return;
  }
  const r = spawnSync(process.execPath, [script], { cwd: ROOT, encoding: "utf-8" });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) die(`rebuild-catalog failed (exit ${r.status ?? 1})`);
}

/* ── entry ──────────────────────────────────────────────── */
async function main() {
  if (!verb) {
    console.log(`tools/fetch-module.mjs — populate ./modules/packages/<id>/

Commands:
  install <id> [--from <source>]      fetch and install
                                      (no --from → first-party registry)
  search                              list the first-party registry
  list          --from <source>      list available modules in a source release
                                      (no --from → first-party registry)

Sources:
  local:/abs/path/to/foo.zip
  dir:/abs/path/to/foo/
  github:owner/repo[@tag]
`);
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
    const flags = parseFlags(rest);
    let source = flags.from;
    if (!source) {
      source = `${DEFAULT_REGISTRY_REPO}@${DEFAULT_REGISTRY_TAG}`;
      flags.from = `github:${source}`;
      console.log(`[fetch-module] no --from given; listing first-party registry: ${source}`);
    }
    if (!flags.from.startsWith("github:")) die("--from github:owner/repo required (or omit to use the first-party registry)");
    await listGithub(flags.from);
    return;
  }
  if (verb !== "install") die(`unknown verb: ${verb}`);
  const id = rest[0];
  if (!id) die("usage: install <id> --from <source>");
  const flags = parseFlags(rest.slice(1));
  if (!flags.from) {
    const source = await defaultSourceFor(id);
    console.log(`[fetch-module] no --from given; using first-party registry → ${source}`);
    flags.from = source;
  }

  if (flags.from.startsWith("local:")) {
    await fromLocal(id, flags.from, flags);
    rebuildCatalogMirror();
    return;
  }
  if (flags.from.startsWith("dir:")) {
    await fromDir(id, flags.from);
    rebuildCatalogMirror();
    return;
  }
  if (flags.from.startsWith("github:")) {
    await fromGithub(id, flags.from, flags);
    rebuildCatalogMirror();
    return;
  }
  die(`unknown source: ${flags.from}`);
}

main().catch((e) => die(e?.message ?? String(e)));