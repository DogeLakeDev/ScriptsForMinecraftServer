/**
 * pack-manager.ts — Bedrock 行为包/资源包 装配 + 部署到 BDS 根。
 *
 * 这是 SEA 与 npm 两条用户路径共用的纯函数库:
 *
 *   - SEA:用户在 REPL/wizard 里跑 `sfmc behavior-pack build/deploy`
 *          → sfmc 通过 spawnService 启 `bds-tools/dist/pack-manager.js`,
 *            SEA 自己跑 esbuild 把脚本 bundle 写到 <modulesDir>/build/sfmc-modules-bp/scripts/main.js,
 *            然后调 pack-manager#assembleBehaviorPack 装配。
 *   - npm: 用户跑 `sfmc behavior-pack build`,
 *          同一 spawnService 路径。或者直接在同进程 import 这个库。
 *
 * 关键约束:本文件不允许引 esbuild / 任何 npm-only 包 — SEA 要把它打成 SEA
 * 的一部分内嵌起来,而 SEA 是个单 exe (除 Node 内置 + bds-tools 已有依赖外)。
 *
 * 已有依赖 (bds-tools/package.json):
 *   - cli-progress: 进度条
 *   - node-html-parser: changelog 抓取 (本文件用不到)
 *   - jszip: zip 解压(模块 zip / BDS server.zip),与 sfmc/wizard 共享同一个库
 *
 * 没有外部依赖意味着:SEA 静态把 `bds-tools/dist/*` 解压到 exe 旁边即可,
 *不需把 npm 整棵树带进去。
 */

import fs from "node:fs";
import path from "node:path";
import { copyDirAsync, copyFileAsync } from "./fsx.js";

/* ── 类型 ─────────────────────────────────────────────────────────────── */

export interface AssembleBehaviorPackOpts {
  /** Where the bundled scripts/main.js already exists (esbuild output dir) */
  srcDir: string;
  /** Output behavior pack directory (created if missing) */
  outDir: string;
  /** BP 目录名 — SEA 固定 'sfmc-modules', npm 自定义 BP 可改名 */
  projectName: string;
  /** manifest.json 的 header.version [major, minor, patch]; 默认 [1, 0, 0] */
  version?: [number, number, number] | undefined;
  /** manifest.json 的 description */
  description?: string | undefined;
  /** pack_icon.png 源文件 (optional, 不提供则跳过) */
  iconSrc?: string | undefined;
  /** 稳定 header.uuid;省略则随机生成(首次装配) */
  uuid?: string | undefined;
  /** 稳定 script module uuid;省略则随机 */
  moduleUuid?: string | undefined;
}

export interface AssembleResourcePackOpts {
  /** Modules whose resource_pack/** should be merged. Map<moduleId, resourcePackDir>. */
  moduleResourceDirs: Record<string, string>;
  /** Output resource pack directory (created if missing) */
  outDir: string;
  /** RP 目录名 */
  projectName: string;
  /** manifest.json 的 header.version [major, minor, patch]; 默认 [1, 0, 0] */
  version?: [number, number, number] | undefined;
  /** manifest.json 的 description */
  description?: string | undefined;
  /** 稳定 header.uuid;省略则随机生成(首次装配) */
  uuid?: string | undefined;
  /** 稳定 resources module uuid;省略则随机 */
  moduleUuid?: string | undefined;
}

export interface AssembleResult {
  uuid: string;
  version: [number, number, number];
}

export interface DeployOpts {
  bdsRoot: string;
  levelName: string;
  /** 已组装好的 BP 源目录 */
  behaviorPackSrc: string;
  /** 已组装好的 RP 源目录 (可省略,只用 BP 也合法) */
  resourcePackSrc?: string;
  /** BP 目标目录名 (worlds/<level>/behavior_packs/<bpName>) */
  bpName: string;
  /** RP 目标目录名 (worlds/<level>/resource_packs/<rpName>);省略时复用 bpName + '-rp' */
  rpName?: string;
  /**
   * 无 resourcePackSrc 时是否删除世界内已有 RP 目录。
   * 用于模块不再提供 RP 时清理聚合包残留(默认 false,避免误删未声明的 RP)。
   */
  clearResourcePack?: boolean;
}

