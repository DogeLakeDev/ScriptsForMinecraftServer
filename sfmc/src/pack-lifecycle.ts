/**
 * pack-lifecycle.ts — 行为包/资源包装载生命周期
 *
 * 职责:
 *   - 计算本机 desired deploy-catalog(启用模块 + fingerprint)
 *   - 与世界 BP 内 sfmc-deploy-catalog.json 比对
 *   - 不一致则整包 build + deploy + 写世界清单 + Script API permission
 *   - 启动前 ensurePacksReady;日志一律走 source=`pack`
 */

import {
  configPath,
  modulePath,
  readJson,
  writeJson,
  type BdsUpdaterConfig,
  type Catalog,
  type ModuleLock,
} from "@sfmc-bds/sdk/node/config";
import { existsSync, readFileSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pushLog } from "./logs.js";
import { dirFingerprint } from "./module-fingerprint.js";
import { failResult, okResult, type CliResult } from "./cli-result.js";
import { t } from "./i18n/index.js";
import {
  assembleBehaviorPack,
  assembleResourcePack,
  bdsWorldLevelDir,
  bdsWorldsDir,
  configPermissionPath,
  deployToBDS,
  disablePackInWorld,
  enablePackInWorld,
  ensureConfigPermission,
  hasConfigPermission,
  readLevelNameSync,
  readPackManifestHeader,
  readWorldPackList,
  worldPackListHas as pmWorldPackListHas,
} from "@sfmc-bds/bds-tools/pack-manager-lib";
import { ROOT, PACKAGES_DIR, resolveSdkPackageRoot } from "./runtime.js";
import { c } from "./theme.js";

export const BP_NAME = "sfmc-modules";
export const RP_NAME = "sfmc-modules-rp";
export const DEPLOY_CATALOG_NAME = "sfmc-deploy-catalog.json";
export const DEFAULT_PACK_VERSION: [number, number, number] = [1, 0, 0];

/** 将 @sfmc/sdk 与 @sfmc-bds/sdk 子路径解析到 SDK 包内真实文件 */
function createSdkResolvePlugin(sdkRoot: string): import("esbuild").Plugin {
  const pkg = JSON.parse(readFileSync(path.join(sdkRoot, "package.json"), "utf8")) as {
    exports?: Record<string, string | { import?: string; default?: string; types?: string }>;
  };
  const exportsMap = pkg.exports ?? {};

  function resolveExportSubpath(subpath: string): string | null {
    const key = subpath === "" ? "." : `./${subpath}`;
    const entry = exportsMap[key];
    if (!entry) return null;
    const rel = typeof entry === "string" ? entry : (entry.import ?? entry.default);
    if (!rel || typeof rel !== "string") return null;
    const abs = path.join(sdkRoot, rel);
    return existsSync(abs) ? abs : null;
  }

  return {
    name: "sfmc-sdk-resolve",
    setup(build) {
      build.onResolve({ filter: /^@sfmc(?:-bds)?\/sdk(?:\/|$)/ }, (args) => {
        const normalized = args.path.replace(/^@sfmc\/sdk/, "@sfmc-bds/sdk");
        const sub = normalized === "@sfmc-bds/sdk" ? "" : normalized.slice("@sfmc-bds/sdk/".length);
        const resolved = resolveExportSubpath(sub);
        if (!resolved) {
          return {
            errors: [
              {
                text: `Cannot resolve ${args.path} under SDK at ${sdkRoot} (export "./${sub || "."}" missing or file absent; run sdk:build?)`,
              },
            ],
          };
        }
        return { path: resolved };
      });
    },
  };
}

export function buildRoot(): string {
  return path.join(ROOT, "build");
}
export function bpSrc(): string {
  return path.join(buildRoot(), `${BP_NAME}-bp`);
}
export function bpOut(): string {
  return path.join(buildRoot(), BP_NAME);
}
export function rpOut(): string {
  return path.join(buildRoot(), RP_NAME);
}

export interface DeployCatalogModule {
  logicalId: string;
  enabled: boolean;
  version: string;
  fingerprint: string;
  hasResourcePack: boolean;
}

