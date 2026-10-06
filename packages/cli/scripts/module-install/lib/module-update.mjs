// @ts-check
/**
 * 模块更新编排：根据 pin、索引和本机 SDK 决定升级候选，并按依赖顺序换包。
 * 安装目录若是 symlink / junction，只记 local-source 跳过，不换包。
 * 下载与落盘由调用方注入的 install，本文件不复制第二套安装逻辑。
 */
import { isRetiredPlatformModule, RETIRED_PLATFORM_MODULES } from "@sfmc-bds/sdk/contracts";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { upsertCatalogEntry } from "./catalog.mjs";
import { readJson } from "./io.mjs";
import { loadModuleUpdateConfig } from "./module-update-config.mjs";
import {
  findPinKey,
  isLinkedPackageDir,
  markPinError,
  normalizeModuleId,
  packageDirOf,
  readManifestId,
  readPackageName,
  readPackageVersion,
  refreshPinsFromDisk,
} from "./pins.mjs";
import { CLI_PKG_DIR, ROOT } from "./paths.mjs";
import { resolveRegistryIndex } from "./registry-cache.mjs";
import { compareSemver, isMajorBump, satisfiesSdk } from "./semver.mjs";

/**
 * @typedef {{
 *   id: string,
 *   fromVersion: string | null,
 *   toVersion: string | null,
 *   spec: string,
 *   requires: string[],
 * }} ModuleUpgrade
 * @typedef {{
 *   id: string,
 *   reason: string,
 *   fromVersion: string | null,
 *   toVersion: string | null,
 *   detail: string,
 * }} ModuleSkip
 * @typedef {{
 *   configSkipped: "disabled" | "check-off" | null,
 *   applyOnStart: boolean,
 *   failMode: "continue" | "abort",
 *   upgrades: ModuleUpgrade[],
 *   skipped: ModuleSkip[],
 * }} ModuleUpdatePlan
 */

/** 这些跳过原因在开服日志里不展开，避免每轮刷屏。 */
export const QUIET_SKIP_REASONS = new Set(["auto-off", "local-source", "up-to-date"]);

/**
 * 目录名或 manifest.id 是否已收编至平台。
 * @param {string | null | undefined} id
 */
function isRetiredModuleId(id) {
  const raw = String(id ?? "");
  return isRetiredPlatformModule(raw) || isRetiredPlatformModule(normalizeModuleId(raw));
}

/**
 * 读取本机 @sfmc-bds/sdk 版本，用来对照索引里的 sdk 范围。
 * @param {string} [cliPkgDir]
 * @returns {string | null}
 */
export function readHostSdkVersion(cliPkgDir = CLI_PKG_DIR) {
  try {
    const require = createRequire(path.join(cliPkgDir, "package.json"));
    const pkg = require("@sfmc-bds/sdk/package.json");
    if (pkg && typeof pkg.version === "string") return pkg.version;
  } catch {
    /* 开发仓里可能还没装到 node_modules */
  }
  const bundled = path.join(cliPkgDir, "..", "..", "modules", "sdk", "@sfmc-sdk", "package.json");
  const raw = readJson(bundled, null);
  if (raw && typeof raw.version === "string") return raw.version;
  return null;
}

/**
 * 拉取 npm dist-tag 上的版本号。
 * @param {string} packageName
 * @param {string} [tag]
 * @returns {Promise<string | null>}
 */