export interface DeployResult {
  bpDir: string;
  rpDir: string | null;
}

export interface EnablePackOpts {
  worldsDir: string;
  levelName: string;
  kind: "behavior" | "resource";
  packUuid: string;
  version: [number, number, number];
}

/* ── 路径常量 ─────────────────────────────────────────────────────────── */

/** SFMC 合成 BP 的固定 @minecraft/* permissions,所有用到的命名空间都打开。 */
export const SFMC_PERMISSIONS = [
  "@minecraft/server",
  "@minecraft/server-ui",
  "@minecraft/server-admin",
  "@minecraft/server-gametest",
  "@minecraft/server-net",
  "@minecraft/server-editor",
  "@minecraft/diagnostics",
] as const;

/** 随机生成 BP/RP manifest.json header.uuid (RFC 4122 v4) */
export function randomUuid(): string {
  /* crypto.randomUUID 是 Node 19+ 内置,SEA 走 Node 22+,这里直接用 */
  return crypto.randomUUID();
}

/* ── 骨架函数 (Commit 5 实现) ──────────────────────────────────────────── */

/**
 * Assemble a Bedrock behavior pack directory at `outDir` from a prebuilt
 * `srcDir` (which must already contain `scripts/main.js` plus whatever else
 * was bundled by esbuild) and write a fresh `manifest.json` + `permissions.json`.
 *
 * The caller is responsible for running esbuild first; pack-manager does not
 * bundle scripts. That decoupling is what lets the SEA ship without esbuild.
 */
export async function assembleBehaviorPack(opts: AssembleBehaviorPackOpts): Promise<AssembleResult> {
  const version = opts.version ?? [1, 0, 0];
  const bpUuid = opts.uuid ?? randomUuid();
  await fs.promises.rm(opts.outDir, { recursive: true, force: true });
  await fs.promises.mkdir(opts.outDir, { recursive: true });
  if (fs.existsSync(opts.srcDir)) {
    await copyDirAsync(opts.srcDir, opts.outDir);
  } else {
    await fs.promises.mkdir(path.join(opts.outDir, "scripts"), { recursive: true });
    await fs.promises.writeFile(path.join(opts.outDir, "scripts", "main.js"), "/* no scripts */\n", "utf8");
  }
  await writeBehaviorPackManifest(opts.outDir, {
    name: opts.projectName,
    uuid: bpUuid,
    version,
    description: opts.description,
    moduleUuid: opts.moduleUuid,
  });
  if (opts.iconSrc && fs.existsSync(opts.iconSrc)) {
    await copyFileAsync(opts.iconSrc, path.join(opts.outDir, "pack_icon.png"));
  }
  await writePermissionsJson(opts.outDir);
  return { uuid: bpUuid, version };
}

/**
 * Merge every enabled module's `resource_pack/**` tree into one RP directory
 * at `outDir`, with a single fresh `manifest.json`. Per-module subfolders are
 * preserved so resource pack authors can disambiguate (e.g. `peace/textures/...`).
 */
export async function assembleResourcePack(opts: AssembleResourcePackOpts): Promise<AssembleResult> {
  const version = opts.version ?? [1, 0, 0];
  const rpUuid = opts.uuid ?? randomUuid();
  await fs.promises.rm(opts.outDir, { recursive: true, force: true });
  await fs.promises.mkdir(opts.outDir, { recursive: true });
  for (const [moduleId, rpDir] of Object.entries(opts.moduleResourceDirs)) {
    if (!fs.existsSync(rpDir)) continue;
    const dst = path.join(opts.outDir, moduleId);
    await fs.promises.mkdir(dst, { recursive: true });
    await copyDirAsync(rpDir, dst);
  }
  await writeResourcePackManifest(opts.outDir, {
    name: opts.projectName,
    uuid: rpUuid,
    version,
    description: opts.description,
    moduleUuid: opts.moduleUuid,
  });
  return { uuid: rpUuid, version };
}

