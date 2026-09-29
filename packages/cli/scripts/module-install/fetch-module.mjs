#!/usr/bin/env node
// @ts-check
/**
 * @sfmc-bds/cli — 从 npm / GitHub / 本地 artifact 安装模块到 modules/packages/<id>/
 *
 * 安装成功后会把 sapi/manifest.json 投影写入 modules/catalog.json，
 * 并按 enabledByDefault 更新 modules/module-lock.json。
 * --preserve-lock 时，若 lock 里已有该模块，则保留当前启停。
 * 成功后写入 modules/module-pins.json。
 *
 * Usage:
 *   node packages/cli/scripts/module-install/fetch-module.mjs search
 *   sfmc mod install <id> …
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

import { extractZipFileToDir } from "@sfmc-bds/bds-tools/zipx";
import { createHash } from "node:crypto";
import fs, { createReadStream } from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { runCheckModules } from "./check-modules.mjs";
import { removeCatalogEntry, upsertCatalogEntry } from "./lib/catalog.mjs";
import { seedModuleConfig } from "./lib/config-seeding.mjs";
import { exists } from "./lib/io.mjs";
import { isSchemeFrom, normalizeBarePathFrom, normalizeLinkFrom } from "./lib/link-from.mjs";
import { readLock, removeModuleLock, setModuleLockEnabled } from "./lib/lock.mjs";
import { QUIET_SKIP_REASONS, applyModuleUpgrades, planModuleUpdates, resyncInstalledCatalog } from "./lib/module-update.mjs";
import { folderFromNpmPackageName } from "./lib/npm-resolver.mjs";
import { loadPackageCatalogEntry } from "./lib/packages.mjs";
import { PACKAGES_DIR, ROOT } from "./lib/paths.mjs";
import { recordInstallPin, removePin, shouldPreserveLock } from "./lib/pins.mjs";
import { DEFAULT_REGISTRY_REPO, DEFAULT_REGISTRY_TAG, resolveRegistryIndex } from "./lib/registry-cache.mjs";

const TARGET = PACKAGES_DIR;

/**
 * 仅在直接执行本文件时跑 main。被 mod update 动态 import 时不要再解析命令行。
 */