export async function fetchNpmDistTag(packageName, tag = "latest") {
  const encoded = packageName.replace("/", "%2f");
  const res = await fetch(`https://registry.npmjs.org/${encoded}`, {
    headers: {
      Accept: "application/vnd.npm.install-v1+json",
      "User-Agent": "sfmc-fetch-module",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${packageName}`);
  const body = await res.json();
  const version = body?.["dist-tags"]?.[tag];
  return typeof version === "string" ? version : null;
}

/**
 * @returns {Promise<{ index: Record<string, { npm?: string, version?: string, sdk?: string }> | null, offline: boolean }>}
 */
export async function loadRegistryIndexForUpdate() {
  try {
    const { index } = await resolveRegistryIndex();
    return { index, offline: false };
  } catch {
    return { index: null, offline: true };
  }
}

/**
 * 决定单个模块是升级还是跳过。
 * @param {{
 *   auto: boolean,
 *   autoLocked: boolean,
 *   source: string,
 *   installedVersion: string | null,
 *   targetVersion: string | null,
 *   allowMajor: boolean,
 *   sdkRange: string | null,
 *   hostSdk: string | null,
 *   offline: boolean,
 *   targetReason: string | null,
 * }} input
 * @returns {{ action: "upgrade" | "skip", reason: string, detail: string }}
 */
export function decideModuleUpdate(input) {
  if (input.autoLocked || input.source === "link" || input.source === "local") {
    return { action: "skip", reason: "local-source", detail: "" };
  }
  if (!input.auto) return { action: "skip", reason: "auto-off", detail: "" };
  if (input.offline && !input.targetVersion) {
    return { action: "skip", reason: "registry-offline", detail: "" };
  }
  if (!input.targetVersion) {
    return { action: "skip", reason: input.targetReason || "no-target", detail: "" };
  }
  if (!input.installedVersion) {
    return { action: "skip", reason: "no-installed-version", detail: "" };
  }
  const cmp = compareSemver(input.targetVersion, input.installedVersion);
  if (cmp === null) return { action: "skip", reason: "bad-version", detail: "" };
  if (cmp === 0) return { action: "skip", reason: "up-to-date", detail: "" };
  if (cmp < 0) return { action: "skip", reason: "installed-newer", detail: "" };
  if (isMajorBump(input.installedVersion, input.targetVersion) && !input.allowMajor) {
    return { action: "skip", reason: "major", detail: "" };
  }
  /* 范围明确但本机 SDK 读不到时不要升级。空范围和 * 仍走下面的原判断。 */
  if (sdkRangeConstrainsHost(input.sdkRange) && !input.hostSdk) {
    return { action: "skip", reason: "sdk", detail: "本机 SDK 版本未知" };
  }
  if (input.sdkRange && input.hostSdk && !satisfiesSdk(input.hostSdk, input.sdkRange)) {
    return { action: "skip", reason: "sdk", detail: `${input.hostSdk} / ${input.sdkRange}` };
  }
  return { action: "upgrade", reason: "newer", detail: "" };
}

/**
 * 这个 SDK 范围是否要求对照本机版本。
 * 使用场景：decideModuleUpdate 在 hostSdk 为空时，只有非空且不是 * 的范围才跳过。
 * @param {string | null | undefined} sdkRange
 */
function sdkRangeConstrainsHost(sdkRange) {
  if (typeof sdkRange !== "string") return false;
  const text = sdkRange.trim();
  return text.length > 0 && text !== "*";
}

/**
 * 安装目录是 symlink 或 Windows junction 时返回 local-source 跳过项，否则返回 null。
 * 使用场景：规划阶段不把开发链接放进 upgrades；apply 阶段即使候选被强行传入，也不调用 install 覆盖链接。
 * @param {string} id
 * @param {string} dir
 * @param {string | null} fromVersion
 * @param {string | null} toVersion
 * @returns {ModuleSkip | null}
 */
function skipWhenDevLink(id, dir, fromVersion, toVersion) {
  if (!isLinkedPackageDir(dir)) return null;
  return { id, reason: "local-source", fromVersion, toVersion, detail: "" };
}

/**
 * 被依赖的模块排在前面。环路保持原顺序附在末尾。
 * @param {ModuleUpgrade[]} items
 * @returns {ModuleUpgrade[]}
 */
export function orderUpgrades(items) {
  /** @type {Map<string, ModuleUpgrade>} */
  const byNorm = new Map();
  for (const item of items) byNorm.set(normalizeModuleId(item.id), item);
  /** @type {Map<string, number>} */
  const indegree = new Map();
  /** @type {Map<string, string[]>} */
  const children = new Map();
  for (const item of items) {
    const id = normalizeModuleId(item.id);
    indegree.set(id, 0);
    children.set(id, []);
  }
  for (const item of items) {
    const id = normalizeModuleId(item.id);
    for (const req of item.requires || []) {
      if (!byNorm.has(req) || req === id) continue;
      indegree.set(id, (indegree.get(id) || 0) + 1);
      children.get(req)?.push(id);
    }
  }
  /** @type {string[]} */
  const queue = [];
  for (const item of items) {
    const id = normalizeModuleId(item.id);
    if ((indegree.get(id) || 0) === 0) queue.push(id);
  }
  /** @type {ModuleUpgrade[]} */
  const ordered = [];
  const seen = new Set();
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const item = byNorm.get(id);
    if (item) ordered.push(item);
    for (const child of children.get(id) || []) {
      indegree.set(child, (indegree.get(child) || 0) - 1);
      if ((indegree.get(child) || 0) === 0) queue.push(child);
    }
  }
  for (const item of items) {
    if (!seen.has(normalizeModuleId(item.id))) ordered.push(item);
  }
  return ordered;
}

/**
 * 从 pin.spec 取出 npm 包名。
 * @param {string} spec
 * @param {string | null} packageName
 */
function npmNameFromPin(spec, packageName) {
  if (packageName) return packageName;
  if (!spec.startsWith("npm:")) return null;
  const body = spec.slice("npm:".length);
  const slash = body.indexOf("/");
  const at = body.indexOf("@", slash >= 0 ? slash + 1 : 0);
  const name = at > 0 ? body.slice(0, at) : body;
  return name || null;
}

/**
 * 索引已经在手里时，只记下目标版本供跳过记录展示，不生成安装 spec。
 * 使用场景：自动更新关闭，以及本地链接 / local / autoLocked，都不能为此去打 npm dist-tag。
 * @param {{ npm?: string, version?: string, sdk?: string } | null | undefined} indexEntry
 */
function desiredVersionFromHeldIndex(indexEntry) {
  if (indexEntry?.version) {
    return {
      version: indexEntry.version,
      spec: null,
      sdk: indexEntry.sdk || null,
      offline: false,
      reason: null,
    };
  }
  return { version: null, spec: null, sdk: indexEntry?.sdk || null, offline: false, reason: null };
}

/**
 * @param {import("./pins.mjs").ModulePin} pin
 * @param {{ npm?: string, version?: string, sdk?: string } | null | undefined} indexEntry
 * @param {(name: string, tag: string) => Promise<string | null>} fetchDistTag
 * @param {string} distTag
 * @param {boolean} indexOffline
 * @param {string | null} packageName
 */
async function resolveDesired(pin, indexEntry, fetchDistTag, distTag, indexOffline, packageName) {
  /* 本地链接、目录和锁定来源不查 dist-tag；索引已在手里时仍把目标版本交给跳过记录。 */
  if (pin.autoLocked || pin.source === "link" || pin.source === "local") {
    return desiredVersionFromHeldIndex(indexEntry);
  }
  if (pin.source === "github") {
    return { version: null, spec: null, sdk: null, offline: false, reason: "github-manual" };
  }
  if (pin.source === "npm" && indexEntry?.npm && indexEntry.version) {
    return {
      version: indexEntry.version,
      /* auto 关闭只展示版本，不给出可安装 spec，避免被当成升级。 */
      spec: pin.auto ? `npm:${indexEntry.npm}@${indexEntry.version}` : null,
      sdk: indexEntry.sdk || null,
      offline: false,
      reason: null,
    };
  }
  /* 自动更新关闭且索引里没有目标版本时，不要改去打 dist-tag。 */
  if (!pin.auto) return desiredVersionFromHeldIndex(indexEntry);
  /* 默认跟随索引的包在索引不可用时不改去拉 npm latest。服主显式打开的包仍走 dist-tag。 */
  const expectsIndex = pin.channel === "index" && pin.autoSetBy !== "user";
  if (expectsIndex && (indexOffline || !indexEntry?.version)) {
    return {
      version: null,
      spec: null,
      sdk: indexEntry?.sdk || null,
      offline: indexOffline,
      reason: indexOffline ? "registry-offline" : "no-target",
    };
  }
  const name = npmNameFromPin(pin.spec, packageName);
  if (!name) return { version: null, spec: null, sdk: indexEntry?.sdk || null, offline: false, reason: "no-target" };
  try {
    const version = await fetchDistTag(name, distTag);
    if (!version) return { version: null, spec: null, sdk: indexEntry?.sdk || null, offline: false, reason: "no-target" };
    return {
      version,
      spec: `npm:${name}@${version}`,
      sdk: indexEntry?.sdk || null,
      offline: false,
      reason: null,
    };
  } catch {
    return { version: null, spec: null, sdk: null, offline: true, reason: "registry-offline" };
  }
}

/**
 * @param {string} root
 * @param {string} folder
 */
function readRequires(root, folder) {
  const manifestPath = path.join(packageDirOf(root, folder), "sapi", "manifest.json");
  const raw = readJson(manifestPath, null);
  if (!raw || typeof raw !== "object") return [];
  const requires = /** @type {Record<string, unknown>} */ (raw).requires;
  if (!Array.isArray(requires)) return [];
  return requires.map((item) => normalizeModuleId(String(item))).filter(Boolean);
}

/**
 * 生成升级计划。startup 且未开启检查时不访问网络。
 * @param {{
 *   root?: string,
 *   startup?: boolean,
 *   allowMajor?: boolean,
 *   ids?: string[],
 *   hostSdk?: string | null,
 *   fetchIndex?: () => Promise<{ index: Record<string, { npm?: string, version?: string, sdk?: string }> | null, offline: boolean }>,
 *   fetchDistTag?: (name: string, tag: string) => Promise<string | null>,
 * }} [options]
 * @returns {Promise<ModuleUpdatePlan>}
 */
export async function planModuleUpdates(options = {}) {
  const root = options.root ?? ROOT;
  const cfg = loadModuleUpdateConfig(root);
  if (!cfg.enabled) {
    return { configSkipped: "disabled", applyOnStart: false, failMode: cfg.failMode, upgrades: [], skipped: [] };
  }
  if (options.startup && !cfg.checkOnBdsStart) {
    return { configSkipped: "check-off", applyOnStart: false, failMode: cfg.failMode, upgrades: [], skipped: [] };
  }
  const fetchIndex = options.fetchIndex ?? loadRegistryIndexForUpdate;
  const fetchDistTag = options.fetchDistTag ?? fetchNpmDistTag;
  const loaded = await fetchIndex();
  const index = loaded.index;
  const indexOffline = loaded.offline || !index;
  const pins = refreshPinsFromDisk(root, index);
  const hostSdk = options.hostSdk === undefined ? readHostSdkVersion() : options.hostSdk;
  const allowMajor = options.allowMajor === true || cfg.allowMajor;
  const wanted = new Set((options.ids || []).map((id) => normalizeModuleId(id)).filter(Boolean));
  const installedNorm = new Set();
  for (const [folder, pin] of Object.entries(pins.modules)) {
    installedNorm.add(normalizeModuleId(folder));
    if (pin.manifestId) installedNorm.add(normalizeModuleId(pin.manifestId));
  }
  for (const id of RETIRED_PLATFORM_MODULES) installedNorm.add(normalizeModuleId(id));

  /** @type {ModuleUpgrade[]} */
  const upgrades = [];
  /** @type {ModuleSkip[]} */
  const skipped = [];
  /** @type {string[]} */
  const missing = [];
  if (wanted.size > 0) {
    for (const id of options.ids || []) {
      if (!findPinKey(pins, id)) missing.push(id);
    }
  }
  for (const id of missing) {
    skipped.push({ id, reason: "missing-module", fromVersion: null, toVersion: null, detail: "" });
  }

  for (const [folder, pin] of Object.entries(pins.modules)) {
    const manifestId = pin.manifestId || readManifestId(packageDirOf(root, folder));
    const keys = [normalizeModuleId(folder), normalizeModuleId(manifestId)];
    if (wanted.size > 0 && !keys.some((key) => wanted.has(key))) continue;
    const dir = packageDirOf(root, folder);
    const installedVersion = readPackageVersion(dir) ?? pin.installedVersion;
    if ([folder, manifestId].some((id) => isRetiredModuleId(id))) {
      skipped.push({ id: folder, reason: "retired", fromVersion: installedVersion, toVersion: null, detail: "" });
      continue;
    }
    const indexEntry = index ? index[folder] || index[normalizeModuleId(manifestId || "")] || null : null;
    /* 目录本身是开发链接时先跳过，避免 pin 写成 npm 后仍去查 dist-tag 并换包。 */
    const linkSkip = skipWhenDevLink(
      folder,
      dir,
      installedVersion,
      desiredVersionFromHeldIndex(indexEntry).version,
    );
    if (linkSkip) {
      skipped.push(linkSkip);
      continue;
    }
    if (!fs.existsSync(dir)) continue;
    const packageName = readPackageName(dir);
    const desired = await resolveDesired(pin, indexEntry, fetchDistTag, cfg.distTag, indexOffline, packageName);
    const requires = readRequires(root, folder);
    const missingDep = requires.find((req) => req && !installedNorm.has(req));
    if (pin.auto && !pin.autoLocked && missingDep) {
      skipped.push({
        id: folder,
        reason: "missing-dependency",
        fromVersion: installedVersion,
        toVersion: desired.version,
        detail: missingDep,
      });
      continue;
    }
    const decision = decideModuleUpdate({
      auto: pin.auto,
      autoLocked: pin.autoLocked,
      source: pin.source,
      installedVersion,
      targetVersion: desired.version,
      allowMajor,
      sdkRange: desired.sdk,
      hostSdk,
      offline: desired.offline,
      targetReason: desired.reason,
    });
    if (decision.action === "upgrade" && desired.spec && desired.version) {
      upgrades.push({
        id: folder,
        fromVersion: installedVersion,
        toVersion: desired.version,
        spec: desired.spec,
        requires,
      });
    } else {
      skipped.push({
        id: folder,
        reason: decision.reason,
        fromVersion: installedVersion,
        toVersion: desired.version,
        detail: decision.detail,
      });
    }
  }

  return {
    configSkipped: null,
    applyOnStart: options.startup ? cfg.applyOnBdsStart : true,
    failMode: cfg.failMode,
    upgrades: orderUpgrades(upgrades),
    skipped,
  };
}

/**
 * 把现有包目录移到 modules/_trash，返回备份路径。目录不存在时返回 null。
 * junction 只移动链接本身。
 * @param {string} root
 * @param {string} id
 * @returns {Promise<string | null>}
 */
export async function backupPackageDir(root, id) {
  const src = packageDirOf(root, id);
  try {
    await fsp.lstat(src);
  } catch {
    return null;
  }
  const trash = path.join(root, "modules", "_trash");
  await fsp.mkdir(trash, { recursive: true });
  const dest = path.join(trash, `${id}-${Date.now()}-${randomBytes(3).toString("hex")}`);
  await fsp.rename(src, dest);
  return dest;
}

/**
 * 删掉失败的新目录，再把备份移回原位。
 * @param {string} root
 * @param {string} id
 * @param {string} backup
 */
export async function restorePackageDir(root, id, backup) {
  const dest = packageDirOf(root, id);
  await fsp.rm(dest, { recursive: true, force: true });
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  await fsp.rename(backup, dest);
}

/**
 * 删掉 backupPackageDir 这次留下的备份目录。
 * 使用场景：applyModuleUpgrades 在 install 成功后调用；删除失败必须忽略，不能把成功升级记成失败。
 * @param {string | null} backup
 */
async function discardUpgradeBackup(backup) {
  if (!backup) return;
  try {
    await fsp.rm(backup, { recursive: true, force: true });
  } catch {
    /* 回收站删不掉时保留目录，不回滚已经装好的包 */
  }
}

/**
 * 还原后按磁盘上的 manifest 重写 catalog 里这一条。
 * @param {string} folder
 */
export function resyncInstalledCatalog(folder) {
  try {
    upsertCatalogEntry(folder);
  } catch {
    /* 目录暂时读不到 manifest 时保留调用方已经恢复的文件 */
  }
}

/**
 * 按计划换包。单个失败时还原该模块，并根据 failMode 决定是否继续。
 * 安装目录若是 symlink / junction，记 local-source 并跳过，不调用 install。
 * @param {ModuleUpgrade[]} upgrades
 * @param {{
 *   root: string,
 *   failMode: "continue" | "abort",
 *   install: (id: string, spec: string) => Promise<void>,
 *   resync?: (id: string) => void,
 * }} deps
 */
export async function applyModuleUpgrades(upgrades, deps) {
  /** @type {Set<string>} */
  const failedNorm = new Set();
  /** @type {ModuleUpgrade[]} */
  const applied = [];
  /** @type {ModuleSkip[]} */
  const skipped = [];
  /** @type {{ id: string, message: string }[]} */
  const failed = [];
  for (const item of upgrades) {
    if (isRetiredModuleId(item.id)) {
      skipped.push({ id: item.id, reason: "retired", fromVersion: item.fromVersion, toVersion: item.toVersion, detail: "" });
      continue;
    }
    const linkSkip = skipWhenDevLink(item.id, packageDirOf(deps.root, item.id), item.fromVersion, item.toVersion);
    if (linkSkip) {
      skipped.push(linkSkip);
      continue;
    }
    const blocked = (item.requires || []).some((req) => failedNorm.has(req));
    if (blocked) {
      skipped.push({
        id: item.id,
        reason: "dependency-failed",
        fromVersion: item.fromVersion,
        toVersion: item.toVersion,
        detail: "",
      });
      failedNorm.add(normalizeModuleId(item.id));
      if (deps.failMode === "abort") break;
      continue;
    }
    /** @type {string | null} */
    let backup = null;
    try {
      backup = await backupPackageDir(deps.root, item.id);
      await deps.install(item.id, item.spec);
      applied.push(item);
      /* 这次升级已经落盘，删掉刚才移进 _trash 的那一份备份。 */
      await discardUpgradeBackup(backup);
    } catch (error) {
      const installError = error instanceof Error ? error.message : String(error);
      /** 失败说明。还原失败时在安装错误后面附上备份绝对路径。 */
      let message = installError;
      if (backup) {
        try {
          await restorePackageDir(deps.root, item.id, backup);
        } catch {
          message = `${installError}；还原失败，备份仍在 ${path.resolve(backup)}`;
        }
      }
      if (deps.resync) {
        try {
          deps.resync(item.id);
        } catch {
          /* catalog 重写失败不掩盖原来的升级错误 */
        }
      }
      markPinError(deps.root, item.id, message);
      failed.push({ id: item.id, message });
      failedNorm.add(normalizeModuleId(item.id));
      if (deps.failMode === "abort") break;
    }
  }
  return { applied, skipped, failed };
}

export { ensureModuleUpdateConfigFile } from "./module-update-config.mjs";
export { setModulePinAuto } from "./pins.mjs";