export interface DeployCatalog {
  schemaVersion: 1;
  bpUuid: string;
  rpUuid: string | null;
  bpVersion: [number, number, number];
  rpVersion: [number, number, number] | null;
  bpModuleUuid?: string;
  rpModuleUuid?: string;
  generatedAt: number;
  modules: Record<string, DeployCatalogModule>;
}

export interface PackEnsureResult {
  rebuilt: boolean;
  skipped: boolean;
  catalog: DeployCatalog;
  bdsRoot: string;
  levelName: string;
  summary: string;
}

interface PackManifestLite {
  id?: string;
  version?: string;
  schemaVersion?: number;
  enabledByDefault?: boolean;
  name?: string;
}

function packLog(text: string, level: "info" | "success" | "warn" | "error" = "info"): void {
  pushLog(text, "pack", level);
}

function packagesDir(): string {
  return PACKAGES_DIR || path.join(ROOT, "modules", "packages");
}

function lockPath(): string {
  return modulePath(path.join(ROOT, "modules"), "module-lock.json");
}

function catalogPath(): string {
  return modulePath(path.join(ROOT, "modules"), "catalog.json");
}

/** 读 BDS 路径与 level-name（level 权威：pack-manager-lib.readLevelNameSync，DIP） */
export function resolveBdsContext(): { bdsRoot: string; levelName: string } {
  const cfg = (readJson<BdsUpdaterConfig>(configPath(ROOT, "bds_updater.json")) ?? {}) as BdsUpdaterConfig;
  const bdsRoot = cfg.bds_path;
  if (!bdsRoot) {
    throw new Error("bds_path not configured. Run `sfmc init` first.");
  }
  return { bdsRoot, levelName: readLevelNameSync(bdsRoot) };
}

export function deployedBpDir(bdsRoot: string, levelName: string): string {
  return path.join(bdsWorldLevelDir(bdsRoot, levelName), "behavior_packs", BP_NAME);
}

export function deployedRpDir(bdsRoot: string, levelName: string): string {
  return path.join(bdsWorldLevelDir(bdsRoot, levelName), "resource_packs", RP_NAME);
}

export function deployedCatalogPath(bdsRoot: string, levelName: string): string {
  return path.join(deployedBpDir(bdsRoot, levelName), DEPLOY_CATALOG_NAME);
}

/** 解析启用状态:lock 优先,否则 catalog.enabledByDefault(缺省 true↔!==false),未收录模块 false */
function isModuleEnabled(logicalId: string, lock: ModuleLock, catalogDefaults: Map<string, boolean>): boolean {
  const st = lock.modules?.[logicalId];
  if (st && typeof st.enabled === "boolean") return st.enabled;
  return catalogDefaults.get(logicalId) ?? false;
}

/**
 * 部署前收集世界内已出现的 BP/RP uuid。
 * 同时读 deploy-catalog 与磁盘 manifest — catalog 缺失时仍能卸过期清单项(Demeter/完整契约)。
 */
function collectDeployedPackUuids(
  bdsRoot: string,
  levelName: string
): { bp: Set<string>; rp: Set<string> } {
  const bp = new Set<string>();
  const rp = new Set<string>();
  const cat = readDeployedCatalog(bdsRoot, levelName);
  if (cat?.bpUuid) bp.add(cat.bpUuid);
  if (cat?.rpUuid) rp.add(cat.rpUuid);
  const liveBp = readPackManifestHeader(deployedBpDir(bdsRoot, levelName));
  const liveRp = readPackManifestHeader(deployedRpDir(bdsRoot, levelName));
  if (liveBp?.uuid) bp.add(liveBp.uuid);
  if (liveRp?.uuid) rp.add(liveRp.uuid);
  return { bp, rp };
}

/**
 * 枚举本机 packages,返回 folderId → 元数据。
 * 仅含有 sapi/src/index.ts 的模块会进入 BP bundle 候选。
 */
export async function scanLocalModules(): Promise<
  Array<{
    folderId: string;
    logicalId: string;
    version: string;
    enabled: boolean;
    hasSapi: boolean;
    hasResourcePack: boolean;
    fingerprint: string;
    entryPath: string | null;
  }>
