/**
 * world-packs.ts — 通用世界 BP/RP 发现 / 安装 / bump（非 SFMC 模块聚合）
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { copyDirAsync } from "./fsx.js";
import {
  bdsWorldLevelDir,
  bdsWorldsDir,
  disablePackInWorld,
  enablePackInWorld,
  readPackManifestHeader,
  readWorldPackList,
  readWorldPackListResult,
  type WorldPackListReadResult,
} from "./pack-manager.js";
import { extractZipFileToDir } from "./zipx.js";

export type WorldPackKind = "behavior" | "resource";

export interface PackManifestInfo {
  name: string;
  uuid: string;
  version: [number, number, number];
  kind: WorldPackKind;
  description?: string;
}

export interface InstalledWorldPack {
  kind: WorldPackKind;
  folderName: string;
  dir: string;
  name: string;
  uuid: string;
  version: [number, number, number];
  enabled: boolean;
}

const ARCHIVE_EXTS = [".zip", ".mcpack", ".mcaddon"] as const;

/** 滤掉 §x（Minecraft 格式码）、残余压缩后缀，加 [BP]/[RP] 前缀 */
export function formatWorldPackFolderName(rawName: string, kind: WorldPackKind): string {
  let s = String(rawName ?? "");
  s = s.replace(/§[0-9a-zA-Z]/g, "");
  s = s.replace(/\.(zip|mcpack|mcaddon)$/i, "");
  s = s.replace(/\s+/g, " ").trim();
  if (!s) s = "pack";
  const prefix = kind === "resource" ? "[RP]" : "[BP]";
  if (s.startsWith("[RP]") || s.startsWith("[BP]")) return s;
  return `${prefix} ${s}`;
}

/** 根据 manifest modules[].type 判定 BP / RP */
export function detectPackKindFromManifest(raw: {
  modules?: Array<{ type?: string }>;
}): WorldPackKind | null {
  const types = (raw.modules ?? []).map((m) => String(m.type ?? "").toLowerCase());
  if (types.includes("resources")) return "resource";
  if (types.some((t) => t === "script" || t === "data" || t === "javascript")) return "behavior";
  return null;
}

export function readPackManifestInfo(packDir: string): PackManifestInfo | null {
  const file = path.join(packDir, "manifest.json");
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as {
      header?: { name?: string; uuid?: string; version?: number[]; description?: string };
      modules?: Array<{ type?: string }>;
    };
    const kind = detectPackKindFromManifest(raw);
    const uuid = raw.header?.uuid;
    const ver = raw.header?.version;
    const name = raw.header?.name;
    if (!kind || typeof uuid !== "string" || !Array.isArray(ver) || ver.length < 3) return null;
    if (typeof name !== "string" || !name) return null;
    const version: [number, number, number] = [Number(ver[0]), Number(ver[1]), Number(ver[2])];
    const description = raw.header?.description;
    return {
      name,
      uuid,
      version,
      kind,
      ...(typeof description === "string" ? { description } : {}),
    };
  } catch {
    return null;
  }
}

/** 深度优先找含 manifest.json 的包根（默认 maxDepth=2，root 自身为 depth 0） */
export function discoverPackRoots(root: string, opts?: { maxDepth?: number }): string[] {
  const maxDepth = opts?.maxDepth ?? 2;
  const out: string[] = [];
  const abs = path.resolve(root);
  if (!fs.existsSync(abs)) return out;

  function walk(dir: string, depth: number): void {
    const manifest = path.join(dir, "manifest.json");
    if (fs.existsSync(manifest) && fs.statSync(manifest).isFile()) {
      out.push(dir);
      return; // 包根不再下钻
    }
    if (depth >= maxDepth) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
      walk(path.join(dir, e.name), depth + 1);
    }
  }

  const st = fs.statSync(abs);
  if (st.isDirectory()) walk(abs, 0);
  return out;
}

