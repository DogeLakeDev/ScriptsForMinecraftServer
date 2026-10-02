import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { resolveRegistryIndex } from "../registry.js";
import { ROOT, resolveFetchModule } from "../runtime.js";
import { resolveBdsContext, scanLocalModules } from "../pack-lifecycle.js";
import { listInstalledWorldPacks, resolvePackRoots, readPackManifestInfo, installPackDirectory, enableInstalledPack, disableInstalledPack, worldPackParentDir } from "@sfmc-bds/bds-tools/world-packs";
import { atomicJson } from "./tasks.js";
import { isRetiredPlatformModule } from "@sfmc-bds/sdk/contracts";

export function readJson<T>(file: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(file, "utf8")) as T; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback; throw error; }
}
export function identifier(value: unknown): string {
  if (typeof value !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(value) || value.includes("..")) throw new Error("非法标识符");
  return value;
}
export async function listModules() {
  const rows = (await scanLocalModules()).filter(row => !isRetiredPlatformModule(row.logicalId));
  return { modules: rows.map(row => ({ id: row.logicalId, folder: row.folderId, name: row.logicalId, version: row.version ?? "unknown", enabled: row.enabled, linked: fs.lstatSync(path.join(ROOT, "modules", "packages", row.folderId)).isSymbolicLink() })) };
}
function fetchEntry() { const entry = resolveFetchModule(); if (!entry) throw new Error("找不到模块安装器"); return entry; }
export async function searchModules(query: string) {
  const result = await resolveRegistryIndex();
  return { modules: Object.entries(result.index).filter(([id]) => !isRetiredPlatformModule(id) && id.includes(query)).map(([id, metadata]) => ({ id, ...metadata })), stale: result.stale };
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
export function listPacks() {
  const context = resolveBdsContext();
  return { packs: listInstalledWorldPacks(context.bdsRoot, context.levelName).map(pack => ({ id: pack.uuid, name: pack.name, kind: pack.kind, enabled: pack.enabled, version: pack.version.join(".") })) };
}
export async function togglePack(id: string, enabled: boolean) {
  const context = resolveBdsContext();
  const pack = listInstalledWorldPacks(context.bdsRoot, context.levelName).find(row => row.uuid === id);
  if (!pack) throw new Error("找不到世界包");
  if (enabled) await enableInstalledPack({ ...context, info: { uuid: pack.uuid, version: pack.version, kind: pack.kind, name: pack.name } });
  else await disableInstalledPack({ ...context, kind: pack.kind, packUuid: pack.uuid, version: pack.version });
  return { changed: true, restartRequired: true };
}
export async function importPack(filename: string) {
  const inbox = path.resolve(ROOT, "packs", "_desktop-inbox");
  const file = path.resolve(inbox, identifier(filename));
  if (!file.startsWith(inbox + path.sep) || !fs.existsSync(file)) throw new Error("世界包尚未上传到实例收件箱");
  const context = resolveBdsContext();
  const resolved = await resolvePackRoots(file);
  try {
    if (!resolved.roots.length) throw new Error("归档不含可识别的世界包");
    for (const root of resolved.roots) {
      const info = readPackManifestInfo(root);
      if (!info) throw new Error("世界包 manifest 无效");
      const result = await installPackDirectory({ srcDir: root, destParent: worldPackParentDir(context.bdsRoot, context.levelName, info.kind) });
      if (!result.ok) throw new Error(result.reason ?? "安装失败；可能与已有包冲突");
      await enableInstalledPack({ ...context, info });
    }
  } finally { resolved.dispose?.(); }
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
