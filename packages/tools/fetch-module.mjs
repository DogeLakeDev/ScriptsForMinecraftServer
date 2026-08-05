#!/usr/bin/env node
// @ts-check
/**
 * tools/fetch-module.mjs — 从 npm / GitHub / 本地 artifact 安装模块到 modules/packages/<id>/
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
 * Sources:
 *   npm:@scope/name         registry（默认；install <id> → @sfmc-bds/module-<folder>）
 *   local:[/abs/path]       本地目录 / .tgz / .zip（无路径默认 cwd）
 *   tgz:[/abs/path]         等价 local:，显式声明 .tgz
 *   zip:[/abs/path]         等价 local:，显式声明 .zip（强制校验内含 package.json + manifest）
 *   dir:/abs/path           本地目录（自动判单包/多包父目录）
 *   github:owner/repo[@tag] GitHub Release（兼容旧 Tanya7z/sfmc-modules）
 *
 * 缺省 source：first-party index → 优先 npm: 字段，否则 deprecated github:；
 *              未命中则按 @sfmc-bds/module-<folder> 走 npm。
 *
 * --link: 配合 dir: 或 local:<dir>；把 modules/packages/<id> 链到源目录
 *         （win32=junction，POSIX=symlink），仍同步 catalog/lock。
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
import { isSchemeFrom, normalizeBarePathFrom, normalizeLinkFrom } from "./lib/link-from.mjs";
import { folderFromNpmPackageName } from "./lib/npm-resolver.mjs";

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

/**
 * @param {{ fetchedAt: number; index: Record<string, import("./lib/registry-index.mjs").RegistryEntry>; }} cache
 */
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
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (cache) {
      console.warn(
        `[fetch-module] registry offline (${message}); using cached index from ${new Date(cache.fetchedAt).toISOString()}`
      );
      return { index: cache.index, stale: true };
    }
    throw new Error(
      `registry unreachable and no cache: ${message}. Pass --from explicitly to skip the registry.`
    );
  }
}

/**
 * 缺省 source：按 npm →
 * @sfmc-bds /module-<id> 解析（DRY：避免分散在各 sub spec）。
若 first-party registry 命中 → 仍用 github:（兼容旧路径，fn 不被禁止）。
 * @param {string | number} id
 */
async function defaultSourceFor(id) {
  try {
    const { index } = await resolveRegistryIndex();
    const entry = index[id];
    if (entry?.npm) {
      console.log(`[fetch-module] ${id} found in registry → npm:${entry.npm}`);
      return `npm:${entry.npm}`;
    }
    if (entry?.repo && entry?.tag) {
      console.log(
        `[fetch-module] ${id} found in registry (deprecated github) → github:${entry.repo}@${entry.tag}`
      );
      return `github:${entry.repo}@${entry.tag}`;
    }
  } catch {
    /* index 离线/失败：继续走 npm */
  }
  const { resolveNpmPackageName } = await import("./lib/npm-resolver.mjs");
  try {
    const pkgName = resolveNpmPackageName(id);
    console.log(`[fetch-module] no --from given; using npm → ${pkgName}`);
    return `npm:${pkgName}`;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    die(`无法解析 npm 包名: ${message}\n提示：传 --from local:<dir|tgz|zip> 或 --from npm:<scope>/<name>。`);
  }
}

/**
 * 从本地包目录推导 install folder id。
 * @param {string} absDir
 */