> {
  const dir = packagesDir();
  if (!existsSync(dir)) return [];
  const lock = (readJson<ModuleLock>(lockPath()) ?? { version: 1, modules: {} }) as ModuleLock;
  const cat = (readJson<Catalog>(catalogPath()) ?? {}) as Catalog;
  const defaults = new Map<string, boolean>();
  if (Array.isArray(cat.modules)) {
    for (const m of cat.modules) {
      const id = typeof m.id === "string" ? m.id : "";
      if (!id) continue;
      /* 与 db-server 契约一致:enabledByDefault !== false(缺省 true) — LSP */
      defaults.set(id, m.enabledByDefault !== false);
    }
  }

  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out: Array<{
    folderId: string;
    logicalId: string;
    version: string;
    enabled: boolean;
    hasSapi: boolean;
    hasResourcePack: boolean;
    fingerprint: string;
    entryPath: string | null;
  }> = [];

  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const folderId = e.name;
    const modPath = path.join(dir, folderId);
    const manifestPath = path.join(modPath, "sapi", "manifest.json");
    const entryPath = path.join(modPath, "sapi", "src", "index.ts");
    let logicalId = folderId;
    let version = "0.0.0";
    if (existsSync(manifestPath)) {
      try {
        const man = JSON.parse(await fs.readFile(manifestPath, "utf8")) as PackManifestLite;
        if (typeof man.id === "string" && man.id) logicalId = man.id;
        if (typeof man.version === "string" && man.version) version = man.version;
        else if (typeof man.schemaVersion === "number") version = `schema-${man.schemaVersion}`;
      } catch {
        /* keep defaults */
      }
    }
    const hasSapi = existsSync(entryPath);
    const hasResourcePack = existsSync(path.join(modPath, "resource_pack"));
    const fingerprint = await dirFingerprint(modPath);
    const enabled = isModuleEnabled(logicalId, lock, defaults);
    out.push({
      folderId,
      logicalId,
      version,
      enabled,
      hasSapi,
      hasResourcePack,
      fingerprint,
      entryPath: hasSapi ? entryPath : null,
    });
  }
  out.sort((a, b) => a.folderId.localeCompare(b.folderId));
  return out;
}

/** 从本机状态 + 已有 UUID 合成 desired catalog。
 * UUID 优先:deployed catalog → 本地 build manifest → 新建随机。
 */
export async function computeDesiredCatalog(opts?: {
  bpUuid?: string;
  rpUuid?: string | null;
  bpVersion?: [number, number, number];
  rpVersion?: [number, number, number] | null;
  bpModuleUuid?: string;
  rpModuleUuid?: string;
}): Promise<DeployCatalog> {
  const mods = await scanLocalModules();
  const modules: Record<string, DeployCatalogModule> = {};
  let anyRp = false;
  for (const m of mods) {
    /* catalog 记录全部已安装模块的启停与指纹,便于 diff 装卸/禁用 */
    modules[m.folderId] = {
      logicalId: m.logicalId,
      enabled: m.enabled,
      version: m.version,
      fingerprint: m.fingerprint,
      hasResourcePack: m.hasResourcePack,
    };
    if (m.enabled && m.hasResourcePack) anyRp = true;
  }

  const localBp = readPackManifestHeader(bpOut());
  const localRp = readPackManifestHeader(rpOut());
  const bpUuid = opts?.bpUuid ?? localBp?.uuid ?? crypto.randomUUID();
  const bpVersion = opts?.bpVersion ?? localBp?.version ?? DEFAULT_PACK_VERSION;
  const bpModuleUuid = opts?.bpModuleUuid ?? localBp?.moduleUuid;
  let rpUuid: string | null = null;
  let rpVersion: [number, number, number] | null = null;
  let rpModuleUuid: string | undefined;
  if (anyRp) {
    rpUuid = opts?.rpUuid ?? localRp?.uuid ?? crypto.randomUUID();
    rpVersion = opts?.rpVersion ?? localRp?.version ?? DEFAULT_PACK_VERSION;
    rpModuleUuid = opts?.rpModuleUuid ?? localRp?.moduleUuid;
  }

  return {
    schemaVersion: 1,
    bpUuid,
    rpUuid,
    bpVersion,
    rpVersion,
    ...(bpModuleUuid ? { bpModuleUuid } : {}),
    ...(rpModuleUuid ? { rpModuleUuid } : {}),
    generatedAt: Date.now(),
    modules,
  };
}

