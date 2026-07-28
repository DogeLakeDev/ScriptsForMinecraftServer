/**
 * module-pack-build.ts — `mod build` / `mod reload` 的 spawn-based 实现
 *
 * CLI 派发的 module build / reload 子命令走这里；pack-lifecycle.ts 保留
 * ensurePacksReady 启动钩子与 wizard 内部消费方的 in-process 入口。
 *
 * 实际文件写入（assemble-bp / assemble-rp / deploy / enable-pack / disable-pack /
 * ensure-permission）通过 spawn bds-tools/cli-pack-manager.ts 的 verb 执行；
 * 与 module install/uninstall（→ tools/fetch-module.mjs）、module create
 * （→ tools/new-module.mjs）保持同一架构：CLI 是 thin wrapper，工作在外部工具。
 *
 * 唯一权威：本文件 = `sfmc mod build|reload` 的派发入口；其他文件不得再
 * 直接 import pack-lifecycle 的 cmdPackBuild / deployPacks（确保只有一个 spawn 入口）。
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { writeJson } from "@sfmc-bds/sdk/node/config";
import {
  BP_NAME,
  RP_NAME,
  DEPLOY_CATALOG_NAME,
  bpOut,
  bpSrc,
  rpOut,
  buildRoot,
  computeDesiredCatalog,
  readDeployedCatalog,
  catalogsEqual,
  resolveBdsContext,
  deployedBpDir,
  formatPackLoadInfo,
  scanLocalModules,
  type DeployCatalog,
} from "./pack-lifecycle.js";
import { ROOT, resolveServiceScript } from "./runtime.js";
import { c } from "./theme.js";
import { t } from "./i18n/index.js";
import { pushLog } from "./logs.js";

type SpawnResult = { code: number | null; output: string };

/** spawn bds-tools/cli-pack-manager.ts 子进程；捕获 stdout+stderr。 */
function spawnPackManager(args: string[]): Promise<SpawnResult> {
  return new Promise((resolve) => {
    const script = resolveServiceScript("pack-manager");
    const proc = spawn(process.execPath, [script, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, SFMC_ROOT: ROOT, SFMC_SERVICE: "pack-manager" },
    });
    let output = "";
    proc.stdout?.on("data", (d: Buffer) => {
      output += d.toString();
    });
    proc.stderr?.on("data", (d: Buffer) => {
      output += d.toString();
    });
    proc.on("exit", (code) => resolve({ code, output }));
    proc.on("error", (e) => resolve({ code: 1, output: `${output}${e.message}` }));
  });
}

/* esbuild bundle —— JS bundler 是 in-process 库，不走 spawn。 */
async function bundleBehaviorPackScript(): Promise<void> {
  const mods = await scanLocalModules();
  const entries = mods.filter((m) => m.enabled && m.entryPath).map((m) => m.entryPath!);
  const outFile = path.join(bpSrc(), "scripts", "main.js");
  await fs.mkdir(path.dirname(outFile), { recursive: true });

  if (entries.length === 0) {
    await fs.writeFile(outFile, "/* no modules enabled */\n", "utf8");
    pushLog("no enabled SAPI modules — empty main.js", "pack", "warn");
    return;
  }

  const { build } = await import("esbuild");
  const sdkRoot = await resolveSdkRootForEsbuild();
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
  pushLog(`esbuild bundled ${entries.length} entr(y/ies)`, "pack", "info");
}

async function resolveSdkRootForEsbuild(): Promise<string> {
  const { resolveSdkPackageRoot } = await import("./runtime.js");
  return resolveSdkPackageRoot();
}