/**
 * Read the `level-name=` value from `<bdsRoot>/server.properties`.
 * Falls back to "Bedrock level" (BDS default) when the file is missing or
 * the key is absent.
 */
export async function readLevelName(bdsRoot: string): Promise<string> {
  const file = path.join(bdsRoot, "server.properties");
  if (!fs.existsSync(file)) return "Bedrock level";
  const text = await fs.promises.readFile(file, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*level-name\s*=\s*(.+?)\s*$/.exec(line);
    if (m && m[1]) return m[1];
  }
  return "Bedrock level";
}

/**
 * Copy BP/RP source dirs into the world's behavior_packs/ + resource_packs/
 * folders, and write a fresh `permissions.json` into the BP target.
 *
 * Does NOT edit world_behavior_packs.json — that's a separate step the caller
 * must invoke after restart, because BDS only reads that file at startup.
 */
export async function deployToBDS(opts: DeployOpts): Promise<DeployResult> {
  const worldsDir = path.join(opts.bdsRoot, "worlds", opts.levelName);
  const bpDst = path.join(worldsDir, "behavior_packs", opts.bpName);
  const rpDst = path.join(worldsDir, "resource_packs", opts.rpName ?? `${opts.bpName}-rp`);
  await fs.promises.mkdir(worldsDir, { recursive: true });
  await fs.promises.rm(bpDst, { recursive: true, force: true });
  await copyDirAsync(opts.behaviorPackSrc, bpDst);
  await writePermissionsJson(bpDst);
  let rpDir: string | null = null;
  if (opts.resourcePackSrc && fs.existsSync(opts.resourcePackSrc)) {
    await fs.promises.rm(rpDst, { recursive: true, force: true });
    await copyDirAsync(opts.resourcePackSrc, rpDst);
    rpDir = rpDst;
  } else if (opts.clearResourcePack) {
    /* 调用方显式声明不再部署 RP — 清掉聚合 RP 目录残留 */
    await fs.promises.rm(rpDst, { recursive: true, force: true });
  }
  return { bpDir: bpDst, rpDir };
}

/**
 * 确保 BDS Script API 侧 `<bdsRoot>/config/<bpUuid>/permission.json` 存在。
 * 已存在则跳过(不覆盖用户手工改动)。
 * @returns true = 新写入; false = 已存在跳过
 */
export async function ensureConfigPermission(bdsRoot: string, bpUuid: string): Promise<boolean> {
  const dir = path.join(bdsRoot, "config", bpUuid);
  const file = path.join(dir, "permission.json");
  if (fs.existsSync(file)) return false;
  await fs.promises.mkdir(dir, { recursive: true });
  const payload = { allowed_modules: [...SFMC_PERMISSIONS] };
  const tmp = path.join(dir, `.permission.${process.pid}.tmp`);
  await fs.promises.writeFile(tmp, JSON.stringify(payload, null, 2) + "\n", "utf8");
  await fs.promises.rename(tmp, file);
  return true;
}

/** 从已装配 BP/RP 目录读取 header.uuid + version;失败返回 null。 */
export function readPackManifestHeader(
  packDir: string
): { uuid: string; version: [number, number, number]; moduleUuid?: string } | null {
  const file = path.join(packDir, "manifest.json");
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as {
      header?: { uuid?: string; version?: number[] };
      modules?: Array<{ uuid?: string }>;
    };
    const uuid = raw.header?.uuid;
    const ver = raw.header?.version;
    if (typeof uuid !== "string" || !Array.isArray(ver) || ver.length < 3) return null;
    const version: [number, number, number] = [Number(ver[0]), Number(ver[1]), Number(ver[2])];
    const moduleUuid = raw.modules?.[0]?.uuid;
    return { uuid, version, ...(typeof moduleUuid === "string" ? { moduleUuid } : {}) };
  } catch {
    return null;
  }
}

/**
 * Write the seven `@minecraft/*` allowed_modules into a behavior pack's
 * `permissions.json`. Idempotent: rewrites any pre-existing file.
 */
