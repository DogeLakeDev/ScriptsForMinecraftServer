import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { resolveRegistryIndex } from "../registry.js";
import { ROOT, resolveFetchModule } from "../runtime.js";
import { resolveBdsContext, scanLocalModules } from "../pack-lifecycle.js";
import { listInstalledWorldPacks, enableInstalledPack, disableInstalledPack, writePackHeaderVersion } from "@sfmc-bds/bds-tools/world-packs";
import { buildPackUninstallQueue, isProtectedSfmcPack, resolveUninstallTargets, runPackUninstallQueue } from "../world-packs.js";
import { atomicJson } from "./tasks.js";
import { assessModuleRequires, moduleRequireBlockMessage } from "@sfmc-bds/management";
import { isRetiredPlatformModule } from "@sfmc-bds/sdk/contracts";

/**
 * 去掉 UTF-8 BOM。
 * 使用场景：编辑器或 BDS 写出的 JSON（例如 configs/permissions.json）常带 BOM，直接 JSON.parse 会失败。
 */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}
export function readJson<T>(file: string, fallback: T): T {
  try { return JSON.parse(stripBom(fs.readFileSync(file, "utf8"))) as T; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback; throw error; }
}
export function identifier(value: unknown): string {
  if (typeof value !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(value) || value.includes("..")) throw new Error("非法标识符");
  return value;
}
export async function listModules() {
  const rows = (await scanLocalModules()).filter(row => !isRetiredPlatformModule(row.logicalId));
  // 目录里的展示名来自 modules/catalog.json；没有中文名时仍用逻辑 id，避免界面只剩文件夹名。
  const catalog = readJson<{ modules?: { id?: string; name?: string }[] }>(path.join(ROOT, "modules", "catalog.json"), {});
  const titles = new Map((catalog.modules ?? []).filter(row => row.id && row.name).map(row => [row.id!, row.name!]));
  return { modules: rows.map(row => ({ id: row.logicalId, folder: row.folderId, name: titles.get(row.logicalId) || row.logicalId, version: row.version ?? "unknown", enabled: row.enabled, linked: fs.lstatSync(path.join(ROOT, "modules", "packages", row.folderId)).isSymbolicLink() })) };
}
function fetchEntry() { const entry = resolveFetchModule(); if (!entry) throw new Error("找不到模块安装器"); return entry; }
export async function searchModules(query: string) {
  let result = await resolveRegistryIndex();
  // 旧缓存是按精简字段写入的，没有 requires。强制刷新一次，避免把“没声明”和“缓存太旧”混在一起。
  if (Object.values(result.index).some((entry) => !Array.isArray(entry.requires))) {
    result = await resolveRegistryIndex({ force: true });
  }
  const needle = query.trim().toLowerCase();
  return {
    modules: Object.entries(result.index).filter(([id, metadata]) => {
      if (isRetiredPlatformModule(id)) return false;
      if (!needle) return true;
      return [id, metadata.name, metadata.description, metadata.npm].some((value) => value?.toLowerCase().includes(needle));
    }).map(([id, metadata]) => ({ id, ...metadata })),
    stale: result.stale,
  };
}

/**
 * 安装前核对索引里的 requires。
 * 使用场景：modules.install 在创建下载任务之前调用。索引没有这个 id 时返回 null，继续原来的安装路径。
 * 有条目但没有合法 requires，或依赖未安装、未启用时返回说明，调用方不得开始安装。
 */