/** esbuild 插件：解析 @sfmc-bds/sdk 的 exports 字段（与 pack-lifecycle.ts 内部实现同步）。 */
function createSdkResolvePlugin(sdkRoot: string): import("esbuild").Plugin {
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
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

/** spawn assemble-bp verb。 */
async function spawnAssembleBp(catalog: DeployCatalog): Promise<SpawnResult> {
  const args = [
    "assemble-bp",
    "--src",
    bpSrc(),
    "--out",
    bpOut(),
    "--name",
    BP_NAME,
    "--uuid",
    catalog.bpUuid,
    "--version",
    catalog.bpVersion.join(","),
  ];
  if (catalog.bpModuleUuid) args.push("--module-uuid", catalog.bpModuleUuid);
  const r = await spawnPackManager(args);
  if (r.code === 0) {
    pushLog(`assembled BP uuid=${catalog.bpUuid}`, "pack", "info");
  }
  return r;
}

/** spawn assemble-rp verb；无 RP 时清理旧产物。 */
async function spawnAssembleRp(
  catalog: DeployCatalog,
  rpDirs: Record<string, string>
): Promise<SpawnResult> {
  if (!catalog.rpUuid || Object.keys(rpDirs).length === 0) {
    await fs.rm(rpOut(), { recursive: true, force: true });
    pushLog("no enabled resource packs — RP skipped", "pack", "info");
    return { code: 0, output: "[pack-manager] no enabled resource packs — RP skipped\n" };
  }
  const mapFile = path.join(buildRoot(), "rp-map.json");
  await fs.mkdir(buildRoot(), { recursive: true });
  await fs.writeFile(mapFile, JSON.stringify(rpDirs), "utf8");
  const args = [
    "assemble-rp",
    "--modules-json",
    mapFile,
    "--out",
    rpOut(),
    "--name",
    RP_NAME,
    "--uuid",
    catalog.rpUuid,
    "--version",
    (catalog.rpVersion ?? [1, 0, 0]).join(","),
  ];
  if (catalog.rpModuleUuid) args.push("--module-uuid", catalog.rpModuleUuid);
  const r = await spawnPackManager(args);
  if (r.code === 0) {
    pushLog(
      `assembled RP uuid=${catalog.rpUuid} (${Object.keys(rpDirs).length} modules)`,
      "pack",
      "info"
    );
  }
  return r;
}

/** spawn deploy verb；无 RP 时带 --clear-rp。 */
async function spawnDeploy(catalog: DeployCatalog): Promise<SpawnResult> {
  const { bdsRoot, levelName } = resolveBdsContext();
  const args = [
    "deploy",
    "--bds-root",
    bdsRoot,
    "--level",
    levelName,
    "--bp-src",
    bpOut(),
    "--bp-name",
    BP_NAME,
    "--rp-name",
    RP_NAME,
  ];
  if (catalog.rpUuid && existsSync(rpOut())) {
    args.push("--rp-src", rpOut());
  } else {
    args.push("--clear-rp");
  }
  const r = await spawnPackManager(args);
  if (r.code === 0) {
    pushLog(`deployed to worlds/${levelName}`, "pack", "info");
  }
  return r;
}

/** spawn enable-pack verb：BP 必须，RP 仅在有 UUID 时。 */
async function spawnEnablePacks(catalog: DeployCatalog): Promise<SpawnResult> {
  const { bdsRoot, levelName } = resolveBdsContext();
  const worldsDir = path.join(bdsRoot, "worlds");
  let output = "";
  const bpArgs = [
    "enable-pack",
    "--worlds-dir",
    worldsDir,
    "--level",
    levelName,
    "--kind",
    "behavior",
    "--pack-id",
    catalog.bpUuid,
    "--version",
    catalog.bpVersion.join(","),
  ];
  const bpR = await spawnPackManager(bpArgs);
  output += bpR.output;
  if (bpR.code !== 0) return { code: bpR.code, output };
  pushLog(
    `enabled behavior pack ${catalog.bpUuid} in world list`,
    "pack",
    "info"
  );
  if (catalog.rpUuid && catalog.rpVersion) {
    const rpArgs = [
      "enable-pack",
      "--worlds-dir",
      worldsDir,
      "--level",
      levelName,
      "--kind",
      "resource",
      "--pack-id",
      catalog.rpUuid,
      "--version",
      catalog.rpVersion.join(","),
    ];
    const rpR = await spawnPackManager(rpArgs);
    output += rpR.output;
    if (rpR.code !== 0) return { code: rpR.code, output };
    pushLog(
      `enabled resource pack ${catalog.rpUuid} in world list`,
      "pack",
      "info"
    );
  }
  return { code: 0, output };
}

/** spawn disable-pack verb：清理过期 UUID（uuid 轮换 / 不再提供 RP）。 */
async function spawnDisableStale(
  current: DeployCatalog,
  bdsRoot: string,
  levelName: string
): Promise<void> {
  const previous = await collectDeployedPackUuids(bdsRoot, levelName);
  const worldsDir = path.join(bdsRoot, "worlds");
  for (const staleRp of previous.rp) {
    if (staleRp === (current.rpUuid ?? null)) continue;
    const r = await spawnPackManager([
      "disable-pack",
      "--worlds-dir",
      worldsDir,
      "--level",
      levelName,
      "--kind",
      "resource",
      "--pack-id",
      staleRp,
      "--version",
      "1,0,0",
    ]);
    if (r.code === 0) {
      pushLog(`disabled stale resource pack ${staleRp}`, "pack", "info");
    } else {
      pushLog(
        `disable stale RP ${staleRp} failed: ${r.output.trim()}`,
        "pack",
        "warn"
      );
    }
  }
  for (const staleBp of previous.bp) {
    if (staleBp === current.bpUuid) continue;
    const r = await spawnPackManager([
      "disable-pack",
      "--worlds-dir",
      worldsDir,
      "--level",
      levelName,
      "--kind",
      "behavior",
      "--pack-id",
      staleBp,
      "--version",
      "1,0,0",
    ]);
    if (r.code === 0) {
      pushLog(`disabled stale behavior pack ${staleBp}`, "pack", "info");
    } else {
      pushLog(
        `disable stale BP ${staleBp} failed: ${r.output.trim()}`,
        "pack",
        "warn"
      );
    }
  }
}

/** 通过 bds-tools 的 list-installed + read-manifest 拿到 deployed UUID（spawn）。 */
async function collectDeployedPackUuids(
  bdsRoot: string,
  levelName: string
): Promise<{ bp: Set<string>; rp: Set<string> }> {
  const bp = new Set<string>();
  const rp = new Set<string>();
  const cat = readDeployedCatalog(bdsRoot, levelName);
  if (cat?.bpUuid) bp.add(cat.bpUuid);
  if (cat?.rpUuid) rp.add(cat.rpUuid);
  // 通过 read-manifest 看世界磁盘 BP/RP manifest 的 uuid，作为 catalog 缺失时的兜底。
  const bpDir = path.join(bdsRoot, "worlds", levelName, "behavior_packs", BP_NAME);
  const rpDir = path.join(bdsRoot, "worlds", levelName, "resource_packs", RP_NAME);
  const bpR = await spawnPackManager(["read-manifest", "--pack-dir", bpDir]);
  if (bpR.code === 0) {
    try {
      const j = JSON.parse(bpR.output.trim()) as { uuid?: string } | null;
      if (j?.uuid) bp.add(j.uuid);
    } catch {
      /* ignore */
    }
  }
  const rpR = await spawnPackManager(["read-manifest", "--pack-dir", rpDir]);
  if (rpR.code === 0) {
    try {
      const j = JSON.parse(rpR.output.trim()) as { uuid?: string } | null;
      if (j?.uuid) rp.add(j.uuid);
    } catch {
      /* ignore */
    }
  }
  return { bp, rp };
}

/** spawn ensure-permission verb。 */
async function spawnEnsurePermission(catalog: DeployCatalog): Promise<SpawnResult> {
  const { bdsRoot } = resolveBdsContext();
  const r = await spawnPackManager([
    "ensure-permission",
    "--bds-root",
    bdsRoot,
    "--pack-id",
    catalog.bpUuid,
  ]);
  return r;
}

/**
 * `sfmc mod build` —— 组装 BP + RP（不部署）。
 * 仅当 catalog 与世界内已部署不一致时执行；否则直接打"已同步"。
 */
export async function cmdModuleBuild(_args: string[]): Promise<string> {
  try {
    const { bdsRoot, levelName } = resolveBdsContext();
    const deployed = readDeployedCatalog(bdsRoot, levelName);
    const desired = await computeDesiredCatalog(deployed ? reusePackIds(deployed) : undefined);

    if (deployed && catalogsEqual(desired, deployed)) {
      return formatPackLoadInfo(desired, false);
    }

    pushLog(
      `building BP/RP (modules=${Object.keys(desired.modules).length})…`,
      "pack",
      "info"
    );
    await bundleBehaviorPackScript();

    const mods = await scanLocalModules();
    const rpDirs: Record<string, string> = {};
    for (const m of mods) {
      if (!m.enabled || !m.hasResourcePack) continue;
      rpDirs[m.folderId] = path.join("modules", "packages", m.folderId, "resource_pack");
    }

    const bpR = await spawnAssembleBp(desired);
    if (bpR.code !== 0) return c.red(bpR.output.trim() || `assemble-bp exit ${bpR.code}`);
    const rpR = await spawnAssembleRp(desired, rpDirs);
    if (rpR.code !== 0) return c.red(rpR.output.trim() || `assemble-rp exit ${rpR.code}`);

    desired.generatedAt = Date.now();
    if (Object.keys(rpDirs).length === 0) {
      desired.rpUuid = null;
      desired.rpVersion = null;
    }
    writeJson(path.join(bpOut(), DEPLOY_CATALOG_NAME), desired);

    return c.green(t("pack.built", { path: bpOut() })) + "\n" + formatPackLoadInfo(desired, true);
  } catch (e) {
    return c.red((e as Error).message);
  }
}

/**
 * `sfmc mod reload [--build-only]` —— 组装 + 部署 + 清理过期 + 写权限 + （默认）发 reload 到 BDS。
 */
export async function cmdModuleReload(args: string[]): Promise<string> {
  const buildOnly = args.includes("--build-only");
  const parts: string[] = [];

  const buildMsg = await cmdModuleBuild([]);
  parts.push(buildMsg.trimEnd());
  if (buildMsg.startsWith(c.red(""))) return parts.join("\n") + "\n";

  try {
    const { bdsRoot, levelName } = resolveBdsContext();
    const desired = await computeDesiredCatalog();

    const depR = await spawnDeploy(desired);
    if (depR.code !== 0) {
      return parts.join("\n") + "\n" + c.red(depR.output.trim() || `deploy exit ${depR.code}`);
    }
    parts.push(depR.output.trimEnd());

    writeJson(path.join(deployedBpDir(bdsRoot, levelName), DEPLOY_CATALOG_NAME), desired);

    await spawnDisableStale(desired, bdsRoot, levelName);

    const enR = await spawnEnablePacks(desired);
    if (enR.code !== 0) {
      return parts.join("\n") + "\n" + c.red(enR.output.trim() || `enable-pack exit ${enR.code}`);
    }
    parts.push(enR.output.trimEnd());

    const perR = await spawnEnsurePermission(desired);
    if (perR.code !== 0) {
      return parts.join("\n") + "\n" + c.red(perR.output.trim() || `ensure-permission exit ${perR.code}`);
    }
    parts.push(perR.output.trimEnd());
  } catch (e) {
    return parts.join("\n") + "\n" + c.red((e as Error).message);
  }

  if (buildOnly) {
    parts.push(c.dim(t("reload.buildOnly")));
    return parts.join("\n") + "\n";
  }

  const { isServiceRunning } = await import("./services.js");
  if (!(await isServiceRunning("bds"))) {
    parts.push(c.yellow(t("reload.bdsNotRunning")));
    return parts.join("\n") + "\n";
  }
  const { cmdSend } = await import("./commands.js");
  parts.push((await cmdSend("bds", "reload")).trimEnd());
  parts.push(c.green(t("reload.sent")));
  return parts.join("\n") + "\n";
}

function reusePackIds(
  deployed: DeployCatalog
): Parameters<typeof computeDesiredCatalog>[0] {
  return {
    bpUuid: deployed.bpUuid,
    rpUuid: deployed.rpUuid,
    bpVersion: deployed.bpVersion,
    rpVersion: deployed.rpVersion,
    ...(deployed.bpModuleUuid ? { bpModuleUuid: deployed.bpModuleUuid } : {}),
    ...(deployed.rpModuleUuid ? { rpModuleUuid: deployed.rpModuleUuid } : {}),
  };
}