function inferFolderIdFromDir(absDir) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(absDir, "package.json"), "utf8"));
    const fromName = folderFromNpmPackageName(pkg.name);
    if (fromName) return fromName;
  } catch {
    /* ignore */
  }
  try {
    const man = JSON.parse(fs.readFileSync(path.join(absDir, "sapi", "manifest.json"), "utf8"));
    if (typeof man.id === "string") return man.id.replace(/^(feature|core)-/, "");
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * @param {string} msg
 */
function die(msg, code = 1) {
  console.error(`[fetch-module] ${msg}`);
  process.exit(code);
}

/**
 * @param {string | any[]} args
 */
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

/**
 * @param {string} id
 */
async function ensureTarget(id) {
  const dir = path.join(TARGET, id);
  await fsp.rm(dir, { recursive: true, force: true });
  await fsp.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * 移除 packages/<id>（目录 / junction / symlink），不跟随链接删除源内容
 * @param {fs.PathLike} dir
 */
async function removePackageTarget(dir) {
  try {
    await fsp.lstat(dir);
  } catch (err) {
    // @ts-ignore
    if (err && err.code === "ENOENT") return;
    throw err;
  }
  await fsp.rm(dir, { recursive: true, force: true });
}

/**
 * v3 语义字段读取：纯只读，**不主动写** semantic。
 * 通过 `loadPackageCatalogEntry` → `projectCatalogEntry` 把 manifest.semantic 投影进 catalog。
 * 这里只用于在 install log 里打印一条状态，便于模块作者确认 v3 字段被读到。
 * @param {string} folder
 */
function readV3SemanticStatus(folder) {
  const manifestPath = path.join(TARGET, folder, "sapi", "manifest.json");
  if (!exists(manifestPath)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    return raw?.schemaVersion === 3 && raw?.semantic && typeof raw.semantic === "object";
  } catch {
    return null;
  }
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

/**
 * @param {fs.PathLike} file
 */
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

/**
 * @param {string | URL | Request} url
 */
async function fetchToBuffer(url) {
  const res = await fetch(url, { headers: { "User-Agent": "sfmc-fetch-module" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * 安装落盘后同步 catalog + lock；并对 copy/zip 产物做路径/命名规范化
 * @param {string} folder
 */
function afterInstall(folder, opts = {}) {
  // @ts-ignore
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
  /* v3 状态透传：只读 semantic 字段已通过 projectCatalogEntry 投影到 catalog。
   * 模块作者想用 v3 时只需在 sapi/manifest.json 写 `"schemaVersion": 3` 与 semantic 块；
   * fetch-module 不会再追问也不会主动注入。 */
  const hasV3 = readV3SemanticStatus(folder);
  if (hasV3) {
    console.log(`[fetch-module]   v3 semantic: detected (manifest.schemaVersion=3)`);
  }
  return entry;
}

/**
 * 规范化已安装包：旧
 * @sfmc /sdk →
 * @sfmc-bds /sdk；tsconfig 改为自包含（不依赖主仓 sdk 路径）。
--link 联调目录跳过，避免改写源仓。
 * @param {fs.PathLike} pkgDir
 */
function normalizeInstalledPackage(pkgDir) {
  // @ts-ignore
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

  // @ts-ignore
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

  // @ts-ignore
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

  // @ts-ignore
  const srcDir = path.join(pkgDir, "sapi", "src");
  if (exists(srcDir)) {
    let rewritten = 0;
    const walk = (/** @type {fs.PathLike} */ dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        // @ts-ignore
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

/**
 * `--from local` 入口分发。`source` 已剥前缀，
 * 实际行为由 `resolveLocalPath` 解析出的路径类型决定：
 *   - dir  → fromDir 拷贝
 *   - .tgz → 解 tarball 到 packages/<id>
 *   - .zip → 解 zip + 校验 layout
 *   - 缺省 → cwd（被 resolveLocalPath 提前处理）
 * @param {any} id
 * @param {any} source
 * @param {any} flags
 */
async function fromLocal(id, source, flags) {
  /* 兼容旧调用：source 仍可能含 "local:" 前缀 —— 直接由 resolveLocalPath 接管 */
  const raw = String(source ?? "");
  const tail = raw.startsWith("local:") ? raw.slice("local:".length) : raw;
  const resolved = resolveLocalPath(tail);
  return installLocalArtifact(id, resolved, flags);
}

/**
 * `sfmc mod install <id>` 走 npm registry 的主路径。
 * 
 * 入口：`npm install --prefix packages/<id> --omit=dev --no-save --no-package-lock <pkgName>`
 *   - 落地到 packages/<id>，不进主仓根 node_modules（隔离安装）
 *   - 成功后 upsert catalog/lock
 *   - 失败时把常见 npm 错误翻译成中文可读提示
 * @param {string} id
 * @param {string} pkgName
 * @param {any} flags
 */
async function fromNpm(id, pkgName, flags) {
  const dir = await ensureTarget(id);
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const { spawn: spawnChild } = await import("node:child_process");
  await /** @type {Promise<void>} */(new Promise((resolve, reject) => {
    const proc = spawnChild(
      npmCmd,
      [
        "install",
        "--prefix",
        dir,
        "--omit=dev",
        "--no-save",
        "--no-package-lock",
        "--no-audit",
        "--no-fund",
        pkgName,
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    );
    let stderr = "";
    proc.stderr?.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("exit", (code) => {
      if (code === 0) return resolve();
      reject(new Error(translateNpmInstallError(pkgName, stderr)));
    });
    proc.on("error", (e) => reject(new Error(`spawn npm failed: ${e.message}`)));
  }));
  console.log(`[fetch-module] installed ${id} from npm (${pkgName})`);
  console.log(`[fetch-module]   target: ${dir}`);
  afterInstall(id);
}

/**
 * 翻译常见 npm install 错误为中文可读 + 下一步动作。
 * @param {string} pkgName
 * @param {string} stderr
 */
function translateNpmInstallError(pkgName, stderr) {
  const text = String(stderr || "");
  if (/404 Not Found/i.test(text) || /not found/i.test(text)) {
    return `npm 包未找到: ${pkgName}。请检查 manifest id / scope 拼写，或换 --from local:./<path>。`;
  }
  if (/EACCES|permission/i.test(text)) {
    return `npm 权限错误: ${pkgName}。检查 npm registry 登录态或 token 权限。`;
  }
  if (/ERESOLVE/i.test(text)) {
    return `npm 依赖冲突: ${pkgName}。提示: 用 --legacy-peer-deps 重试，或先确认 SDK/宿主版本兼容。`;
  }
  if (/ETIMEDOUT|ECONNRESET|ENOTFOUND/i.test(text)) {
    return `npm 网络错误: ${pkgName}。检查代理 / 网络；或离线用 --from local:<tgz|dir>。`;
  }
  /* 默认透传原始 stderr（保留 npm 提示的修复建议） */
  return `npm install ${pkgName} 失败:\n${text.trim()}`;
}

/**
 * `tgz:` 显式前缀；等价 local:<path>，规则同 resolveLocalPath。
 * @param {any} id
 * @param {string | any[]} source
 * @param {any} flags
 */
async function fromTgz(id, source, flags) {
  const tail = source.slice("tgz:".length);
  const resolved = resolveLocalPath(tail);
  return installLocalArtifact(id, resolved, flags);
}

/**
 * `zip:` 显式前缀；同上但强制校验内部布局。
 * @param {any} id
 * @param {string | any[]} source
 * @param {any} flags
 */
async function fromZip(id, source, flags) {
  const tail = source.slice("zip:".length);
  const resolved = resolveLocalPath(tail);
  return installLocalArtifact(id, resolved, flags, { kind: "zip" });
}

/**
 * 把 `--from local[:path]` 的 path 段解析为绝对路径：
 *   - 空 / undefined / `.` / `./` → process.cwd()
 *   - 相对路径 → 相对 cwd 解析
 *   - 绝对路径 → 原样
 * 单一权威，避免 local / tgz / zip / dir 之间出现重复解析。
 * @param {string | any[]} tail
 */
function resolveLocalPath(tail) {
  const p = String(tail ?? "").trim();
  if (!p || p === "." || p === "./") return path.resolve(process.cwd());
  return path.isAbsolute(p) ? path.resolve(p) : path.resolve(process.cwd(), p);
}

/**
 * 按解析出的绝对路径判定形态并安装。
 * kind="zip" 强制校验 layout（zip 仅作为离线分享格式，CLI 必须做完整性检查）。
 * @param {string} id
 * @param {fs.PathLike} absPath
 * @param {{} | undefined} flags
 */
async function installLocalArtifact(id, absPath, flags, opts = {}) {
  // @ts-ignore
  if (!exists(absPath)) {
    die(`--from local target not found: ${absPath}`);
  }
  const st = fs.lstatSync(absPath);
  if (st.isDirectory()) {
    /* dir: 与 --from dir:<path> 等价，复用 fromDir（统一入口） */
    return fromDir(id, `dir:${absPath}`, flags);
  }
  if (!st.isFile()) {
    die(`--from local must be a directory, .tgz, or .zip: ${absPath}`);
  }
  // @ts-ignore
  const lower = absPath.toLowerCase();
  const isZip = lower.endsWith(".zip");
  const isTgz = lower.endsWith(".tgz") || lower.endsWith(".tar.gz");
  if (!isZip && !isTgz) {
    die(`--from local file must end with .tgz or .zip: ${absPath}`);
  }

  /* 校验 hash（local 模式下若给了 --sha256） */
  const actual = await sha256OfFile(absPath);
  // @ts-ignore
  if (flags.sha256 && flags.sha256.toLowerCase() !== actual) {
    // @ts-ignore
    die(`SHA-256 mismatch (local): expected ${flags.sha256}, got ${actual}`);
  }

  const dir = await ensureTarget(id);
  if (isTgz) {
    await extractTgz(absPath, dir);
  } else {
    await unzip(absPath, dir);
  }
  /* zip 必须校验内含关键文件（缺则硬错误） */
  // @ts-ignore
  if (isZip || opts.kind === "zip") {
    validateModuleLayout(dir);
  }
  console.log(`[fetch-module] installed ${id} from ${absPath}`);
  console.log(`[fetch-module]   sha256: ${actual}`);
  console.log(`[fetch-module]   target: ${dir}`);
  afterInstall(id);
}

/**
 * 校验 modules/packages/<id> 落地目录内含 manifest + package.json + entry。
 * zip 离线分享场景必须通过；缺关键文件则清目录并 die。
 * @param {fs.PathLike} pkgDir
 */
function validateModuleLayout(pkgDir) {
  // @ts-ignore
  const manifestPath = path.join(pkgDir, "sapi", "manifest.json");
  // @ts-ignore
  const pkgJsonPath = path.join(pkgDir, "package.json");
  const missing = [];
  if (!exists(manifestPath)) missing.push("sapi/manifest.json");
  if (!exists(pkgJsonPath)) missing.push("package.json");
  if (missing.length > 0) {
    /* 清掉避免污染 packages/；让用户重试而不是放任脏目录 */
    try {
      fs.rmSync(pkgDir, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
    die(
      `archive layout invalid: missing ${missing.join(", ")}. ` +
        `zip 仅作离线分享，必须含 package.json + sapi/manifest.json；npm 发布请用 tgz/pack。`
    );
  }
}

/**
 * @param {string} id
 * @param {string} source
 */
async function fromDir(id, source, flags = {}) {
  const srcDir = path.resolve(source.slice("dir:".length));
  if (!exists(srcDir)) die(`local dir not found: ${srcDir}`);
  const dest = path.join(TARGET, id);
  // @ts-ignore
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

/**
 * @param {string} id
 * @param {string | any[]} source
 * @param {{ sha256: string; }} flags
 */
async function fromGithub(id, source, flags) {
  let owner,
    repo,
    tag = "latest";
  const body = source.slice("github:".length);
  const tagIdx = body.lastIndexOf("@");
  if (tagIdx > 0) {
    // @ts-ignore
    tag = body.slice(tagIdx + 1);
    // @ts-ignore
    [owner, repo] = body.slice(0, tagIdx).split("/");
  } else {
    // @ts-ignore
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
  // @ts-ignore
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

/**
 * @param {string | any[] | null} source
 */
async function listGithub(source) {
  let owner,
    repo,
    tag = "latest";
  // @ts-ignore
  const body = source.slice("github:".length);
  const tagIdx = body.lastIndexOf("@");
  if (tagIdx > 0) {
    // @ts-ignore
    tag = body.slice(tagIdx + 1);
    // @ts-ignore
    [owner, repo] = body.slice(0, tagIdx).split("/");
  } else {
    // @ts-ignore
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

/**
 * 解压模块包 — 委托 bds-tools/zipx（DRY；防 zip-slip / `\` / 绝对路径）
 * @param {fs.PathLike} zipPath
 * @param {fs.PathLike} dstDir
 */
async function unzip(zipPath, dstDir) {
  await fsp.mkdir(dstDir, { recursive: true });
  // @ts-ignore
  await extractZipFileToDir(zipPath, dstDir);
}

/**
 * 解 npm tarball（.tgz）到 packages/<id>。
 * 委托 `npm` 本身（DRY；不重新发明 tar）：`npm install <tarball>` 落临时 prefix，
 * 再拷贝到 packages/<id>。npm 已内置 tar-slip 防护。
 * @param {fs.PathLike} tgzPath
 * @param {string} dstDir
 */
async function extractTgz(tgzPath, dstDir) {
  const os = await import("node:os");
  const { spawn: spawnChild } = await import("node:child_process");
  const tmpPrefix = await fsp.mkdtemp(path.join(os.tmpdir(), "sfmc-tgz-"));
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  await new Promise((resolve, reject) => {
    // @ts-ignore
    const proc = spawnChild(npmCmd, ["install", "--prefix", tmpPrefix, "--omit=dev", "--no-save", tgzPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    // @ts-ignore
    proc.stderr?.on("data", (d) => {
      stderr += d.toString();
    });
    // @ts-ignore
    proc.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`npm install tarball exit ${code}: ${stderr}`))));
    // @ts-ignore
    proc.on("error", reject);
  });
  /* npm install <tarball> 把 package.json#name 当作目录名：
   *   @scope/module-foo   → node_modules/@scope/module-foo
   *   @scope/sfmc-module-foo → node_modules/@scope/sfmc-module-foo
   * 我们从 tmpPrefix/node_modules 找出唯一的一个包目录，整体拷贝到 dstDir。
   */
  const installed = path.join(tmpPrefix, "node_modules");
  if (!exists(installed)) {
    throw new Error(`npm install tarball produced no node_modules: ${tmpPrefix}`);
  }
  let found = null;
  for (const e of fs.readdirSync(installed, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (e.name.startsWith("@")) {
        for (const sub of fs.readdirSync(path.join(installed, e.name), { withFileTypes: true })) {
          if (sub.isDirectory()) {
            found = path.join(installed, e.name, sub.name);
            break;
          }
        }
      } else if (e.isDirectory()) {
        found = path.join(installed, e.name);
      }
    }
    if (found) break;
  }
  if (!found) {
    throw new Error(`npm install tarball: no package directory under ${installed}`);
  }
  await copyDir(found, dstDir);
  /* 清理临时 prefix */
  try {
    await fsp.rm(tmpPrefix, { recursive: true, force: true });
  } catch {
    /* best-effort */
  }
}

/**
 * @param {fs.PathLike} src
 * @param {fs.PathLike} dst
 */
async function copyDir(src, dst) {
  await fsp.mkdir(dst, { recursive: true });
  for (const e of await fsp.readdir(src, { withFileTypes: true })) {
    // @ts-ignore
    const sp = path.join(src, e.name);
    // @ts-ignore
    const dp = path.join(dst, e.name);
    if (e.isDirectory()) await copyDir(sp, dp);
    else if (e.isFile()) await fsp.copyFile(sp, dp);
  }
}

/**
 * @param {string} id
 * @param {{ from: any; sha256?: null; link: any; }} flags
 */
async function installOne(id, flags) {
  let from = flags.from;
  if (!from) {
    from = await defaultSourceFor(id);
    console.log(`[fetch-module] no --from given; using → ${from}`);
  }
  if (flags.link) {
    const norm = normalizeLinkFrom(from, process.cwd());
    if (!norm.ok) die(norm.error);
    // @ts-ignore
    from = norm.from;
  } else if (!isSchemeFrom(from)) {
    /* 约定：--from <路径> → dir:<abs> */
    const bare = normalizeBarePathFrom(from, process.cwd());
    if (!bare.ok) die(bare.error);
    // @ts-ignore
    from = bare.from;
  }
  const perFlags = { ...flags, from };
  if (from.startsWith("local:") || from === "local") return fromLocal(id, from, perFlags);
  if (from.startsWith("tgz:")) return fromTgz(id, from, perFlags);
  if (from.startsWith("zip:")) return fromZip(id, from, perFlags);
  if (from.startsWith("npm:")) return fromNpm(id, from.slice("npm:".length), perFlags);
  if (from.startsWith("dir:")) {
    const base = from.slice("dir:".length);
    const candidate = path.join(base, id);
    const src = exists(path.join(base, "sapi", "manifest.json"))
      ? from
      : exists(path.join(candidate, "sapi", "manifest.json"))
        ? `dir:${candidate}`
        : from;
    return fromDir(id, src, perFlags);
  }
  // @ts-ignore
  if (from.startsWith("github:")) return fromGithub(id, from, perFlags);
  die(`unknown source: ${from}`);
}

/**
 * @param {string} id
 */
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

Sources (按优先级):
  npm:@scope/name                npm registry（默认；install <id> → @sfmc-bds/module-<id>）
  local:[/abs/path]              本地目录 / .tgz / .zip（无路径默认 cwd）
  tgz:[/abs/path]                等价 local:，显式声明 .tgz
  zip:[/abs/path]                等价 local:，强制校验内含 package.json + manifest
  dir:/abs/path                  本地目录（自动判单包/多包父目录）
  github:owner/repo[@tag]        GitHub Release（兼容旧 first-party）

Flags:
  --link   with dir: or local:<dir> — junction (Windows) / symlink (POSIX) into
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
    console.log(`Registry (${DEFAULT_REGISTRY_REPO}@${DEFAULT_REGISTRY_TAG}) — ${ids.length} modules:`);
    for (const id of ids) {
      const e = index[id];
      const src = e.npm ? `npm:${e.npm}` : e.repo ? `github:${e.repo}@${e.tag}` : "?";
      console.log(`  ${id.padEnd(28)} ${src}`);
    }
    return;
  }

  if (verb === "list") {
    const { flags } = parseArgs(rest);
    if (!flags.from) {
      // @ts-ignore
      flags.from = `github:${DEFAULT_REGISTRY_REPO}@modules-v0.4.0`;
      console.log(`[fetch-module] no --from given; listing ${flags.from}`);
    }
    // @ts-ignore
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
  let ids = [...positional];
  if (ids.length === 0) {
    const from = flags.from;
    // @ts-ignore
    if (!from || (!from.startsWith("local") && !from.startsWith("dir:"))) {
      die("usage: install <id> [id2 ...] [--from <source>] [--link]\n或: install --from local|dir:<path> [--link]（从包目录推导 id）");
    }
    let absDir;
    // @ts-ignore
    if (from === "local" || from.startsWith("local:")) {
      // @ts-ignore
      const raw = from === "local" ? "" : from.slice("local:".length);
      absDir =
        !raw || raw === "." || raw === "./"
          ? path.resolve(process.cwd())
          : path.isAbsolute(raw)
            ? path.resolve(raw)
            : path.resolve(process.cwd(), raw);
    } else {
      // @ts-ignore
      absDir = path.resolve(from.slice("dir:".length));
    }
    if (!exists(absDir) || !fs.lstatSync(absDir).isDirectory()) {
      die(`无法从非目录源推导 id: ${absDir}`);
    }
    const inferred = inferFolderIdFromDir(absDir);
    if (!inferred) die(`无法从 ${absDir} 推导模块 id（需要 package.json name 或 sapi/manifest.json id）`);
    console.log(`[fetch-module] inferred id: ${inferred}`);
    ids = [inferred];
    // @ts-ignore
    if (!flags.from.startsWith("dir:") && (flags.from === "local" || flags.from.startsWith("local:"))) {
      /* 保持 local；link 时会规范成 dir: */
    // @ts-ignore
    } else if (flags.from.startsWith("dir:")) {
      /* ok */
    } else {
      // @ts-ignore
      flags.from = `dir:${absDir}`;
    }
  }

  for (const id of ids) {
    await installOne(id, flags);
  }
}

main().catch((e) => die(e?.message ?? String(e)));