export async function writePermissionsJson(bpDir: string): Promise<void> {
  const payload = { allowed_modules: [...SFMC_PERMISSIONS] };
  await fs.promises.mkdir(bpDir, { recursive: true });
  const tmp = path.join(bpDir, `.permissions.${process.pid}.tmp`);
  await fs.promises.writeFile(tmp, JSON.stringify(payload, null, 2) + "\n", "utf8");
  await fs.promises.rename(tmp, path.join(bpDir, "permissions.json"));
}

/**
 * Add `{ pack_id, version }` to `worlds/<level>/world_behavior_packs.json`
 * (or `world_resource_packs.json`). If the pack_id already exists, replace its
 * version. File missing → initialize as `[]`.
 */
export async function enablePackInWorld(opts: EnablePackOpts): Promise<void> {
  await editWorldPackList(opts, "enable");
}

/** Remove a pack_id from the world's enable-list JSON. */
export async function disablePackInWorld(opts: EnablePackOpts): Promise<void> {
  await editWorldPackList(opts, "disable");
}

interface WorldPackEntry {
  pack_id: string;
  version: [number, number, number];
}

async function editWorldPackList(
  opts: EnablePackOpts,
  mode: "enable" | "disable"
): Promise<void> {
  const file = path.join(
    opts.worldsDir,
    opts.levelName,
    opts.kind === "behavior" ? "world_behavior_packs.json" : "world_resource_packs.json"
  );
  /* 与 readWorldPackList 同源解析,再写回(DRY);异步写路径保留原语义 */
  let entries: WorldPackEntry[] = readWorldPackList(opts.worldsDir, opts.levelName, opts.kind);
  const idx = entries.findIndex((e) => e.pack_id === opts.packUuid);
  if (mode === "enable") {
    const next: WorldPackEntry = { pack_id: opts.packUuid, version: opts.version };
    if (idx >= 0) entries[idx] = next;
    else entries.push(next);
  } else {
    if (idx >= 0) entries.splice(idx, 1);
  }
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.promises.writeFile(tmp, JSON.stringify(entries, null, 2) + "\n", "utf8");
  await fs.promises.rename(tmp, file);
}

/* ── 低层 helpers (Commit 5 实现) ──────────────────────────────────────── */