export async function moduleInstallBlock(id: string): Promise<string | null> {
  let result = await resolveRegistryIndex();
  const cached = result.index[id];
  if (cached && !Array.isArray(cached.requires)) result = await resolveRegistryIndex({ force: true });
  const entry = result.index[id];
  if (!entry) return null;
  const installed = (await listModules()).modules;
  return moduleRequireBlockMessage(id, assessModuleRequires(entry.requires, installed));
}
export async function runFetch(args: string[]) {
  await runProcess(process.execPath, [fetchEntry(), ...args], ROOT);
  return { changed: true };
}
export function runProcess(command: string, args: string[], cwd: string, onLine?: (text: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, SFMC_ROOT: ROOT, FORCE_COLOR: "0" }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let diagnostic = "";
    for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk: Buffer) => { const text = chunk.toString(); diagnostic = (diagnostic + text).slice(-6000); onLine?.(text); });
    child.on("error", reject); child.on("close", code => code === 0 ? resolve() : reject(new Error(`子进程失败 (${code}): ${diagnostic}`)));
  });
}
export async function modulePlan(ids: string[] = []) {
  const url = pathToFileURL(path.join(path.dirname(fetchEntry()), "lib", "module-update.mjs")).href;
  const api = await import(url) as { planModuleUpdates: (options: { root: string; ids: string[] }) => Promise<unknown> };
  return api.planModuleUpdates({ root: ROOT, ids });
}
export async function applyModulePlan(ids: string[]) {
  const directory = path.dirname(fetchEntry());
  const api = await import(pathToFileURL(path.join(directory, "lib", "module-update.mjs")).href) as {
    planModuleUpdates: (options: { root: string; ids: string[] }) => Promise<{ upgrades: { id: string; spec: string }[]; failMode: "abort" | "continue" }>;
    applyModuleUpgrades: (upgrades: unknown[], deps: object) => Promise<{ failed: { id: string; message: string }[] }>;
    resyncInstalledCatalog: (id: string) => void;
  };
  const fetchApi = await import(pathToFileURL(fetchEntry()).href) as { installPreservingLock: (id: string, spec: string) => Promise<void> };
  const plan = await api.planModuleUpdates({ root: ROOT, ids });
  const result = await api.applyModuleUpgrades(plan.upgrades, { root: ROOT, failMode: plan.failMode, install: fetchApi.installPreservingLock, resync: api.resyncInstalledCatalog });
  if (result.failed.length) throw new Error(JSON.stringify(result.failed));
  return result;
}
/** pack_icon.png 上限。超过则不提供图标，避免把超大文件塞进管理帧。 */
const PACK_ICON_MAX_BYTES = 1_572_864;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * 世界包根目录里的 pack_icon.png 修订标记（size:mtime）。
 * 使用场景：packs.list 告诉桌面端要不要再拉图标，以及缓存是否失效。
 * 符号链接、空文件和超限文件一律视为没有图标。
 */
function packIconStamp(dir: string): string | null {
  const file = path.join(dir, "pack_icon.png");
  let stat: fs.Stats;
  try { stat = fs.lstatSync(file); } catch { return null; }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0 || stat.size > PACK_ICON_MAX_BYTES) return null;
  return `${stat.size}:${Math.trunc(stat.mtimeMs)}`;
}

export function listPacks() {
  const context = resolveBdsContext();
  return { packs: listInstalledWorldPacks(context.bdsRoot, context.levelName).map(pack => {
    const iconStamp = packIconStamp(pack.dir);
    return {
      id: pack.uuid,
      name: pack.name,
      kind: pack.kind,
      enabled: pack.enabled,
      version: pack.version.join("."),
      ...(iconStamp ? { iconStamp } : {}),
      ...(isProtectedSfmcPack(pack) ? { protected: true } : {}),
    };
  }) };
}

/**
 * 读取某个已安装世界包的 pack_icon.png。
 * 使用场景：桌面世界包列表按 iconStamp 按需拉取，不放进每 5 秒的 packs.list。
 * 找不到包、文件缺失或内容不是 PNG 时返回空图标，不抛错。
 */
export function readPackIcon(id: string): { id: string; mime: "image/png" | null; data: string | null } {
  const empty: { id: string; mime: null; data: null } = { id, mime: null, data: null };
  const context = resolveBdsContext();
  const pack = listInstalledWorldPacks(context.bdsRoot, context.levelName).find(row => row.uuid.toLowerCase() === id.toLowerCase());
  if (!pack || !packIconStamp(pack.dir)) return empty;
  const file = path.join(pack.dir, "pack_icon.png");
  let data: Buffer;
  try { data = fs.readFileSync(file); } catch { return empty; }
  if (data.length < PNG_MAGIC.length || !data.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC) || data.length > PACK_ICON_MAX_BYTES) return empty;
  return { id: pack.uuid, mime: "image/png", data: data.toString("base64") };
}

/**
 * 卸载一个世界包，并沿用 CLI 的配对资源包与回收站规则。
 * 使用场景：桌面 packs.uninstall。平台聚合包直接拒绝。
 */