export function readDeployedCatalog(bdsRoot: string, levelName: string): DeployCatalog | null {
  const file = deployedCatalogPath(bdsRoot, levelName);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as DeployCatalog;
  } catch {
    return null;
  }
}

/** 比较键:模块集合 + enabled/version/fingerprint/hasRP + bp/rp uuid */
export function catalogsEqual(a: DeployCatalog, b: DeployCatalog): boolean {
  if (a.bpUuid !== b.bpUuid) return false;
  if ((a.rpUuid ?? null) !== (b.rpUuid ?? null)) return false;
  const aKeys = Object.keys(a.modules).sort();
  const bKeys = Object.keys(b.modules).sort();
  if (aKeys.length !== bKeys.length) return false;
  for (let i = 0; i < aKeys.length; i++) {
    if (aKeys[i] !== bKeys[i]) return false;
  }
  for (const k of aKeys) {
    const x = a.modules[k]!;
    const y = b.modules[k]!;
    if (
      x.logicalId !== y.logicalId ||
      x.enabled !== y.enabled ||
      x.version !== y.version ||
      x.fingerprint !== y.fingerprint ||
      x.hasResourcePack !== y.hasResourcePack
    ) {
      return false;
    }
  }
  /* 世界清单是否仍含 uuid — 调用方额外检查 */
  return true;
}

/** 世界 enable-list 查询 — 直连 pack-manager-lib（DRY/DIP，与 CLI has-pack 同契约） */
function worldPackListHas(bdsRoot: string, levelName: string, kind: "behavior" | "resource", uuid: string): boolean {
  return pmWorldPackListHas(bdsWorldsDir(bdsRoot), levelName, kind, uuid);
}

/** esbuild 聚合启用模块 → assemble BP + RP(若有) */
export async function buildPacks(desired?: DeployCatalog): Promise<DeployCatalog> {
  await fs.mkdir(buildRoot(), { recursive: true });
  const catalog = desired ?? (await computeDesiredCatalog());
  packLog(`building BP/RP (modules=${Object.keys(catalog.modules).length})…`);

  /* 单次扫描:SAPI 入口 + RP 目录(DRY,避免 listEnabled* 重复 fingerprint) */
  const mods = await scanLocalModules();
  const entries = mods.filter((m) => m.enabled && m.entryPath).map((m) => m.entryPath!);
  const rpDirs: Record<string, string> = {};
  for (const m of mods) {
    if (!m.enabled || !m.hasResourcePack) continue;
    rpDirs[m.folderId] = path.join(packagesDir(), m.folderId, "resource_pack");
  }

  const { build } = await import("esbuild");
  const outFile = path.join(bpSrc(), "scripts", "main.js");
  await fs.mkdir(path.dirname(outFile), { recursive: true });
  if (entries.length === 0) {
    await fs.writeFile(outFile, "/* no modules enabled */\n", "utf8");
    packLog("no enabled SAPI modules — empty main.js", "warn");
  } else {
    const sdkRoot = resolveSdkPackageRoot();
    packLog(`SDK root: ${sdkRoot}`);
    await build({
      entryPoints: entries,
      outfile: outFile,
      bundle: true,
      platform: "neutral",
      format: "esm",
      target: "es2022",
      logLevel: "warning",
      sourcemap: false,
      external: ["@minecraft/*"],
      // 避免读取模块内残缺的 extends（如 ../../../sdk/@sfmc-sdk/tsconfig.json）
      tsconfigRaw: JSON.stringify({
        compilerOptions: {
          module: "ESNext",
          moduleResolution: "bundler",
          target: "ES2022",
          strict: true,
          skipLibCheck: true,
        },
      }),
      plugins: [createSdkResolvePlugin(sdkRoot)],
    });
    packLog(`esbuild bundled ${entries.length} entr(y/ies)`, "success");
  }

  try {
    await assembleBehaviorPack({
      srcDir: bpSrc(),
      outDir: bpOut(),
      projectName: BP_NAME,
      version: catalog.bpVersion,
      description: "ScriptsForMinecraftServer aggregated behavior pack",
      uuid: catalog.bpUuid,
      ...(catalog.bpModuleUuid ? { moduleUuid: catalog.bpModuleUuid } : {}),
    });
  } catch (e) {
    throw new Error(`assemble-bp failed: ${(e as Error).message}`);
  }
  packLog(`assembled BP uuid=${catalog.bpUuid}`, "success");

  if (Object.keys(rpDirs).length > 0 && catalog.rpUuid) {
    /* OCP:显式 module→rpDir map 直传库，不再临时镜像整树 / 落盘 JSON */
    try {
      await assembleResourcePack({
        moduleResourceDirs: rpDirs,
        outDir: rpOut(),
        projectName: RP_NAME,
        version: catalog.rpVersion ?? DEFAULT_PACK_VERSION,
        description: "ScriptsForMinecraftServer aggregated resource pack",
        uuid: catalog.rpUuid,
        ...(catalog.rpModuleUuid ? { moduleUuid: catalog.rpModuleUuid } : {}),
      });
    } catch (e) {
      throw new Error(`assemble-rp failed: ${(e as Error).message}`);
    }
    packLog(`assembled RP uuid=${catalog.rpUuid} (${Object.keys(rpDirs).length} modules)`, "success");
  } else {
    /* 无 RP:清理旧产物,catalog.rpUuid 置空 */
    await fs.rm(rpOut(), { recursive: true, force: true });
    catalog.rpUuid = null;
    catalog.rpVersion = null;
    packLog("no enabled resource packs — RP skipped");
  }

  /* 把 catalog 写到本地 BP 产物,deploy 时一并拷走 */
  catalog.generatedAt = Date.now();
  writeJson(path.join(bpOut(), DEPLOY_CATALOG_NAME), catalog);
  return catalog;
}

