/**
 * world-packs.ts — 通用世界 BP/RP 发现 / 安装 / bump（非 SFMC 模块聚合）
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { copyDirAsync, readJsonFile, Utf8BomError } from "./fsx.js";
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

/** 去掉已有 [BP]/[RP] 前缀，得到文件夹名主干 */
export function stripWorldPackFolderPrefix(rawName: string): string {
  return String(rawName ?? "")
    .replace(/^\[BP\]\s*/i, "")
    .replace(/^\[RP\]\s*/i, "")
    .replace(/\.(zip|mcpack|mcaddon)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 归档内常见占位目录名（B / R / BP / RP）过短或过泛，不能作为世界目录名，
 * 否则不同包会撞到同一路径并被误判为「覆盖」。
 */
export function isGenericPackFolderStem(rawName: string): boolean {
  const s = stripWorldPackFolderPrefix(rawName);
  if (!s) return true;
  if (s.length <= 2) return true;
  return /^(bp|rp|b|r|pack|packs|behavior|behaviours?|resource|resources)$/i.test(s);
}

/**
 * 选定安装文件夹名：hint 过泛时改用 manifest.name；再与已占用名避让（不同 uuid 不互相覆盖）。
 * 纯函数：只依赖 taken 集合，便于表驱动单测（DRY：decide / choose 共用）。
 */
export function allocatePackFolderName(opts: {
  hint?: string;
  info: PackManifestInfo;
  takenFolderNames: Iterable<string>;
  /** 同 uuid 更新时允许占用的已有目录名（不触发避让） */
  allowFolderName?: string;
}): string {
  const hint = (opts.hint && opts.hint.trim()) || "";
  const preferred = isGenericPackFolderStem(hint) ? opts.info.name || hint || "pack" : hint;
  let folderName = formatWorldPackFolderName(preferred, opts.info.kind);
  const allow = opts.allowFolderName ? path.basename(opts.allowFolderName) : null;
  if (allow && folderName === allow) return folderName;

  const taken = new Set([...opts.takenFolderNames].filter((n) => n !== allow));
  if (!taken.has(folderName)) return folderName;

  /* 同名不同包：manifest 名 + uuid 前缀；仍撞则递增 */
  const withUuid = formatWorldPackFolderName(
    `${stripWorldPackFolderPrefix(preferred)} ${opts.info.uuid.slice(0, 8)}`,
    opts.info.kind
  );
  if (!taken.has(withUuid)) return withUuid;
  let i = 2;
  while (taken.has(`${withUuid}_${i}`)) i++;
  return `${withUuid}_${i}`;
}

/**
 * 选定安装文件夹名（读 destParent 占用）。
 * 决策权威见 allocatePackFolderName / decidePackInstallPlan。
 */
export function choosePackInstallFolderName(opts: {
  hint?: string;
  info: PackManifestInfo;
  destParent: string;
  allowFolderName?: string;
}): string {
  const taken = listPackDirsIn(opts.destParent).map((d) => path.basename(d));
  return allocatePackFolderName({
    info: opts.info,
    takenFolderNames: taken,
    ...(opts.hint !== undefined ? { hint: opts.hint } : {}),
    ...(opts.allowFolderName !== undefined ? { allowFolderName: opts.allowFolderName } : {}),
  });
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
    const raw = readJsonFile<{
      header?: { name?: string; uuid?: string; version?: number[]; description?: string };
      modules?: Array<{ type?: string }>;
    }>(file);
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
  } catch (e) {
    /* BOM 必须上抛，由安装层打明确错误；其它解析失败仍返回 null */
    if (e instanceof Utf8BomError) throw e;
    return null;
  }
}

export { Utf8BomError };

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

/** 去掉 .zip/.mcpack/.mcaddon 后缀得到 stem */
function archiveStem(filePath: string): string {
  const base = path.basename(filePath);
  const lower = base.toLowerCase();
  for (const ext of ARCHIVE_EXTS) {
    if (lower.endsWith(ext)) return base.slice(0, -ext.length);
  }
  return path.parse(base).name;
}

/** 归档解压目标：同级 stem 目录；重名则加 _2/_3… */
function uniqueSiblingExtractDir(archivePath: string): string {
  const parent = path.dirname(archivePath);
  let dest = path.join(parent, archiveStem(archivePath) || "pack");
  if (!fs.existsSync(dest)) return dest;
  let i = 2;
  while (fs.existsSync(`${dest}_${i}`)) i++;
  return `${dest}_${i}`;
}

/**
 * 列出目录树内的包归档文件。
 * 已是包根（含 manifest.json）的目录不再下钻，避免误解压包内资源。
 */
export function listPackArchiveFiles(root: string, opts?: { maxDepth?: number }): string[] {
  const maxDepth = opts?.maxDepth ?? 4;
  const out: string[] = [];
  const abs = path.resolve(root);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) return out;

  function walk(dir: string, depth: number): void {
    if (fs.existsSync(path.join(dir, "manifest.json"))) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
      const full = path.join(dir, e.name);
      if (e.isFile() && isPackArchive(full)) {
        out.push(full);
        continue;
      }
      if (e.isDirectory() && depth < maxDepth) walk(full, depth + 1);
    }
  }

  walk(abs, 0);
  return out;
}

