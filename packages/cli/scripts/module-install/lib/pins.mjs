// @ts-check
/**
 * modules/module-pins.json
 * 记录每个已装模块的来源、已装版本和是否允许自动更新。
 * catalog 仍只投影 manifest，module-lock 仍只记启停。
 */
import fs from "node:fs";
import path from "node:path";
import { readJson, writeJson } from "./io.mjs";
import { ROOT } from "./paths.mjs";
import { readCachedRegistryIndex } from "./registry-cache.mjs";

/**
 * @typedef {"npm" | "github" | "link" | "local"} PinSource
 * @typedef {"index" | "dist-tag" | "none"} PinChannel
 * @typedef {"default" | "user"} PinAutoSetBy
 * @typedef {{
 *   source: PinSource,
 *   channel: PinChannel,
 *   spec: string,
 *   installedVersion: string | null,
 *   manifestId: string | null,
 *   auto: boolean,
 *   autoLocked: boolean,
 *   autoSetBy: PinAutoSetBy,
 *   lastCheckedAt: number | null,
 *   lastAppliedAt: number | null,
 *   lastError: string | null,
 * }} ModulePin
 * @typedef {{ version: number, modules: Record<string, ModulePin> }} ModulePinsFile
 */

/**
 * 去掉 feature- / core- 前缀，让目录名和 manifest.id 能对上。
 * @param {string | null | undefined} id
 */
export function normalizeModuleId(id) {
  return String(id ?? "").replace(/^(feature|core)-/, "");
}

/**
 * @param {string} [root]
 */
export function pinsFile(root = ROOT) {
  return path.join(root, "modules", "module-pins.json");
}

/**
 * @param {string} root
 * @param {string} folder
 */
export function packageDirOf(root, folder) {
  return path.join(root, "modules", "packages", folder);
}

/**
 * @param {string} [root]
 * @returns {ModulePinsFile}
 */
export function readPins(root = ROOT) {
  const raw = readJson(pinsFile(root), null);
  if (!raw || typeof raw !== "object") return { version: 1, modules: {} };
  const modules = /** @type {Record<string, unknown>} */ (raw).modules;
  return {
    version: 1,
    modules: modules && typeof modules === "object" ? /** @type {Record<string, ModulePin>} */ (modules) : {},
  };
}

/**
 * @param {string} root
 * @param {ModulePinsFile} file
 */
export function writePins(root, file) {
  writeJson(pinsFile(root), {
    version: 1,
    modules: file.modules || {},
  });
}

/**
 * 目录是 symlink 或 Windows junction 时视为本地开发链接。
 * 使用场景：回填 pin，以及更新器在规划和应用前拒绝覆盖开发链接。
 * @param {string} dir
 */
export function isLinkedPackageDir(dir) {
  try {
    if (fs.lstatSync(dir).isSymbolicLink()) return true;
  } catch {
    return false;
  }
  /* 个别 Windows junction 的 lstat 不标成 symlink，能读到链接目标也算链接。 */
  if (process.platform !== "win32") return false;
  try {
    fs.readlinkSync(dir);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} dir
 * @returns {string | null}
 */
export function readPackageVersion(dir) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
    return typeof pkg.version === "string" && pkg.version.trim() ? pkg.version.trim() : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} dir
 * @returns {string | null}
 */
export function readPackageName(dir) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
    return typeof pkg.name === "string" && pkg.name.trim() ? pkg.name.trim() : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} dir
 * @returns {string | null}
 */
export function readManifestId(dir) {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, "sapi", "manifest.json"), "utf8"));
    return typeof manifest.id === "string" && manifest.id.trim() ? manifest.id.trim() : null;
  } catch {
    return null;
  }
}

/**
 * npm spec 是否带了精确版本（@scope/name@1.2.3）。
 * @param {string} specBody
 */
function npmSpecHasVersion(specBody) {
  const slash = specBody.indexOf("/");
  const at = specBody.indexOf("@", slash >= 0 ? slash + 1 : 0);
  return at > 0 && specBody.slice(at + 1).length > 0;
}

/**
 * 从本次安装的 --from 推导 pin 草稿。
 * 带版本的 npm 先按索引钉版处理；链接和本地目录强制关闭自动更新。
 * @param {string} from
 * @param {boolean} link
 * @returns {Pick<ModulePin, "source" | "channel" | "spec" | "auto" | "autoLocked">}
 */