/** 部署到世界 + enable 清单 + Script API permission */
export async function deployPacks(catalog: DeployCatalog): Promise<void> {
  const { bdsRoot, levelName } = resolveBdsContext();
  if (!existsSync(bpOut())) {
    throw new Error(`BP not built at ${bpOut()}. Run build first.`);
  }

  /* 必须在 deploy/clear-rp 之前采集 — 清目录后无法再读 manifest */
  const previous = collectDeployedPackUuids(bdsRoot, levelName);
  try {
    await deployToBDS({
      bdsRoot,
      levelName,
      behaviorPackSrc: bpOut(),
      bpName: BP_NAME,
      rpName: RP_NAME,
      ...(catalog.rpUuid && existsSync(rpOut())
        ? { resourcePackSrc: rpOut() }
        : { clearResourcePack: true }),
    });
  } catch (e) {
    throw new Error(`deploy failed: ${(e as Error).message}`);
  }
  packLog(`deployed to worlds/${levelName}`, "success");

  /* 确保 catalog 在部署后的 BP 内(deploy 会拷贝整个目录) */
  writeJson(path.join(deployedBpDir(bdsRoot, levelName), DEPLOY_CATALOG_NAME), catalog);

  const worldsDir = bdsWorldsDir(bdsRoot);
  try {
    await enablePackInWorld({
      worldsDir,
      levelName,
      kind: "behavior",
      packUuid: catalog.bpUuid,
      version: catalog.bpVersion,
    });
  } catch (e) {
    throw new Error(`enable BP failed: ${(e as Error).message}`);
  }
  packLog(`enabled behavior pack ${catalog.bpUuid} in world list`, "success");

  if (catalog.rpUuid && catalog.rpVersion) {
    try {
      await enablePackInWorld({
        worldsDir,
        levelName,
        kind: "resource",
        packUuid: catalog.rpUuid,
        version: catalog.rpVersion,
      });
    } catch (e) {
      throw new Error(`enable RP failed: ${(e as Error).message}`);
    }
    packLog(`enabled resource pack ${catalog.rpUuid} in world list`, "success");
  }

  /* 卸掉过期 RP:UUID 轮换 / 不再提供 RP / catalog 缺失但磁盘仍有旧包 */
  for (const staleRp of previous.rp) {
    if (staleRp === (catalog.rpUuid ?? null)) continue;
    try {
      await disablePackInWorld({
        worldsDir,
        levelName,
        kind: "resource",
        packUuid: staleRp,
        version: DEFAULT_PACK_VERSION,
      });
      packLog(`disabled stale resource pack ${staleRp}`, "success");
    } catch (e) {
      packLog(`disable stale RP ${staleRp} failed: ${(e as Error).message}`, "warn");
    }
  }

  /* 卸掉过期 BP(uuid 轮换) */
  for (const staleBp of previous.bp) {
    if (staleBp === catalog.bpUuid) continue;
    try {
      await disablePackInWorld({
        worldsDir,
        levelName,
        kind: "behavior",
        packUuid: staleBp,
        version: DEFAULT_PACK_VERSION,
      });
      packLog(`disabled stale behavior pack ${staleBp}`, "success");
    } catch (e) {
      packLog(`disable stale BP ${staleBp} failed: ${(e as Error).message}`, "warn");
    }
  }

  try {
    const wrote = await ensureConfigPermission(bdsRoot, catalog.bpUuid);
    const permRel = path.relative(bdsRoot, configPermissionPath(bdsRoot, catalog.bpUuid));
    packLog(wrote ? `wrote ${permRel}` : `${permRel} already exists — skipped`);
  } catch (e) {
    throw new Error(`ensure-permission failed: ${(e as Error).message}`);
  }
}