/**
 * 在临时树内原地展开嵌套归档：解压到同级目录并删除归档文件，多轮直至没有新归档。
 * 仅应对我们自己的 staging，禁止用于用户 inbox 原目录。
 */
export async function expandNestedArchivesInPlace(
  workDir: string,
  opts?: { maxRounds?: number; maxScanDepth?: number }
): Promise<number> {
  const maxRounds = opts?.maxRounds ?? 3;
  const maxScanDepth = opts?.maxScanDepth ?? 4;
  let expanded = 0;
  for (let round = 0; round < maxRounds; round++) {
    const archives = listPackArchiveFiles(workDir, { maxDepth: maxScanDepth });
    if (archives.length === 0) break;
    for (const arch of archives) {
      const dest = uniqueSiblingExtractDir(arch);
      await fs.promises.mkdir(dest, { recursive: true });
      await extractZipFileToDir(arch, dest);
      await fs.promises.unlink(arch);
      expanded++;
    }
  }
  return expanded;
}

export type ResolvePackRootsResult = {
  roots: string[];
  /** 清理本轮创建的全部临时目录（可安全多次调用） */
  dispose: () => void;
};

/**
 * 统一包根解析：目录 / 顶层归档 / 嵌套 .mcpack|.zip|.mcaddon。
 * 规则：先展开归档为目录树，再只认含 manifest.json 的目录为包根。
 * 用户目录内的嵌套归档解到独立 temp，不修改原目录。
 */