export function inferPinDraft(from, link) {
  const spec = String(from ?? "");
  if (link) {
    return { source: "link", channel: "none", spec, auto: false, autoLocked: true };
  }
  if (spec.startsWith("npm:")) {
    const body = spec.slice("npm:".length);
    const pinned = npmSpecHasVersion(body);
    return {
      source: "npm",
      channel: pinned ? "index" : "dist-tag",
      spec,
      auto: false,
      autoLocked: false,
    };
  }
  if (spec.startsWith("github:")) {
    return { source: "github", channel: "none", spec, auto: false, autoLocked: false };
  }
  return { source: "local", channel: "none", spec, auto: false, autoLocked: true };
}

/**
 * 按索引重算“默认”自动更新开关。服主改过的 auto 保持不动。
 * @param {ModulePin} pin
 * @param {{ npm?: string, version?: string } | null | undefined} indexEntry
 * @returns {ModulePin}
 */
export function reconcileDefaultAuto(pin, indexEntry) {
  if (pin.autoLocked || pin.source === "link" || pin.source === "local") {
    return { ...pin, auto: false, autoLocked: true };
  }
  if (pin.autoSetBy === "user") return pin;
  if (pin.source === "npm" && indexEntry?.npm && indexEntry.version) {
    return { ...pin, auto: true, channel: "index" };
  }
  if (pin.source === "github") return { ...pin, auto: false };
  if (pin.channel === "dist-tag") return { ...pin, auto: false };
  return { ...pin, auto: false };
}

/**
 * 升级时若已有启停记录，则不要按 enabledByDefault 重写。
 * @param {boolean} preserveLock
 * @param {boolean} lockHasModule
 */
export function shouldPreserveLock(preserveLock, lockHasModule) {
  return !!(preserveLock && lockHasModule);
}

/**
 * @param {ModulePinsFile} file
 * @param {string} id
 */
export function findPinKey(file, id) {
  if (file.modules[id]) return id;
  const want = normalizeModuleId(id);
  for (const [key, pin] of Object.entries(file.modules)) {
    if (normalizeModuleId(key) === want) return key;
    if (pin?.manifestId && normalizeModuleId(pin.manifestId) === want) return key;
  }
  return null;
}

/**
 * @param {string} root
 * @returns {string[]}
 */
function listPackageFolders(root) {
  const dir = path.join(root, "modules", "packages");
  if (!fs.existsSync(dir)) return [];
  /** @type {string[]} */
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    const abs = path.join(dir, name);
    try {
      if (fs.statSync(abs).isDirectory()) out.push(name);
    } catch {
      /* 跳过读不到的目录 */
    }
  }
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

/**
 * 给还没有 pin 的已装目录补一条记录。不升级。
 * @param {string} root
 * @param {Record<string, { npm?: string, version?: string }> | null} [index]
 * @returns {string[]} 新补上的目录名
 */
export function backfillModulePins(root, index = null) {
  const file = readPins(root);
  /** @type {string[]} */
  const added = [];
  for (const folder of listPackageFolders(root)) {
    if (file.modules[folder]) continue;
    const dir = packageDirOf(root, folder);
    const linked = isLinkedPackageDir(dir);
    const name = readPackageName(dir);
    const version = readPackageVersion(dir);
    const manifestId = readManifestId(dir);
    /** @type {ModulePin} */
    let pin;
    if (linked) {
      pin = {
        source: "link",
        channel: "none",
        spec: "",
        installedVersion: version,
        manifestId,
        auto: false,
        autoLocked: true,
        autoSetBy: "default",
        lastCheckedAt: null,
        lastAppliedAt: null,
        lastError: null,
      };
    } else if (name) {
      pin = {
        source: "npm",
        channel: "none",
        spec: version ? `npm:${name}@${version}` : `npm:${name}`,
        installedVersion: version,
        manifestId,
        auto: false,
        autoLocked: false,
        autoSetBy: "default",
        lastCheckedAt: null,
        lastAppliedAt: null,
        lastError: null,
      };
    } else {
      pin = {
        source: "local",
        channel: "none",
        spec: "",
        installedVersion: version,
        manifestId,
        auto: false,
        autoLocked: true,
        autoSetBy: "default",
        lastCheckedAt: null,
        lastAppliedAt: null,
        lastError: null,
      };
    }
    const entry = index ? index[folder] || index[normalizeModuleId(manifestId || folder)] : null;
    file.modules[folder] = reconcileDefaultAuto(pin, entry);
    added.push(folder);
  }
  if (added.length > 0) writePins(root, file);
  return added;
}

/**
 * 用磁盘上的 package.json 刷新已装版本，并按索引重算默认 auto。
 * @param {string} root
 * @param {Record<string, { npm?: string, version?: string }> | null} index
 */