export function formatPackLoadInfo(catalog: DeployCatalog, rebuilt: boolean): string {
  const mods = Object.entries(catalog.modules);
  const enabled = mods.filter(([, m]) => m.enabled);
  const disabled = mods.filter(([, m]) => !m.enabled);
  const lines = [
    `pack load ${rebuilt ? "(rebuilt)" : "(catalog match — skip rebuild)"}`,
    `  BP ${catalog.bpUuid}  v${catalog.bpVersion.join(".")}`,
    catalog.rpUuid
      ? `  RP ${catalog.rpUuid}  v${(catalog.rpVersion ?? DEFAULT_PACK_VERSION).join(".")}`
      : `  RP (none)`,
    `  modules: ${enabled.length} enabled / ${disabled.length} disabled / ${mods.length} installed`,
  ];
  for (const [folderId, m] of enabled.sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`    ● ${folderId} (${m.logicalId}) ${m.version}${m.hasResourcePack ? " +rp" : ""}`);
  }
  for (const [folderId, m] of disabled.sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`    ○ ${folderId} (${m.logicalId}) disabled`);
  }
  return lines.join("\n");
}

function reusePackIds(deployed: DeployCatalog): {
  bpUuid?: string;
  rpUuid?: string | null;
  bpVersion?: [number, number, number];
  rpVersion?: [number, number, number] | null;
  bpModuleUuid?: string;
  rpModuleUuid?: string;
} {
  return {
    bpUuid: deployed.bpUuid,
    rpUuid: deployed.rpUuid,
    bpVersion: deployed.bpVersion,
    rpVersion: deployed.rpVersion,
    ...(deployed.bpModuleUuid ? { bpModuleUuid: deployed.bpModuleUuid } : {}),
    ...(deployed.rpModuleUuid ? { rpModuleUuid: deployed.rpModuleUuid } : {}),
  };
}

/**
 * BDS 启动前闸门:catalog 不一致则整包重编部署;失败抛错,禁止启动。
 */