export async function resolvePackRoots(
  src: string,
  opts?: { maxDirDepth?: number; maxArchiveRounds?: number }
): Promise<ResolvePackRootsResult> {
  const maxDirDepth = opts?.maxDirDepth ?? 4;
  const maxArchiveRounds = opts?.maxArchiveRounds ?? 3;
  const temps: string[] = [];
  const dispose = (): void => {
    for (const d of temps.splice(0, temps.length)) {
      try {
        fs.rmSync(d, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  };

  const abs = path.resolve(src);
  if (!fs.existsSync(abs)) return { roots: [], dispose };

  try {
    const st = fs.statSync(abs);
    if (st.isFile()) {
      if (!isPackArchive(abs)) return { roots: [], dispose };
      const tmp = await extractArchiveToTemp(abs);
      temps.push(tmp);
      await expandNestedArchivesInPlace(tmp, {
        maxRounds: maxArchiveRounds,
        maxScanDepth: maxDirDepth,
      });
      return { roots: discoverPackRoots(tmp, { maxDepth: maxDirDepth }), dispose };
    }

    if (!st.isDirectory()) return { roots: [], dispose };

    const nestedArchives = listPackArchiveFiles(abs, { maxDepth: maxDirDepth });
    if (nestedArchives.length === 0) {
      return { roots: discoverPackRoots(abs, { maxDepth: maxDirDepth }), dispose };
    }

    /* 目录包根 + 各嵌套归档各自解到 temp（不改用户目录） */
    const roots = discoverPackRoots(abs, { maxDepth: maxDirDepth });
    const seen = new Set(roots.map((r) => path.resolve(r)));
    for (const arch of nestedArchives) {
      const tmp = await extractArchiveToTemp(arch);
      temps.push(tmp);
      await expandNestedArchivesInPlace(tmp, {
        maxRounds: maxArchiveRounds,
        maxScanDepth: maxDirDepth,
      });
      for (const r of discoverPackRoots(tmp, { maxDepth: maxDirDepth })) {
        const key = path.resolve(r);
        if (seen.has(key)) continue;
        seen.add(key);
        roots.push(r);
      }
    }
    return { roots, dispose };
  } catch (e) {
    dispose();
    throw e;
  }
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
      let info: PackManifestInfo | null = null;
      try {
        info = readPackManifestInfo(dir);
      } catch (e) {
        /* 已装目录若含 BOM：跳过该项，避免 list 整表炸掉；安装路径会单独报错 */
        if (e instanceof Utf8BomError) continue;
        throw e;
      }
      if (!info || info.kind !== kind) {
        // 仍尝试用 header 展示（enabled 与正常路径同契约：enable-list 含 uuid → LSP）
        let header;
        try {
          header = readPackManifestHeader(dir);
        } catch (e) {
          if (e instanceof Utf8BomError) continue;
          throw e;
        }
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
  const raw = readJsonFile<{
    header?: { version?: number[] };
    modules?: Array<{ version?: number[] }>;
  }>(file);
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
  const raw = readJsonFile<{
    header?: { version?: number[] };
    modules?: Array<{ version?: number[] }>;
  }>(file);
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
    const raw = readJsonFile<{
      dependencies?: Array<{ uuid?: string; module_name?: string }>;
    }>(file);
    return (raw.dependencies ?? [])
      .map((d) => d.uuid)
      .filter((u): u is string => typeof u === "string" && u.length > 0);
  } catch (e) {
    if (e instanceof Utf8BomError) throw e;
    return [];
  }
}

/** 比较 SemVer 三元组；a>b 正，a<b 负，相等 0 */
export function compareSemVer3(
  a: [number, number, number],
  b: [number, number, number]
): number {
  for (let i = 0; i < 3; i++) {
    const d = a[i]! - b[i]!;
    if (d !== 0) return d;
  }
  return 0;
}

/** 取较大的 SemVer 三元组 */
export function maxSemVer3(
  a: [number, number, number],
  b: [number, number, number]
): [number, number, number] {
  return compareSemVer3(a, b) >= 0 ? a : b;
}

/** 按 component 抬一级 */
export function bumpSemVer3(
  v: [number, number, number],
  component: "patch" | "minor"
): [number, number, number] {
  return component === "minor" ? [v[0], v[1] + 1, 0] : [v[0], v[1], v[2] + 1];
}

/**
 * 进服启用版本：max(远程/新包, 旧启用) 再抬一级。
 * 单一规则，禁止 while 追赶（作者乱写高版本如 [1,21,100] 时也能一次算完）。
 */
export function nextEnabledVersion(
  remote: [number, number, number],
  previous: [number, number, number],
  component: "patch" | "minor" = "patch"
): [number, number, number] {
  return bumpSemVer3(maxSemVer3(remote, previous), component);
}

/**
 * 将包目录 manifest 抬到 nextEnabledVersion(当前, previous)。
 * previous 一般为更新前已安装 RP / 世界 enable 列表中的版本。
 */
export function ensureVersionGreaterThan(
  packDir: string,
  previous: [number, number, number],
  component: "patch" | "minor" = "patch"
): [number, number, number] {
  const info = readPackManifestInfo(packDir);
  if (!info) throw new Error(`cannot read pack version: ${packDir}`);
  const next = nextEnabledVersion(info.version, previous, component);
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

/** 目标父目录内已占用项（供纯决策，不含 FS 副作用） */
export type DestOccupancy = {
  folderName: string;
  dir: string;
  uuid: string | null;
  version: [number, number, number] | null;
  /** 可读时的展示名；决策不依赖，仅供 conflict UI */
  name?: string;
  /** 可读时的包类型；决策展示优先用真实 kind，避免伪造 incoming.kind（LSP） */
  kind?: WorldPackKind;
};

export type PackInstallPlan =
  | { kind: "fresh"; folderName: string; incoming: PackManifestInfo }
  | {
      kind: "overwriteInPlace";
      folderName: string;
      dir: string;
      incoming: PackManifestInfo;
      existing: PackManifestInfo & { dir: string };
    }
  | {
      kind: "needConfirm";
      folderName: string;
      dir: string;
      incoming: PackManifestInfo;
      existing: PackManifestInfo & { dir: string };
    };

/**
 * 读单目录占用事实（info 优先，否则 header）。
 * Utf8BomError 上抛，由调用方决定跳过或仍占文件夹名。
 */
export function readPackDirOccupancy(dir: string): {
  uuid: string;
  version: [number, number, number];
  name?: string;
  kind?: WorldPackKind;
} | null {
  const info = readPackManifestInfo(dir);
  if (info) {
    return {
      uuid: info.uuid,
      version: info.version,
      name: info.name,
      kind: info.kind,
    };
  }
  const header = readPackManifestHeader(dir);
  if (header) {
    return { uuid: header.uuid, version: header.version };
  }
  return null;
}

/** 扫描 destParent 下含 manifest 的目录占用 */
export function scanDestOccupancy(destParent: string): DestOccupancy[] {
  const out: DestOccupancy[] = [];
  for (const dir of listPackDirsIn(destParent)) {
    let facts: ReturnType<typeof readPackDirOccupancy> = null;
    try {
      facts = readPackDirOccupancy(dir);
    } catch (e) {
      /* BOM：仍占文件夹名，uuid 未知 → 不会误匹配同 uuid 覆盖 */
      if (!(e instanceof Utf8BomError)) throw e;
    }
    out.push({
      folderName: path.basename(dir),
      dir,
      uuid: facts?.uuid ?? null,
      version: facts?.version ?? null,
      ...(facts?.name ? { name: facts.name } : {}),
      ...(facts?.kind ? { kind: facts.kind } : {}),
    });
  }
  return out;
}

/**
 * 纯决策：装到哪、是否需确认、是否原地覆盖。
 * 同 uuid：incoming 版本严格更大 → 静默覆盖；≤ 已有且 !force → needConfirm；force → 原地覆盖。
 */
export function decidePackInstallPlan(opts: {
  incoming: PackManifestInfo;
  hint?: string;
  occupancy: readonly DestOccupancy[];
  force?: boolean;
}): PackInstallPlan {
  const force = Boolean(opts.force);
  const incomingUuid = opts.incoming.uuid.toLowerCase();
  const same = opts.occupancy.find((o) => o.uuid != null && o.uuid.toLowerCase() === incomingUuid);

  if (same) {
    const existingVersion: [number, number, number] = same.version ?? [0, 0, 0];
    const existing: PackManifestInfo & { dir: string } = {
      name: same.name ?? same.folderName,
      uuid: same.uuid!,
      version: existingVersion,
      kind: same.kind ?? opts.incoming.kind,
      dir: same.dir,
    };

    const newer = compareSemVer3(opts.incoming.version, existing.version) > 0;
    if (force || newer) {
      return {
        kind: "overwriteInPlace",
        folderName: same.folderName,
        dir: same.dir,
        incoming: opts.incoming,
        existing,
      };
    }
    return {
      kind: "needConfirm",
      folderName: same.folderName,
      dir: same.dir,
      incoming: opts.incoming,
      existing,
    };
  }

  const folderName = allocatePackFolderName({
    info: opts.incoming,
    takenFolderNames: opts.occupancy.map((o) => o.folderName),
    ...(opts.hint !== undefined ? { hint: opts.hint } : {}),
  });
  return { kind: "fresh", folderName, incoming: opts.incoming };
}

/** 落盘后校验：防止旁路安装 / 拷贝失败仍报成功 */
export function verifyInstalledPack(
  destDir: string,
  incoming: PackManifestInfo
): { ok: true; info: PackManifestInfo } | { ok: false; reason: string } {
  let info: PackManifestInfo | null;
  try {
    info = readPackManifestInfo(destDir);
  } catch (e) {
    if (e instanceof Utf8BomError) {
      return { ok: false, reason: `verify: ${e.message}` };
    }
    throw e;
  }
  if (!info) return { ok: false, reason: "verify: dest has no readable manifest" };
  if (info.uuid.toLowerCase() !== incoming.uuid.toLowerCase()) {
    return { ok: false, reason: `verify: uuid mismatch got=${info.uuid} want=${incoming.uuid}` };
  }
  if (info.kind !== incoming.kind) {
    return { ok: false, reason: `verify: kind mismatch got=${info.kind} want=${incoming.kind}` };
  }
  if (compareSemVer3(info.version, incoming.version) !== 0) {
    return {
      ok: false,
      reason: `verify: version mismatch got=${info.version.join(".")} want=${incoming.version.join(".")}`,
    };
  }
  return { ok: true, info };
}

/**
 * 将包目录安装到 destParent（behavior_packs 或 resource_packs）。
 * 编排：scan → decide → apply → verify。同 uuid 版本更高时静默原地覆盖。
 */
export async function installPackDirectory(opts: {
  srcDir: string;
  destParent: string;
  folderName?: string;
  force?: boolean;
}): Promise<InstallPackResult> {
  let info: PackManifestInfo | null;
  try {
    info = readPackManifestInfo(opts.srcDir);
  } catch (e) {
    if (e instanceof Utf8BomError) {
      return { ok: false, reason: e.message };
    }
    throw e;
  }
  if (!info) {
    return { ok: false, reason: "invalid or unrecognized manifest.json" };
  }

  await fs.promises.mkdir(opts.destParent, { recursive: true });

  const occupancy = scanDestOccupancy(opts.destParent);
  const plan = decidePackInstallPlan({
    incoming: info,
    hint: opts.folderName ?? path.basename(opts.srcDir),
    occupancy,
    ...(opts.force !== undefined ? { force: opts.force } : {}),
  });

  if (plan.kind === "needConfirm") {
    return {
      ok: false,
      skipped: true,
      reason: "conflict",
      conflict: {
        existing: plan.existing,
        incoming: info,
      },
    };
  }

  const destDir = path.join(opts.destParent, plan.folderName);
  if (plan.kind === "overwriteInPlace" && path.resolve(plan.dir) !== path.resolve(destDir)) {
    return {
      ok: false,
      reason: `invariant: overwrite path drift plan.dir=${plan.dir} destDir=${destDir}`,
    };
  }

  if (fs.existsSync(destDir)) {
    await fs.promises.rm(destDir, { recursive: true, force: true });
  }
  await copyDirAsync(opts.srcDir, destDir);

  const verified = verifyInstalledPack(destDir, info);
  if (!verified.ok) {
    return { ok: false, reason: verified.reason, folderName: plan.folderName, info };
  }
  return { ok: true, destDir, folderName: plan.folderName, info: verified.info };
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

export type UninstallPackResult =
  | { action: "trashed"; dest: string }
  | { action: "deleted" }
  | { action: "missing" };

export type UninstallPackAction = UninstallPackResult["action"];

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
}): Promise<UninstallPackResult> {
  await disableInstalledPack({
    bdsRoot: opts.bdsRoot,
    levelName: opts.levelName,
    kind: opts.pack.kind,
    packUuid: opts.pack.uuid,
    version: opts.pack.version,
  });

  if (!fs.existsSync(opts.pack.dir)) {
    return { action: "missing" };
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
    return { action: "trashed", dest };
  }

  await fs.promises.rm(opts.pack.dir, { recursive: true, force: true });
  return { action: "deleted" };
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