export function refreshPinsFromDisk(root, index) {
  backfillModulePins(root, index);
  const file = readPins(root);
  let changed = false;
  for (const [folder, pin] of Object.entries(file.modules)) {
    const dir = packageDirOf(root, folder);
    if (!fs.existsSync(dir)) continue;
    const version = readPackageVersion(dir);
    const manifestId = readManifestId(dir);
    const entry = index ? index[folder] || index[normalizeModuleId(manifestId || folder)] || index[normalizeModuleId(pin.manifestId || "")] : null;
    let next = { ...pin };
    if (version !== pin.installedVersion) next = { ...next, installedVersion: version };
    if (manifestId && manifestId !== pin.manifestId) next = { ...next, manifestId };
    next = reconcileDefaultAuto(next, entry);
    if (JSON.stringify(next) !== JSON.stringify(pin)) {
      file.modules[folder] = next;
      changed = true;
    }
  }
  if (changed) writePins(root, file);
  return readPins(root);
}

/**
 * 安装或升级成功后写入 pin。已有记录时保留服主设置的 auto。
 * 写入失败只影响后续自动更新，不让本次安装失败。
 * @param {string} root
 * @param {string} folder
 * @param {{ from?: string, link?: boolean }} opts
 */
export function recordInstallPin(root, folder, opts = {}) {
  const dir = packageDirOf(root, folder);
  const from = String(opts.from ?? "");
  const link = !!opts.link || isLinkedPackageDir(dir);
  const file = readPins(root);
  const prev = file.modules[folder];
  const draft = inferPinDraft(from, link);
  const version = readPackageVersion(dir);
  const manifestId = readManifestId(dir);
  /** @type {ModulePin} */
  const pin = {
    source: from || link ? draft.source : prev?.source || draft.source,
    channel: prev?.channel === "dist-tag" && draft.source === "npm" && !draft.autoLocked ? "dist-tag" : draft.channel,
    spec: from || prev?.spec || draft.spec,
    installedVersion: version,
    manifestId,
    auto: draft.auto,
    autoLocked: draft.autoLocked,
    autoSetBy: "default",
    lastCheckedAt: prev?.lastCheckedAt ?? null,
    lastAppliedAt: Date.now(),
    lastError: null,
  };
  if (!from && !link && prev) {
    pin.source = prev.source;
    pin.channel = prev.channel;
    pin.spec = prev.spec;
    pin.auto = prev.auto;
    pin.autoLocked = prev.autoLocked;
    pin.autoSetBy = prev.autoSetBy;
  } else if (prev && prev.autoSetBy === "user" && !draft.autoLocked) {
    pin.auto = prev.auto;
    pin.autoSetBy = "user";
  }
  if (pin.autoLocked) {
    pin.auto = false;
  } else if (pin.autoSetBy !== "user") {
    const index = readCachedRegistryIndex();
    const entry = index ? index[folder] || index[normalizeModuleId(manifestId || folder)] : null;
    const reconciled = reconcileDefaultAuto(pin, entry);
    pin.auto = reconciled.auto;
    pin.channel = reconciled.channel;
  }
  file.modules[folder] = pin;
  writePins(root, file);
  return pin;
}

/**
 * @param {string} root
 * @param {string} folderOrId
 */
export function removePin(root, folderOrId) {
  const file = readPins(root);
  const key = findPinKey(file, folderOrId);
  if (!key) return false;
  delete file.modules[key];
  writePins(root, file);
  return true;
}

/**
 * @param {string} root
 * @param {string} id
 * @param {string | null} message
 */
export function markPinError(root, id, message) {
  const file = readPins(root);
  const key = findPinKey(file, id);
  if (!key) return;
  const pin = file.modules[key];
  if (!pin) return;
  pin.lastCheckedAt = Date.now();
  pin.lastError = message;
  writePins(root, file);
}

/**
 * 打开或关闭某个模块的自动更新。
 * 链接、本地目录（autoLocked）以及 GitHub 来源不能打开；关闭仍然允许。
 * GitHub 的 autoLocked 保持 false，计划更新仍走 github-manual。
 * @param {string} root
 * @param {string} id
 * @param {boolean} auto
 * @returns {{ ok: true, code: "ok", id: string, auto: boolean } | { ok: false, code: "missing" | "locked", id?: string }}
 */
export function setModulePinAuto(root, id, auto) {
  backfillModulePins(root, null);
  const file = readPins(root);
  const key = findPinKey(file, id);
  if (!key || !file.modules[key]) return { ok: false, code: "missing" };
  const pin = file.modules[key];
  if (auto && (pin.autoLocked || pin.source === "github")) return { ok: false, code: "locked", id: key };
  pin.auto = !!auto;
  pin.autoSetBy = "user";
  pin.lastError = null;
  writePins(root, file);
  return { ok: true, code: "ok", id: key, auto: !!auto };
}
