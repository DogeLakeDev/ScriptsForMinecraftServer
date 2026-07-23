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
 *   node tools/fetch-module.mjs install <id> [id2 ...] [--from <source>] [--sha256 <hex>] [--link]
 *   node tools/fetch-module.mjs uninstall <id> [id2 ...]
 *
 * Sources: local:<zip> | dir:<path> | github:owner/repo[@tag]
 * 省略 --from 时查 Tanya7z/sfmc-modules index.json
 *
 * --link: 仅配合 dir:；把 modules/packages/<id> 链到源目录（win32=junction，POSIX=symlink），
 *         仍同步 catalog/lock。开发联调用；发布/生产请用默认 copy。
 */

import fs, { createReadStream } from "node:fs";
import fsp from "node:fs/promises";
import { createHash } from "node:crypto";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { extractZipFileToDir } from "@sfmc-bds/bds-tools/zipx";
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
  return parseRegistryIndex(await res.json());
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
  const flags = { from: null, sha256: null, link: false };
  /** @type {string[]} */
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--from") flags.from = args[++i];
    else if (a === "--sha256") flags.sha256 = args[++i];
    else if (a === "--link") flags.link = true;
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

/** 移除 packages/<id>（目录 / junction / symlink），不跟随链接删除源内容 */
async function removePackageTarget(dir) {
  try {
    await fsp.lstat(dir);
  } catch (err) {
    if (err && err.code === "ENOENT") return;
    throw err;
  }
  await fsp.rm(dir, { recursive: true, force: true });
}

/**
 * 把 dest 链到 src（win32=junction，其它=dir symlink）
 * @param {string} srcDir
 * @param {string} destDir
 */