export async function ensurePacksReady(): Promise<PackEnsureResult> {
  const { bdsRoot, levelName } = resolveBdsContext();
  packLog(`preflight: checking packs for ${bdsRoot} / ${levelName}`);

  const deployed = readDeployedCatalog(bdsRoot, levelName);
  /* 复用已部署 UUID,避免无谓轮换 */
  let desired = await computeDesiredCatalog(deployed ? reusePackIds(deployed) : undefined);

  /* 若 desired 需要 RP 但复用了旧 null rpUuid,补一个 */
  const needsRp = Object.values(desired.modules).some((m) => m.enabled && m.hasResourcePack);
  if (needsRp && !desired.rpUuid) {
    desired = await computeDesiredCatalog({
      bpUuid: desired.bpUuid,
      bpVersion: desired.bpVersion,
      ...(desired.bpModuleUuid ? { bpModuleUuid: desired.bpModuleUuid } : {}),
      rpUuid: crypto.randomUUID(),
      rpVersion: DEFAULT_PACK_VERSION,
    });
  }
  if (!needsRp) {
    desired.rpUuid = null;
    desired.rpVersion = null;
  }

  let needRebuild = !deployed || !catalogsEqual(desired, deployed);
  if (!needRebuild && deployed) {
    if (!worldPackListHas(bdsRoot, levelName, "behavior", deployed.bpUuid)) needRebuild = true;
    if (deployed.rpUuid && !worldPackListHas(bdsRoot, levelName, "resource", deployed.rpUuid)) {
      needRebuild = true;
    }
    if (!hasConfigPermission(bdsRoot, deployed.bpUuid)) {
      /* permission 缺失只补写,不强制整包重编 */
      try {
        const wrote = await ensureConfigPermission(bdsRoot, deployed.bpUuid);
        const permRel = path.relative(bdsRoot, configPermissionPath(bdsRoot, deployed.bpUuid));
        packLog(wrote ? `wrote ${permRel}` : `${permRel} already exists — skipped`);
      } catch (e) {
        throw new Error(`ensure-permission failed: ${(e as Error).message}`);
      }
    }
  }

  let rebuilt = false;
  if (needRebuild) {
    packLog("catalog mismatch — rebuilding packs…", "warn");
    desired = await buildPacks(desired);
    await deployPacks(desired);
    rebuilt = true;
  } else {
    packLog("catalog match — skip rebuild", "success");
  }

  const summary = formatPackLoadInfo(desired, rebuilt);
  for (const line of summary.split("\n")) packLog(line, rebuilt ? "success" : "info");

  return {
    rebuilt,
    skipped: !rebuilt,
    catalog: desired,
    bdsRoot,
    levelName,
    summary,
  };
}

/* ── CLI 命令实现 ─────────────────────────────────────────────────────── */

export async function cmdPackBuild(_args: string[]): Promise<CliResult> {
  try {
    const cat = await buildPacks();
    return okResult(c.green(t("pack.built", { path: bpOut() })) + `\n` + formatPackLoadInfo(cat, true) + "\n");
  } catch (e) {
    packLog((e as Error).message, "error");
    return failResult(c.red(t("pack.buildFailed", { message: (e as Error).message })));
  }
}

export async function cmdPackDeploy(_args: string[]): Promise<CliResult> {
  try {
    const localCatFile = path.join(bpOut(), DEPLOY_CATALOG_NAME);
    let cat: DeployCatalog;
    if (existsSync(localCatFile)) {
      cat = JSON.parse(await fs.readFile(localCatFile, "utf8")) as DeployCatalog;
    } else {
      cat = await buildPacks();
    }
    await deployPacks(cat);
    return okResult(c.green(t("pack.deployed")) + "\n" + formatPackLoadInfo(cat, true) + "\n");
  } catch (e) {
    packLog((e as Error).message, "error");
    return failResult(c.red(t("pack.deployFailed", { message: (e as Error).message })));
  }
}