export function isPackArchive(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return ARCHIVE_EXTS.some((ext) => lower.endsWith(ext));
}

/** 解压 zip/mcpack/mcaddon 到临时目录，返回该目录（经 zipx 防 zip-slip） */
export async function extractArchiveToTemp(filePath: string): Promise<string> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-pack-"));
  await extractZipFileToDir(filePath, tmp);
  return tmp;
}

function listPackDirsIn(parent: string): string[] {
  if (!fs.existsSync(parent)) return [];
  const out: string[] = [];
  for (const e of fs.readdirSync(parent, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const dir = path.join(parent, e.name);
    if (fs.existsSync(path.join(dir, "manifest.json"))) out.push(dir);
  }
  return out;
}

/** 扫描世界内已安装 BP/RP 目录 */
export function listInstalledWorldPacks(bdsRoot: string, levelName: string): InstalledWorldPack[] {
  const worldRoot = bdsWorldLevelDir(bdsRoot, levelName);
  const worldsDir = bdsWorldsDir(bdsRoot);
  const result: InstalledWorldPack[] = [];

  for (const kind of ["behavior", "resource"] as const) {
    const parent = path.join(
      worldRoot,
      kind === "behavior" ? "behavior_packs" : "resource_packs"
    );
    const enabledList = readWorldPackList(worldsDir, levelName, kind);
    const enabledMap = new Map(enabledList.map((e) => [e.pack_id, e.version] as const));

    for (const dir of listPackDirsIn(parent)) {
      const info = readPackManifestInfo(dir);
      if (!info || info.kind !== kind) {
        // 仍尝试用 header 展示（enabled 与正常路径同契约：enable-list 含 uuid → LSP）
        const header = readPackManifestHeader(dir);
        if (!header) continue;
        result.push({
          kind,
          folderName: path.basename(dir),
          dir,
          name: path.basename(dir),
          uuid: header.uuid,
          version: header.version,
          enabled: enabledMap.has(header.uuid),
        });
        continue;
      }
      result.push({
        kind: info.kind,
        folderName: path.basename(dir),
        dir,
        name: info.name,
        uuid: info.uuid,
        version: info.version,
        enabled: enabledMap.has(info.uuid),
      });
    }
  }
  return result;
}

/** RP/BP 第三位版本 +1，写回 manifest */
export function bumpPackPatchVersion(packDir: string): [number, number, number] {
  const file = path.join(packDir, "manifest.json");
  if (!fs.existsSync(file)) throw new Error(`manifest.json missing: ${packDir}`);
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as {
    header?: { version?: number[] };
    modules?: Array<{ version?: number[] }>;
  };
  const ver = raw.header?.version;
  if (!Array.isArray(ver) || ver.length < 3) throw new Error(`invalid header.version in ${file}`);
  const next: [number, number, number] = [Number(ver[0]), Number(ver[1]), Number(ver[2]) + 1];
  return writePackHeaderVersion(packDir, next);
}

/** 写入 header.version（并同步 modules[].version 的 patch） */
export function writePackHeaderVersion(
  packDir: string,
  next: [number, number, number]
): [number, number, number] {
  const file = path.join(packDir, "manifest.json");
  if (!fs.existsSync(file)) throw new Error(`manifest.json missing: ${packDir}`);
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as {
    header?: { version?: number[] };
    modules?: Array<{ version?: number[] }>;
  };
  if (!raw.header) raw.header = {};
  raw.header.version = next;
  if (Array.isArray(raw.modules)) {
    for (const m of raw.modules) {
      if (Array.isArray(m.version) && m.version.length >= 3) {
        m.version = [Number(m.version[0]), Number(m.version[1]), next[2]];
      }
    }
  }
  fs.writeFileSync(file, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
  return next;
}

/** 读取 BP manifest 中依赖的资源包 uuid（非 @minecraft 模块） */
export function readPackDependencyUuids(packDir: string): string[] {
  const file = path.join(packDir, "manifest.json");
  if (!fs.existsSync(file)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as {
      dependencies?: Array<{ uuid?: string; module_name?: string }>;
    };
    return (raw.dependencies ?? [])
      .map((d) => d.uuid)
      .filter((u): u is string => typeof u === "string" && u.length > 0);
  } catch {
    return [];
  }
}

/** 确保版本严格大于 floor（patch/minor 抬一级） */
export function ensureVersionGreaterThan(
  packDir: string,
  floor: [number, number, number],
  component: "patch" | "minor" = "patch"
): [number, number, number] {
  const info = readPackManifestInfo(packDir);
  if (!info) throw new Error(`cannot read pack version: ${packDir}`);
  let next: [number, number, number] =
    component === "minor"
      ? [info.version[0], info.version[1] + 1, 0]
      : [info.version[0], info.version[1], info.version[2] + 1];
  const cmp = (a: [number, number, number], b: [number, number, number]) => {
    for (let i = 0; i < 3; i++) {
      const d = a[i]! - b[i]!;
      if (d !== 0) return d;
    }
    return 0;
  };
  while (cmp(next, floor) <= 0) {
    if (component === "minor") next = [next[0], next[1] + 1, 0];
    else next = [next[0], next[1], next[2] + 1];
  }
  return writePackHeaderVersion(packDir, next);
}

export interface InstallPackResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  destDir?: string;
  folderName?: string;
  info?: PackManifestInfo;
  conflict?: { existing: PackManifestInfo & { dir: string }; incoming: PackManifestInfo };
}

/**
 * 将包目录安装到 destParent（behavior_packs 或 resource_packs）。
 * force=true 时覆盖冲突；否则返回 conflict 供上层询问。
 */
export async function installPackDirectory(opts: {
  srcDir: string;
  destParent: string;
  folderName?: string;
  force?: boolean;
}): Promise<InstallPackResult> {
  const info = readPackManifestInfo(opts.srcDir);
  if (!info) {
    return { ok: false, reason: "invalid or unrecognized manifest.json" };
  }

  const folderName = formatWorldPackFolderName(
    opts.folderName ?? path.basename(opts.srcDir),
    info.kind
  );
  await fs.promises.mkdir(opts.destParent, { recursive: true });

  // 冲突：同 uuid，或同 folderName（即使旧包 manifest 无法完整识别也要拦 — 禁止静默覆盖）
  let conflictDir: string | null = null;
  let conflictExisting: PackManifestInfo | null = null;
  for (const dir of listPackDirsIn(opts.destParent)) {
    const existing = readPackManifestInfo(dir);
    const sameFolder = path.basename(dir) === folderName;
    const sameUuid = !!existing && existing.uuid === info.uuid;
    if (!sameFolder && !sameUuid) continue;
    conflictDir = dir;
    if (existing) {
      conflictExisting = existing;
    } else {
      const header = readPackManifestHeader(dir);
      conflictExisting = {
        name: path.basename(dir),
        uuid: header?.uuid ?? "(unknown)",
        version: header?.version ?? [0, 0, 0],
        kind: info.kind,
      };
    }
    break;
  }

  if (conflictDir && !opts.force) {
    return {
      ok: false,
      skipped: true,
      reason: "conflict",
      conflict: {
        existing: { ...(conflictExisting ?? info), dir: conflictDir },
        incoming: info,
      },
    };
  }

  const destDir = path.join(opts.destParent, folderName);
  if (conflictDir && path.resolve(conflictDir) !== path.resolve(destDir)) {
    await fs.promises.rm(conflictDir, { recursive: true, force: true });
  }
  if (fs.existsSync(destDir)) {
    await fs.promises.rm(destDir, { recursive: true, force: true });
  }
  await copyDirAsync(opts.srcDir, destDir);
  return { ok: true, destDir, folderName, info };
}

/** 安装后写入世界 enable 清单 */
export async function enableInstalledPack(opts: {
  bdsRoot: string;
  levelName: string;
  info: PackManifestInfo;
}): Promise<void> {
  await enablePackInWorld({
    worldsDir: bdsWorldsDir(opts.bdsRoot),
    levelName: opts.levelName,
    kind: opts.info.kind,
    packUuid: opts.info.uuid,
    version: opts.info.version,
  });
}

/** 从世界 enable 清单移除 */
export async function disableInstalledPack(opts: {
  bdsRoot: string;
  levelName: string;
  kind: WorldPackKind;
  packUuid: string;
  version: [number, number, number];
}): Promise<void> {
  await disablePackInWorld({
    worldsDir: bdsWorldsDir(opts.bdsRoot),
    levelName: opts.levelName,
    kind: opts.kind,
    packUuid: opts.packUuid,
    version: opts.version,
  });
}

export type UninstallPackAction = "trashed" | "deleted" | "missing";

/**
 * 卸载已安装世界包：先 disable enable-list，再移入 trashDir 或直接删除目录。
 * trashDir 跨盘符时 fallback 为 copy + rm。
 */
export async function uninstallInstalledPack(opts: {
  bdsRoot: string;
  levelName: string;
  pack: InstalledWorldPack;
  /** 提供则移入该目录；null/省略则直接删除 */
  trashDir?: string | null;
}): Promise<{ ok: boolean; action: UninstallPackAction; dest?: string; reason?: string }> {
  await disableInstalledPack({
    bdsRoot: opts.bdsRoot,
    levelName: opts.levelName,
    kind: opts.pack.kind,
    packUuid: opts.pack.uuid,
    version: opts.pack.version,
  });

  if (!fs.existsSync(opts.pack.dir)) {
    return { ok: true, action: "missing" };
  }

  const trashDir = opts.trashDir?.trim() || null;
  if (trashDir) {
    await fs.promises.mkdir(trashDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    let dest = path.join(trashDir, opts.pack.folderName);
    if (fs.existsSync(dest)) {
      dest = path.join(trashDir, `${opts.pack.folderName}-${stamp}`);
    }
    try {
      await fs.promises.rename(opts.pack.dir, dest);
    } catch {
      await copyDirAsync(opts.pack.dir, dest);
      await fs.promises.rm(opts.pack.dir, { recursive: true, force: true });
    }
    return { ok: true, action: "trashed", dest };
  }

  await fs.promises.rm(opts.pack.dir, { recursive: true, force: true });
  return { ok: true, action: "deleted" };
}

export function worldPackParentDir(
  bdsRoot: string,
  levelName: string,
  kind: WorldPackKind
): string {
  return path.join(
    bdsWorldLevelDir(bdsRoot, levelName),
    kind === "behavior" ? "behavior_packs" : "resource_packs"
  );
}

/** 世界 enable-list 权威读取 — 委托 pack-manager（供 doctor 等，避免硬编码文件名） */
export function listWorldEnableEntries(
  bdsRoot: string,
  levelName: string,
  kind: WorldPackKind
): Array<{ pack_id: string; version: [number, number, number] }> {
  return listWorldEnableListResult(bdsRoot, levelName, kind).entries;
}

/** 含 parseFail 信号的 enable-list 快照（doctor 用；不暴露 JSON 路径构造细节） */
export function listWorldEnableListResult(
  bdsRoot: string,
  levelName: string,
  kind: WorldPackKind
): WorldPackListReadResult {
  return readWorldPackListResult(bdsWorldsDir(bdsRoot), levelName, kind);
}

export function findInstalledPackById(
  packs: InstalledWorldPack[],
  id: string
): InstalledWorldPack | null {
  const q = id.trim().toLowerCase();
  return (
    packs.find(
      (p) =>
        p.uuid.toLowerCase() === q ||
        p.folderName.toLowerCase() === q ||
        p.name.toLowerCase() === q ||
        p.folderName.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q)
    ) ?? null
  );
}