export async function writeBehaviorPackManifest(
  outDir: string,
  header: {
    name: string;
    uuid: string;
    version: [number, number, number];
    description?: string | undefined;
    moduleUuid?: string | undefined;
  }
): Promise<void> {
  const manifest = {
    format_version: 2,
    header: {
      name: header.name,
      uuid: header.uuid,
      version: header.version,
      description: header.description ? `${header.description} (behavior pack)` : "SFMC behavior pack",
      min_engine_version: [1, 21, 0],
    },
    modules: [
      {
        type: "script",
        language: "javascript",
        entry: "scripts/main.js",
        uuid: header.moduleUuid ?? crypto.randomUUID(),
        version: header.version,
      },
    ],
    dependencies: [
      { module_name: "@minecraft/server", version: "1.18.0" },
    ],
  };
  const file = path.join(outDir, "manifest.json");
  await fs.promises.mkdir(outDir, { recursive: true });
  await fs.promises.writeFile(file, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

export async function writeResourcePackManifest(
  outDir: string,
  header: {
    name: string;
    uuid: string;
    version: [number, number, number];
    description?: string | undefined;
    moduleUuid?: string | undefined;
  }
): Promise<void> {
  const manifest = {
    format_version: 2,
    header: {
      name: header.name,
      uuid: header.uuid,
      version: header.version,
      description: header.description ? `${header.description} (resource pack)` : "SFMC resource pack",
      min_engine_version: [1, 21, 0],
    },
    modules: [
      {
        type: "resources",
        uuid: header.moduleUuid ?? crypto.randomUUID(),
        version: header.version,
      },
    ],
  };
  const file = path.join(outDir, "manifest.json");
  await fs.promises.mkdir(outDir, { recursive: true });
  await fs.promises.writeFile(file, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

/* Re-export copyFileAsync so callers (e.g. SEA bundle) can copy icon without
 * pulling in the full fsx surface area. */
export { copyFileAsync, copyDirAsync };

/* ── Discovery ─────────────────────────────────────────────────────────── */

/**
 * Walk `<modulesDir>/<id>/resource_pack/` for every installed module and
 * return a map { id: absoluteDir }. Modules without a resource_pack folder
 * are silently skipped. Used by `assemble-rp` and the sfmc CLI to know which
 * modules to merge into the resource pack output.
 */
export function scanModuleResourcePacks(modulesDir: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(modulesDir)) return out;
  for (const entry of fs.readdirSync(modulesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const rpDir = path.join(modulesDir, entry.name, "resource_pack");
    if (fs.existsSync(rpDir)) {
      out[entry.name] = rpDir;
    }
  }
  return out;
}

/**
 * 从 JSON 文件加载显式 moduleId → resource_pack 目录映射。
 * 供 assemble-rp --modules-json 使用,避免调用方再做临时目录镜像(OCP/DRY)。
 */
export function loadModuleResourcePackMap(jsonPath: string): Record<string, string> {
  const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as unknown;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`modules-json must be an object: ${jsonPath}`);
  }
  const out: Record<string, string> = {};
  for (const [id, dir] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof id !== "string" || !id || typeof dir !== "string" || !dir) continue;
    const abs = path.resolve(dir);
    if (!fs.existsSync(abs)) {
      throw new Error(`modules-json entry missing: ${id} → ${abs}`);
    }
    out[id] = abs;
  }
  return out;
}

/**
 * 读取世界 enable-list(单一权威,供 has-pack / list-packs / 调用方复用 — DRY)。
 * 文件缺失 → entries=[]；JSON 损坏 → entries=[] 且 parseFailedFile 有值（供 doctor 区分）。
 */
export type WorldPackListReadResult = {
  entries: Array<{ pack_id: string; version: [number, number, number] }>;
  /** 文件存在但解析失败时为该 JSON 绝对路径 */
  parseFailedFile?: string;
};

export function readWorldPackListResult(
  worldsDir: string,
  levelName: string,
  kind: "behavior" | "resource"
): WorldPackListReadResult {
  const file = path.join(
    worldsDir,
    levelName,
    kind === "behavior" ? "world_behavior_packs.json" : "world_resource_packs.json"
  );
  if (!fs.existsSync(file)) return { entries: [] };
  try {
    const arr = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    if (!Array.isArray(arr)) return { entries: [], parseFailedFile: file };
    const out: Array<{ pack_id: string; version: [number, number, number] }> = [];
    for (const e of arr) {
      if (!e || typeof e !== "object") continue;
      const packId = (e as { pack_id?: unknown }).pack_id;
      const ver = (e as { version?: unknown }).version;
      if (typeof packId !== "string" || !packId) continue;
      const version: [number, number, number] =
        Array.isArray(ver) && ver.length >= 3
          ? [Number(ver[0]), Number(ver[1]), Number(ver[2])]
          : [1, 0, 0];
      out.push({ pack_id: packId, version });
    }
    return { entries: out };
  } catch {
    return { entries: [], parseFailedFile: file };
  }
}

/** 兼容读侧：只要 entries（损坏时与缺失同为 []）。详细结果见 readWorldPackListResult。 */
export function readWorldPackList(
  worldsDir: string,
  levelName: string,
  kind: "behavior" | "resource"
): Array<{ pack_id: string; version: [number, number, number] }> {
  return readWorldPackListResult(worldsDir, levelName, kind).entries;
}

/** 世界 enable-list 是否已含指定 pack_id(只读,供 preflight 复用)。 */
export function worldPackListHas(
  worldsDir: string,
  levelName: string,
  kind: "behavior" | "resource",
  packUuid: string
): boolean {
  return readWorldPackList(worldsDir, levelName, kind).some((e) => e.pack_id === packUuid);
}