export async function uninstallPack(id: string) {
  const context = resolveBdsContext();
  const packs = listInstalledWorldPacks(context.bdsRoot, context.levelName);
  const resolved = resolveUninstallTargets(packs, [id]);
  if (resolved.status === "not_found") throw new Error("找不到世界包");
  if (resolved.status === "protected") throw new Error("平台聚合包不可通过世界包卸载，请使用模块管理");
  const queue = buildPackUninstallQueue(resolved.selected, packs, false);
  const removed = await runPackUninstallQueue(queue, { bdsRoot: context.bdsRoot, levelName: context.levelName, purge: false });
  return { changed: true, restartRequired: true, removed };
}
/**
 * 解析桌面传入的资源包版本。
 * 使用场景：packs.version。只接受 major.minor.patch，每一段都是非负安全整数。
 */
export function parsePackVersion(value: unknown): [number, number, number] {
  if (typeof value !== "string") throw new Error("版本号必须为 major.minor.patch");
  const parts = value.split(".");
  if (parts.length !== 3) throw new Error("版本号必须为 major.minor.patch");
  const numbers = parts.map((part) => {
    if (!/^\d+$/.test(part)) throw new Error("版本号必须为非负整数");
    const number = Number(part);
    if (!Number.isSafeInteger(number)) throw new Error("版本号超出可精确表示的整数范围");
    return number;
  });
  const major = numbers[0];
  const minor = numbers[1];
  const patch = numbers[2];
  if (major === undefined || minor === undefined || patch === undefined) throw new Error("版本号必须为 major.minor.patch");
  return [major, minor, patch];
}

/**
 * 修改一个已安装资源包的清单版本，并在已启用时同步世界启用列表。
 * 使用场景：桌面 packs.version。行为包直接拒绝。
 * 模块条目写成与 header 相同的完整版本；命令行 packs bump 仍只抬修订号。
 */
export async function setPackVersion(id: string, versionText: unknown) {
  const version = parsePackVersion(versionText);
  const context = resolveBdsContext();
  const pack = listInstalledWorldPacks(context.bdsRoot, context.levelName).find(row => row.uuid === id);
  if (!pack) throw new Error("找不到世界包");
  if (pack.kind !== "resource") throw new Error("只能修改资源包的版本号");
  if (pack.version[0] === version[0] && pack.version[1] === version[1] && pack.version[2] === version[2]) {
    return { changed: false, restartRequired: false, version: pack.version.join(".") };
  }
  const next = writePackHeaderVersion(pack.dir, version, "full");
  if (pack.enabled) {
    await enableInstalledPack({ ...context, info: { uuid: pack.uuid, version: next, kind: "resource", name: pack.name } });
  }
  return { changed: true, restartRequired: true, version: next.join(".") };
}

export async function togglePack(id: string, enabled: boolean) {
  const context = resolveBdsContext();
  const pack = listInstalledWorldPacks(context.bdsRoot, context.levelName).find(row => row.uuid === id);
  if (!pack) throw new Error("找不到世界包");
  if (enabled) await enableInstalledPack({ ...context, info: { uuid: pack.uuid, version: pack.version, kind: pack.kind, name: pack.name } });
  else await disableInstalledPack({ ...context, kind: pack.kind, packUuid: pack.uuid, version: pack.version });
  return { changed: true, restartRequired: true };
}
export function playerFiles() {
  const bds = resolveBdsContext().bdsRoot;
  return { allowlist: path.join(bds, "allowlist.json"), permissions: path.join(bds, "permissions.json"), sfmcPermissions: path.join(ROOT, "configs", "permissions.json") };
}
export function savePlayerPermissions(kind: string, entries: unknown) {
  const files = playerFiles();
  if (!(kind in files) || !Array.isArray(entries)) throw new Error("非法玩家权限类型或内容");
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") throw new Error("权限条目必须为对象");
    const row = entry as Record<string, unknown>;
    if (kind === "allowlist" && (typeof row.name !== "string" || /[\r\n]/.test(row.name))) throw new Error("允许名单需提供合法玩家名称");
    if (kind === "permissions" && (typeof row.xuid !== "string" || !/^\d+$/.test(row.xuid) || !["visitor", "member", "operator"].includes(String(row.permission)))) throw new Error("BDS 权限需有效 XUID 和权限等级");
    if (kind === "sfmcPermissions" && (typeof row.player_name !== "string" || !row.player_name.trim() || /[\r\n\0]/.test(row.player_name) || !Number.isInteger(row.level) || Number(row.level) < 0 || Number(row.level) > 3)) throw new Error("SFMC 权限需合法玩家名及 0 到 3 的整数等级");
  }
  atomicJson(files[kind as keyof typeof files], entries);
  return { saved: true };
}
