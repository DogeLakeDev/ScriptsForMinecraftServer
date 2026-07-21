/**
 * pack-manager.ts — Bedrock 行为包/资源包 装配 + 部署到 BDS 根。
 *
 * 这是 SEA 与 npm 两条用户路径共用的纯函数库:
 *
 *   - SEA:用户在 REPL/wizard 里跑 `sfmc behavior-pack build/deploy`
 *          → sfmc 通过 spawnService 启 `bds-tools/dist/pack-manager.js`,
 *            SEA 自己跑 esbuild 把脚本 bundle 写到 <modulesDir>/build/sfmc-modules-bp/scripts/main.js,
 *            然后调 pack-manager#assembleBehaviorPack 装配。
 *   - npm: 用户跑 `scriptsforminecraftserver/build.mjs` 或 `sfmc behavior-pack build`,
 *          同一 spawnService 路径。或者直接在同进程 import 这个库。
 *
 * 关键约束:本文件不允许引 esbuild / 任何 npm-only 包 — SEA 要把它打成 SEA
 * 的一部分内嵌起来,而 SEA 是个单 exe (除 Node 内置 + bds-tools 已有依赖外)。
 *
 * 已有依赖 (bds-tools/package.json):
 *   - adm-zip:    压缩 (未来扩展需要)
 *   - cli-progress: 进度条
 *   - node-html-parser: changelog 抓取 (本文件用不到)
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
export async function assembleBehaviorPack(opts: AssembleBehaviorPackOpts): Promise<void> {
  const version = opts.version ?? [1, 0, 0];
  const bpUuid = randomUuid();
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
  });
  if (opts.iconSrc && fs.existsSync(opts.iconSrc)) {
    await copyFileAsync(opts.iconSrc, path.join(opts.outDir, "pack_icon.png"));
  }
  await writePermissionsJson(opts.outDir);
}

/**
 * Merge every enabled module's `resource_pack/**` tree into one RP directory
 * at `outDir`, with a single fresh `manifest.json`. Per-module subfolders are
 * preserved so resource pack authors can disambiguate (e.g. `peace/textures/...`).
 */
export async function assembleResourcePack(opts: AssembleResourcePackOpts): Promise<void> {
  const version = opts.version ?? [1, 0, 0];
  const rpUuid = randomUuid();
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
  });
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
export async function deployToBDS(opts: DeployOpts): Promise<void> {
  const worldsDir = path.join(opts.bdsRoot, "worlds", opts.levelName);
  const bpDst = path.join(worldsDir, "behavior_packs", opts.bpName);
  const rpDst = path.join(worldsDir, "resource_packs", opts.rpName ?? `${opts.bpName}-rp`);
  await fs.promises.mkdir(worldsDir, { recursive: true });
  await fs.promises.rm(bpDst, { recursive: true, force: true });
  await copyDirAsync(opts.behaviorPackSrc, bpDst);
  await writePermissionsJson(bpDst);
  if (opts.resourcePackSrc && fs.existsSync(opts.resourcePackSrc)) {
    await fs.promises.rm(rpDst, { recursive: true, force: true });
    await copyDirAsync(opts.resourcePackSrc, rpDst);
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
  void copyDirAsync;
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
  let entries: WorldPackEntry[] = [];
  try {
    const raw = await fs.promises.readFile(file, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) entries = parsed as WorldPackEntry[];
  } catch {
    /* missing / corrupt → start with [] */
    entries = [];
  }
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
  header: { name: string; uuid: string; version: [number, number, number]; description?: string | undefined }
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
        uuid: crypto.randomUUID(),
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
  header: { name: string; uuid: string; version: [number, number, number]; description?: string | undefined }
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
        uuid: crypto.randomUUID(),
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