async function linkPackageDir(srcDir, destDir) {
  const absSrc = path.resolve(srcDir);
  const absDest = path.resolve(destDir);
  if (!exists(absSrc)) die(`local dir not found: ${absSrc}`);
  await fsp.mkdir(path.dirname(absDest), { recursive: true });
  await removePackageTarget(absDest);
  const type = process.platform === "win32" ? "junction" : "dir";
  await fsp.symlink(absSrc, absDest, type);
  return absDest;
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

/** 安装落盘后同步 catalog + lock；并对 copy/zip 产物做路径/命名规范化 */
function afterInstall(folder, opts = {}) {
  if (!opts.skipNormalize) {
    try {
      normalizeInstalledPackage(path.join(TARGET, folder));
    } catch (err) {
      console.warn(
        `[fetch-module] normalize warn: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  const entry = upsertCatalogEntry(folder);
  setModuleLockEnabled(entry.id, entry.enabledByDefault !== false);
  console.log(`[fetch-module]   catalog+lock: ${entry.id} (enabled=${entry.enabledByDefault !== false})`);
  return entry;
}

/**
 * 规范化已安装包：旧 @sfmc/sdk → @sfmc-bds/sdk；tsconfig 改为自包含（不依赖主仓 sdk 路径）。
 * --link 联调目录跳过，避免改写源仓。
 */
function normalizeInstalledPackage(pkgDir) {
  if (!exists(pkgDir)) return;
  // junction/symlink：不改写源
  try {
    const st = fs.lstatSync(pkgDir);
    if (st.isSymbolicLink()) {
      console.log(`[fetch-module]   normalize: skipped (link)`);
      return;
    }
  } catch {
    /* continue */
  }

  const pkgJsonPath = path.join(pkgDir, "package.json");
  if (exists(pkgJsonPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
    let dirty = false;
    if (typeof pkg.name === "string" && pkg.name.startsWith("@sfmc/module-")) {
      pkg.name = pkg.name.replace("@sfmc/module-", "@sfmc-bds/module-");
      dirty = true;
    }
    for (const section of ["dependencies", "devDependencies", "peerDependencies"]) {
      const deps = pkg[section];
      if (!deps || typeof deps !== "object") continue;
      if (deps["@sfmc/sdk"] != null) {
        deps["@sfmc-bds/sdk"] = deps["@sfmc/sdk"];
        delete deps["@sfmc/sdk"];
        dirty = true;
      }
    }
    if (pkg.peerDependencies) {
      delete pkg.peerDependencies;
      dirty = true;
    }
    if (dirty) {
      fs.writeFileSync(pkgJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
      console.log(`[fetch-module]   normalize: package.json → @sfmc-bds`);
    }
  }

  const tsconfigPath = path.join(pkgDir, "sapi", "tsconfig.json");
  if (exists(tsconfigPath)) {
    const standalone = {
      compilerOptions: {
        module: "nodenext",
        moduleResolution: "nodenext",
        target: "es2022",
        lib: ["es2022"],
        strict: true,
        noEmit: true,
        rootDir: "./src",
        skipLibCheck: true,
        esModuleInterop: true,
      },
      include: ["src/**/*"],
    };
    fs.writeFileSync(tsconfigPath, `${JSON.stringify(standalone, null, 2)}\n`, "utf8");
    console.log(`[fetch-module]   normalize: sapi/tsconfig.json (standalone)`);
  }

  const srcDir = path.join(pkgDir, "sapi", "src");
  if (exists(srcDir)) {
    let rewritten = 0;
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (e.isFile() && /\.(ts|tsx|js|mjs)$/.test(e.name)) {
          const text = fs.readFileSync(full, "utf8");
          if (!text.includes("@sfmc/sdk")) continue;
          fs.writeFileSync(full, text.replaceAll("@sfmc/sdk", "@sfmc-bds/sdk"), "utf8");
          rewritten++;
        }
      }
    };
    walk(srcDir);
    if (rewritten > 0) {
      console.log(`[fetch-module]   normalize: rewrote @sfmc/sdk → @sfmc-bds/sdk in ${rewritten} file(s)`);
    }
  }
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

async function fromDir(id, source, flags = {}) {
  const srcDir = path.resolve(source.slice("dir:".length));
  if (!exists(srcDir)) die(`local dir not found: ${srcDir}`);
  const dest = path.join(TARGET, id);
  if (flags.link) {
    await linkPackageDir(srcDir, dest);
    console.log(`[fetch-module] linked ${id} → ${srcDir}`);
    console.log(`[fetch-module]   mode: ${process.platform === "win32" ? "junction" : "symlink"}`);
    console.log(`[fetch-module]   target: ${dest}`);
    afterInstall(id, { skipNormalize: true });
  } else {
    const dir = await ensureTarget(id);
    await copyDir(srcDir, dir);
    console.log(`[fetch-module] installed ${id} from dir ${srcDir}`);
    console.log(`[fetch-module]   target: ${dir}`);
    afterInstall(id);
  }
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

/** 解压模块包 — 委托 bds-tools/zipx（DRY；防 zip-slip / `\` / 绝对路径） */
async function unzip(zipPath, dstDir) {
  await fsp.mkdir(dstDir, { recursive: true });
  await extractZipFileToDir(zipPath, dstDir);
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
  if (flags.link && flags.from && !flags.from.startsWith("dir:")) {
    die(`--link only works with --from dir:<path> (got ${flags.from})`);
  }
  if (flags.link && !flags.from) {
    die(`--link requires --from dir:<path>`);
  }
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
    return fromDir(id, src, perFlags);
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
    await removePackageTarget(dir);
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
  install <id> [id2 ...] [--from ...] [--link]
                                      install one or more modules + sync catalog/lock
  uninstall <id> [id2 ...]            remove package dir + catalog/lock entries

Sources:
  local:/abs/path/to/foo.zip
  dir:/abs/path/to/foo/          (or dir:/path/to/packages for multi-install)
  github:owner/repo[@tag]

Flags:
  --link   with dir: only — junction (Windows) / symlink (POSIX) into
           modules/packages/<id> instead of copying. Still syncs catalog/lock.
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
  if (positional.length === 0) die("usage: install <id> [id2 ...] [--from <source>] [--link]");

  for (const id of positional) {
    await installOne(id, flags);
  }
}

main().catch((e) => die(e?.message ?? String(e)));