function isFetchModuleEntry() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    const thisFile = fs.realpathSync.native(fileURLToPath(import.meta.url));
    const entryFile = fs.realpathSync.native(path.resolve(entry));
    const norm = (value) => (process.platform === "win32" ? value.toLowerCase() : value);
    return norm(thisFile) === norm(entryFile);
  } catch {
    return false;
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
      const spec = `${entry.npm}${entry.version ? `@${entry.version}` : ""}`;
      console.log(`[fetch-module] ${id} found in registry → npm:${spec}`);
      return `npm:${spec}`;
    }
    if (entry?.repo && entry?.tag) {
      console.log(`[fetch-module] ${id} found in registry (deprecated github) → github:${entry.repo}@${entry.tag}`);
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
  const flags = { from: null, sha256: null, link: false, preserveLock: false };
  /** @type {string[]} */
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--from") flags.from = args[++i];
    else if (a === "--sha256") flags.sha256 = args[++i];
    else if (a === "--link") flags.link = true;
    else if (a === "--preserve-lock") flags.preserveLock = true;
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
 * 把安装旗标收成 afterInstall 能看懂的来源信息。
 * @param {{ from?: string, link?: boolean, preserveLock?: boolean } | undefined} flags
 * @param {{ skipNormalize?: boolean }} [extra]
 */
function installOpts(flags, extra = {}) {
  return {
    preserveLock: !!flags?.preserveLock,
    from: flags?.from || "",
    link: !!flags?.link,
    ...extra,
  };
}

/**
 * 安装落盘后同步 catalog + lock；并对 copy/zip 产物做路径/命名规范化。
 * preserveLock 时保留服主已经写入的启停状态。
 * @param {string} folder
 */
function afterInstall(folder, opts = {}) {
  // @ts-ignore
  if (!opts.skipNormalize) {
    try {
      normalizeInstalledPackage(path.join(TARGET, folder));
    } catch (err) {
      console.warn(`[fetch-module] normalize warn: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  const moduleRoot = path.join(TARGET, folder);
  const preview = loadPackageCatalogEntry(folder);
  if (!preview) throw new Error(`packages/${folder}: 无法读取 sapi/manifest.json`);
  const seeded = seedModuleConfig({
    moduleRoot,
    projectRoot: ROOT,
    configKey: preview.configKey,
  });
  const targetRel = path.relative(ROOT, seeded.target).replaceAll("\\", "/");
  if (seeded.status === "created") {
    console.log(`[fetch-module]   config created: ${targetRel}`);
  } else if (seeded.status === "updated") {
    console.log(`[fetch-module]   config updated: added ${seeded.addedPaths.join(", ")}`);
  } else if (seeded.status === "unchanged") {
    console.log(`[fetch-module]   config unchanged: ${targetRel}`);
  } else {
    console.warn(`[fetch-module]   config defaults missing: ${preview.configKey}`);
  }

  const entry = upsertCatalogEntry(folder);
  const keepLock = shouldPreserveLock(!!opts.preserveLock, Object.prototype.hasOwnProperty.call(readLock().modules, entry.id));
  if (keepLock) {
    console.log(`[fetch-module]   lock preserved: ${entry.id}`);
  } else {
    setModuleLockEnabled(entry.id, entry.enabledByDefault !== false);
    console.log(`[fetch-module]   catalog+lock: ${entry.id} (enabled=${entry.enabledByDefault !== false})`);
  }
  /* v3 状态透传：只读 semantic 字段已通过 projectCatalogEntry 投影到 catalog。
   * 模块作者想用 v3 时只需在 sapi/manifest.json 写 `"schemaVersion": 3` 与 semantic 块；
   * fetch-module 不会再追问也不会主动注入。 */
  const hasV3 = readV3SemanticStatus(folder);
  if (hasV3) {
    console.log(`[fetch-module]   v3 semantic: detected (manifest.schemaVersion=3)`);
  }
  const check = runCheckModules();
  if (!check.ok) {
    throw new Error(`check-modules 未通过: ${check.error}`);
  }
  for (const warning of check.warnings ?? []) {
    console.warn(`[fetch-module]   check warning: ${warning}`);
  }
  console.log(`[fetch-module]   ${check.summary}`);
  try {
    recordInstallPin(ROOT, folder, { from: opts.from || "", link: !!opts.link });
  } catch (err) {
    console.warn(`[fetch-module]   pin warn: ${err instanceof Error ? err.message : String(err)}`);
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
 * `sfmc mod install <id>` 走包 registry 的主路径，由 pnpm 下载。
 *
 * 入口：临时项目中执行 `pnpm add --prod --ignore-scripts <pkgName>`，再复制包文件。
 *   - 落地到 packages/<id>，不进主仓根 node_modules（隔离安装）
 *   - 成功后 upsert catalog/lock
 *   - 失败时把常见 registry 错误翻译成中文可读提示
 * @param {string} id
 * @param {string} pkgName
 * @param {any} flags
 */
async function fromRegistry(id, pkgName, flags = {}) {
  const dir = await ensureTarget(id);
  const os = await import("node:os");
  const tmpPrefix = await fsp.mkdtemp(path.join(os.tmpdir(), "sfmc-pnpm-install-"));
  try {
    await installWithPnpm(tmpPrefix, pkgName);
    const installed = findInstalledModule(tmpPrefix, id, pkgName);
    if (!installed) throw new Error(`pnpm add 完成，但 ${pkgName} 中未找到模块 ${id}`);
    await copyDir(installed, dir);
  } catch (error) {
    await removePackageTarget(dir);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(translatePnpmInstallError(pkgName, message));
  } finally {
    try {
      await fsp.rm(tmpPrefix, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
  }
  console.log(`[fetch-module] installed ${id} from registry (${pkgName})`);
  console.log(`[fetch-module]   target: ${dir}`);
  afterInstall(id, installOpts(flags));
}

/**
 * 翻译常见 pnpm registry 错误为中文可读 + 下一步动作。
 * @param {string} pkgName
 * @param {string} stderr
 */
function translatePnpmInstallError(pkgName, stderr) {
  const text = String(stderr || "");
  if (/ERR_PNPM_FETCH_404|404 Not Found|not found/i.test(text)) {
    return `registry 中未找到包: ${pkgName}。请检查 manifest id / scope 拼写，或换 --from local:./<path>。`;
  }
  if (/ERR_PNPM_FETCH_401|ERR_PNPM_FETCH_403|EACCES|permission/i.test(text)) {
    return `registry 权限错误: ${pkgName}。检查 pnpm registry 登录态或 token 权限。`;
  }
  if (/ERR_PNPM_PEER_DEP_ISSUES|ERESOLVE/i.test(text)) {
    return `依赖冲突: ${pkgName}。请先确认 SDK/宿主版本兼容。`;
  }
  if (/ETIMEDOUT|ECONNRESET|ENOTFOUND|ERR_PNPM_FETCH/i.test(text)) {
    return `registry 网络错误: ${pkgName}。检查代理 / 网络；或离线用 --from local:<tgz|dir>。`;
  }
  return `pnpm add ${pkgName} 失败:\n${text.trim()}`;
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
    await extractTgz(absPath, dir, id);
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
  afterInstall(id, installOpts(flags));
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
    afterInstall(id, installOpts(flags, { skipNormalize: true }));
  } else {
    const dir = await ensureTarget(id);
    await copyDir(srcDir, dir);
    console.log(`[fetch-module] installed ${id} from dir ${srcDir}`);
    console.log(`[fetch-module]   target: ${dir}`);
    afterInstall(id, installOpts(flags));
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
  afterInstall(id, installOpts(flags));
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
 * 解 package tarball（.tgz）到 packages/<id>。
 * 委托 pnpm 在临时项目中安装并安全解包，再将包文件复制到模块目录。
 * @param {fs.PathLike} tgzPath
 * @param {string} dstDir
 * @param {string} id
 */
async function extractTgz(tgzPath, dstDir, id) {
  const os = await import("node:os");
  const tmpPrefix = await fsp.mkdtemp(path.join(os.tmpdir(), "sfmc-tgz-"));
  try {
    await installWithPnpm(tmpPrefix, tgzPath);
    const found = findInstalledModule(tmpPrefix, id);
    if (!found) throw new Error(`pnpm add 已解包，但 tarball 中未找到模块 ${id}`);
    await copyDir(found, dstDir);
  } finally {
    try {
      await fsp.rm(tmpPrefix, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
  }
}

/**
 * 在临时项目中安装包，只读取 registry/tarball 内容，不执行包的生命周期脚本。
 * @param {string} projectDir
 * @param {string | fs.PathLike} packageSpec
 */
async function installWithPnpm(projectDir, packageSpec) {
  await fsp.writeFile(
    path.join(projectDir, "package.json"),
    '{"name":"sfmc-module-install-tmp","version":"0.0.0","private":true}\n'
  );
  // @ts-ignore - cross-spawn resolves pnpm.cmd safely on Windows.
  const spawnChild = (await import("cross-spawn")).default;
  await new Promise((resolve, reject) => {
    const proc = spawnChild(
      "pnpm",
      [
        "--dir",
        projectDir,
        "add",
        "--ignore-workspace",
        "--config.auto-install-peers=false",
        "--prod",
        "--ignore-scripts",
        String(packageSpec),
      ],
      { stdio: ["ignore", "ignore", "pipe"] }
    );
    let stderr = "";
    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
    });
    proc.on("close", (code, signal) => {
      if (code === 0) return resolve();
      reject(
        new Error(
          code === null
            ? `pnpm add terminated by ${signal || "unknown signal"}: ${stderr.trim()}`
            : `pnpm add failed (${code}): ${stderr.trim()}`
        )
      );
    });
    proc.on("error", (error) => reject(new Error(`无法启动 pnpm: ${error.message}`)));
  });
}

/**
 * 从 pnpm 临时项目的 node_modules 中解析模块包真实目录。
 * @param {string} projectDir
 * @param {string} id
 * @param {string} [packageSpec]
 */
function findInstalledModule(projectDir, id, packageSpec) {
  const nodeModules = path.join(projectDir, "node_modules");
  if (!exists(nodeModules)) return null;
  /** @type {string[]} */
  const candidates = [];
  if (packageSpec) {
    const packageName = packageNameFromSpec(String(packageSpec));
    if (packageName) candidates.push(path.join(nodeModules, ...packageName.split("/")));
  }
  for (const entry of fs.readdirSync(nodeModules, { withFileTypes: true })) {
    if (entry.name === ".bin" || entry.name === ".pnpm" || entry.name.startsWith(".")) continue;
    const entryPath = path.join(nodeModules, entry.name);
    if (entry.name.startsWith("@")) {
      for (const scoped of fs.readdirSync(entryPath, { withFileTypes: true })) {
        candidates.push(path.join(entryPath, scoped.name));
      }
    } else {
      candidates.push(entryPath);
    }
  }
  const seen = new Set();
  for (const candidate of candidates) {
    let real;
    try {
      real = fs.realpathSync(candidate);
    } catch {
      continue;
    }
    if (seen.has(real)) continue;
    seen.add(real);
    try {
      const manifestPath = path.join(real, "sapi", "manifest.json");
      const moduleId = exists(manifestPath)
        ? String(JSON.parse(fs.readFileSync(manifestPath, "utf8")).id || "").replace(/^(feature|core)-/, "")
        : "";
      const pkgName = String(JSON.parse(fs.readFileSync(path.join(real, "package.json"), "utf8")).name || "");
      if (moduleId === id || folderFromNpmPackageName(pkgName) === id) return real;
    } catch {
      /* ignore package entries without module metadata */
    }
  }
  return null;
}

/** @param {string} spec */
function packageNameFromSpec(spec) {
  if (spec.startsWith("@")) {
    const slash = spec.indexOf("/");
    if (slash < 0) return null;
    const versionSeparator = spec.indexOf("@", slash + 1);
    return versionSeparator < 0 ? spec : spec.slice(0, versionSeparator);
  }
  const versionSeparator = spec.indexOf("@");
  return versionSeparator < 0 ? spec : spec.slice(0, versionSeparator);
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
  if (from.startsWith("npm:")) return fromRegistry(id, from.slice("npm:".length), perFlags);
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
  if (removePin(ROOT, removed?.id || id)) {
    console.log(`[fetch-module]   pin removed: ${removed?.id || id}`);
  }
}

function printHelp() {
  console.log(`@sfmc-bds/cli fetch-module — populate ./modules/packages/<id>/

Commands:
  search                              list first-party registry
  list [--from github:owner/repo@tag] list release assets (default: first-party)
  install <id> [id2 ...] [--from ...] [--link] [--preserve-lock]
                                      install one or more modules + sync catalog/lock
  update [id ...] [--check] [--yes] [--allow-major] [--startup]
                                      plan or apply module updates
  uninstall <id> [id2 ...]            remove package dir + catalog/lock/pin entries

Sources (按优先级):
  npm:@scope/name                npm registry（默认；install <id> → @sfmc-bds/module-<id>）
  local:[/abs/path]              本地目录 / .tgz / .zip（无路径默认 cwd）
  tgz:[/abs/path]                等价 local:，显式声明 .tgz
  zip:[/abs/path]                等价 local:，强制校验内含 package.json + manifest
  dir:/abs/path                  本地目录（自动判单包/多包父目录）
  github:owner/repo[@tag]        GitHub Release（兼容旧 first-party）

Flags:
  --link            with dir: or local:<dir> — junction (Windows) / symlink (POSIX)
  --preserve-lock   keep the current module-lock enabled bit
`);
}

/**
 * 升级时保留启停锁。供 mod update 调用，不走全新安装的默认启用。
 * @param {string} id
 * @param {string} spec
 */
export async function installPreservingLock(id, spec) {
  await installOne(id, { from: spec, sha256: null, link: false, preserveLock: true });
}

/**
 * @param {string[]} args
 */
function parseUpdateArgs(args) {
  const flags = { check: false, yes: false, allowMajor: false, startup: false };
  /** @type {string[]} */
  const positional = [];
  for (const a of args) {
    if (a === "--check") flags.check = true;
    else if (a === "--yes") flags.yes = true;
    else if (a === "--allow-major") flags.allowMajor = true;
    else if (a === "--startup") flags.startup = true;
    else if (a.startsWith("--")) die(`unknown flag: ${a}`);
    else positional.push(a);
  }
  return { flags, positional };
}

/**
 * @param {import("./lib/module-update.mjs").ModuleSkip} item
 */
function formatSkip(item) {
  const versions = item.fromVersion || item.toVersion ? ` ${item.fromVersion || "?"} -> ${item.toVersion || "?"}` : "";
  const detail = item.detail ? ` (${item.detail})` : "";
  return `  skip ${item.id}${versions}  ${item.reason}${detail}`;
}

/**
 * @param {string[]} args
 */
async function runUpdateCommand(args) {
  const { flags, positional } = parseUpdateArgs(args);
  const plan = await planModuleUpdates({
    root: ROOT,
    startup: flags.startup,
    allowMajor: flags.allowMajor,
    ids: positional,
  });
  if (plan.configSkipped === "disabled") {
    console.log("[module-update] disabled");
    return;
  }
  if (plan.configSkipped === "check-off") {
    console.log("[module-update] check skipped");
    return;
  }
  /* 点名了模块 id 时展示 auto-off / local-source / up-to-date 和版本；开服 --startup 仍隐藏。 */
  const namedModule = positional.length > 0;
  const showQuietSkips = !flags.startup && (flags.check || namedModule);
  for (const item of plan.skipped) {
    if (!showQuietSkips && QUIET_SKIP_REASONS.has(item.reason)) continue;
    console.log(formatSkip(item));
  }
  for (const item of plan.upgrades) {
    console.log(`  upgrade ${item.id}  ${item.fromVersion || "?"} -> ${item.toVersion}`);
  }
  if (plan.upgrades.length === 0) console.log("[module-update] nothing to apply");
  const apply = flags.startup ? plan.applyOnStart : !flags.check;
  if (!apply || plan.upgrades.length === 0) return;
  if (!flags.yes && !flags.startup) {
    if (!process.stdin.isTTY) die("non-interactive update needs --yes");
    const ok = await new Promise((resolve) => {
      process.stdout.write("Apply module updates? [y/N] ");
      process.stdin.setEncoding("utf8");
      process.stdin.once("data", (buf) => {
        const answer = String(buf).trim().toLowerCase();
        resolve(answer === "y" || answer === "yes");
      });
    });
    if (!ok) {
      console.log("[module-update] cancelled");
      return;
    }
  }
  const result = await applyModuleUpgrades(plan.upgrades, {
    root: ROOT,
    failMode: plan.failMode,
    install: installPreservingLock,
    resync: resyncInstalledCatalog,
  });
  for (const item of result.applied) {
    console.log(`[module-update] applied ${item.id} ${item.fromVersion || "?"} -> ${item.toVersion}`);
  }
  for (const item of result.skipped) console.log(formatSkip(item));
  for (const item of result.failed) console.log(`[module-update] failed ${item.id}: ${item.message}`);
  if (result.failed.length > 0 && plan.failMode === "abort") process.exitCode = 1;
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
      const src = e.npm
        ? `npm:${e.npm}${e.version ? `@${e.version}` : ""}`
        : e.repo
          ? `github:${e.repo}@${e.tag}`
          : "?";
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

  if (verb === "update") {
    await runUpdateCommand(rest);
    return;
  }

  if (verb !== "install") die(`unknown verb: ${verb}`);

  const { flags, positional } = parseArgs(rest);
  let ids = [...positional];
  if (ids.length === 0) {
    const from = flags.from;
    // @ts-ignore
    if (!from || (!from.startsWith("local") && !from.startsWith("dir:"))) {
      die(
        "usage: install <id> [id2 ...] [--from <source>] [--link]\n或: install --from local|dir:<path> [--link]（从包目录推导 id）"
      );
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

if (isFetchModuleEntry()) {
  main().catch((e) => die(e?.message ?? String(e)));
}