export async function cmdPackStatus(_args: string[]): Promise<string> {
  try {
    const { bdsRoot, levelName } = resolveBdsContext();
    const deployed = readDeployedCatalog(bdsRoot, levelName);
    const desired = await computeDesiredCatalog(deployed ? reusePackIds(deployed) : undefined);
    const match = deployed ? catalogsEqual(desired, deployed) : false;
    const permPath = deployed ? configPermissionPath(bdsRoot, deployed.bpUuid) : null;
    const lines = [
      c.bold("\nPack status"),
      `  bds        : ${bdsRoot}`,
      `  level      : ${levelName}`,
      `  catalog    : ${match ? c.green("in sync") : c.yellow(deployed ? "mismatch — will rebuild on start" : "missing")}`,
      `  BP dir     : ${deployedBpDir(bdsRoot, levelName)} ${existsSync(deployedBpDir(bdsRoot, levelName)) ? c.green("✓") : c.red("✗")}`,
      `  RP dir     : ${deployedRpDir(bdsRoot, levelName)} ${existsSync(deployedRpDir(bdsRoot, levelName)) ? c.green("✓") : c.dim("—")}`,
      `  permission : ${permPath ? (existsSync(permPath) ? c.green(permPath) : c.yellow("missing")) : c.dim("n/a")}`,
    ];
    if (deployed) {
      lines.push(`  BP uuid    : ${deployed.bpUuid}`);
      if (deployed.rpUuid) lines.push(`  RP uuid    : ${deployed.rpUuid}`);
      lines.push(
        `  world BP   : ${worldPackListHas(bdsRoot, levelName, "behavior", deployed.bpUuid) ? c.green("listed") : c.red("not listed")}`
      );
      if (deployed.rpUuid) {
        lines.push(
          `  world RP   : ${worldPackListHas(bdsRoot, levelName, "resource", deployed.rpUuid) ? c.green("listed") : c.red("not listed")}`
        );
      }
    }
    lines.push(formatPackLoadInfo(desired, false));
    return lines.join("\n") + "\n";
  } catch (e) {
    return c.red(t("pack.statusFailed", { message: (e as Error).message }));
  }
}

export async function cmdPackList(_args: string[]): Promise<string> {
  try {
    const { bdsRoot, levelName } = resolveBdsContext();
    const mods = await scanLocalModules();
    const lines = [c.bold("\nModules / resource packs"), c.dim(`  ${packagesDir()}`)];
    for (const m of mods) {
      const mark = m.enabled ? c.green("●") : c.dim("○");
      lines.push(
        `  ${mark} ${m.folderId.padEnd(24)} ${m.logicalId.padEnd(24)} ${m.enabled ? "on " : "off"} ${m.hasResourcePack ? "+rp" : "   "} ${m.version}`
      );
    }
    const worldsDir = bdsWorldsDir(bdsRoot);
    lines.push(c.bold("\nWorld enable lists"));
    for (const kind of ["behavior", "resource"] as const) {
      const arr = readWorldPackList(worldsDir, levelName, kind);
      if (!arr.length) lines.push(c.dim(`  ${kind}: (empty)`));
      for (const e of arr) {
        lines.push(`  ${kind}: ${e.pack_id}  v${(e.version ?? []).join(".")}`);
      }
    }
    return lines.join("\n") + "\n";
  } catch (e) {
    return c.red(t("pack.listFailed", { message: (e as Error).message }));
  }
}

export async function cmdPackEnableDisable(action: "enable" | "disable", args: string[]): Promise<string> {
  try {
    const kind = (args[0] === "resource" || args[0] === "rp" ? "resource" : "behavior") as "behavior" | "resource";
    const { bdsRoot, levelName } = resolveBdsContext();
    const deployed = readDeployedCatalog(bdsRoot, levelName);
    if (!deployed) return c.red(t("pack.noCatalog"));
    const uuid = kind === "behavior" ? deployed.bpUuid : deployed.rpUuid;
    const version = kind === "behavior" ? deployed.bpVersion : deployed.rpVersion;
    if (!uuid || !version) return c.red(t("pack.noUuid", { kind }));
    const worldsDir = bdsWorldsDir(bdsRoot);
    try {
      const opts = { worldsDir, levelName, kind, packUuid: uuid, version };
      if (action === "enable") await enablePackInWorld(opts);
      else await disablePackInWorld(opts);
    } catch (e) {
      return c.red(t("pack.actionFailed", { action, detail: (e as Error).message }));
    }
    packLog(`${action}d ${kind} pack ${uuid}`, "success");
    return c.green(
      action === "enable"
        ? t("pack.enabledOk", { kind, uuid })
        : t("pack.disabledOk", { kind, uuid })
    );
  } catch (e) {
    return c.red(t("pack.actionErr", { action, message: (e as Error).message }));
  }
}

/* CLI 表面已收敛：模块用 mod build/reload；第三方包启停用 addon/packs。
 * 此处保留 cmdPackBuild / cmdPackDeploy 供 ensurePacksReady 与 mod reload 调用。 */

