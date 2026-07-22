/**
 * commands-behavior-pack.ts — sfmc CLI commands `behavior-pack build` / `deploy`
 *
 * 设计:
 *   1. `build` = esbuild 聚合 modules/packages/<id>/sapi/src/index.ts → <ROOT>/build/sfmc-modules-bp/scripts/main.js
 *      然后 spawnService pack-manager assemble-bp 把那个目录装成完整 BP:
 *        - 拷 scripts/** 到 outDir/scripts/
 *        - 写一份 manifest.json (uuid 由 pack-manager 随机生成)
 *        - 写 permissions.json (7 项 @minecraft/*)
 *        - 拷 pack_icon.png (如提供)
 *   2. `deploy` = spawnService pack-manager deploy 拷到 worlds/<level>/behavior_packs/<bpName>/
 *      并写 permissions.json。enable/disable packs in world (写 world_behavior_packs.json)
 *      是单独命令 `behavior-pack enable-pack` / `disable-pack` — 因为 BDS 重启后
 *      才会读那个 JSON,与 build/deploy 顺序解耦。
 *
 */

import { configPath, readJson, type BdsUpdaterConfig } from "@sfmc-bds/sdk/node/config";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import PropertiesReader from "properties-reader";
import { ROOT, spawnServiceSync } from "./runtime.js";
import { c } from "./theme.js";

export const BP_NAME = "sfmc-modules";
export const RP_NAME = "sfmc-modules-rp";

/** Build 输出根: <ROOT>/build/ */
export function buildRoot(): string {
  return path.join(ROOT, "build");
}

/** Build 中间产物的 BP 源目录(已经被 esbuild 写过 scripts/main.js):<ROOT>/build/sfmc-modules-bp/ */
export function bpSrc(): string {
  return path.join(buildRoot(), `${BP_NAME}-bp`);
}

/** 最终装配好的 BP 目录(assemble-bp 后写到此处,deploy 从这里拷到 BDS):<ROOT>/build/sfmc-modules/ */
export function bpOut(): string {
  return path.join(buildRoot(), BP_NAME);
}

/** RP 装配结果:<ROOT>/build/sfmc-modules-rp/ */
export function rpOut(): string {
  return path.join(buildRoot(), RP_NAME);
}

/** Esbuild bundle 入口到输出路径表 */
const ENTRY_FILES = ["sapi", "src", "index.ts"];

/**
 * Walk modules/packages/<id>/sapi/src/index.ts and produce a list of entry
 * paths. Modules without sapi/ are skipped silently.
 */
export async function listEnabledEntries(): Promise<string[]> {
  const pkgDir = path.join(ROOT, "modules", "packages");
  try {
    const entries = await fs.readdir(pkgDir, { withFileTypes: true });
    const out: string[] = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const entry = path.join(pkgDir, e.name, ...ENTRY_FILES);
      if (existsSync(entry)) out.push(entry);
    }
    return out.sort();
  } catch {
    return [];
  }
}

/**
 * Run esbuild to bundle every enabled module entry into a single script.
 * This function returns the output path. On failure it throws — the CLI
 * surfaces the error message back to the user.
 *
 * NOTE: Commits 4 doesn't pull in esbuild as a runtime dep. This function
 * is therefore only usable from the npm path; the SEA path needs the
 * platform binary embed (Stage K follow-up).
 */
export async function bundleScripts(): Promise<string> {
  const { build } = await import("esbuild");
  const entries = await listEnabledEntries();
  const outFile = path.join(bpSrc(), "scripts", "main.js");
  await fs.mkdir(path.dirname(outFile), { recursive: true });
  if (entries.length === 0) {
    /* Empty bundle is legal: BDS still loads an empty main.js and the BP is
     * valid. The user just won't see anything until they install a module. */
    await fs.writeFile(outFile, "/* no modules enabled */\n", "utf8");
    return outFile;
  }
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
  });
  return outFile;
}

/** Build the BP from already-bundled scripts + assemble via pack-manager. */
export async function cmdBehaviorPackBuild(_args: string[]): Promise<string> {
  const scriptFile = await bundleScripts();
  if (!existsSync(scriptFile)) {
    return c.red(`bundle failed: ${scriptFile} missing`);
  }
  const proc = spawnServiceSync(
    "pack-manager",
    [
      "assemble-bp",
      "--src",
      bpSrc(),
      "--out",
      bpOut(),
      "--name",
      BP_NAME,
      "--version",
      "1,0,0",
      "--description",
      "ScriptsForMinecraftServer aggregated behavior pack",
    ],
    { encoding: "utf8" }
  );
  if (proc.status !== 0) {
    const stderr = (proc.stderr ?? "").toString();
    return c.red(`pack-manager assemble-bp failed: ${stderr}`);
  }
  return `${c.green(`built behavior pack at ${bpOut()}`)}\n${(proc.stdout ?? "").toString().trim()}\n`;
}

async function getServerProperties(bdsPath: string): Promise<Record<string, unknown>> {
  const properties = PropertiesReader({ sourceFile: path.join(bdsPath, "server.properties") });
  const levelName = properties.get("level-name") as string;
  return { levelName };
}

/** Deploy the assembled BP + RP into the BDS world's behavior_packs folder. */
export async function cmdBehaviorPackDeploy(_args: string[]): Promise<string> {
  const cfg = readJson(configPath(ROOT, "bds_updater.json")) as BdsUpdaterConfig;
  const bdsPath = cfg.bds_path;
  if (!bdsPath) {
    return c.red("deploy: bds_path not configured. Run `sfmc init` first.");
  }
  const p = await getServerProperties(bdsPath);
  const args = [
    "deploy",
    "--bds-root",
    bdsPath,
    "--level",
    p.levelName as string,
    "--bp-src",
    bpOut(),
    "--bp-name",
    BP_NAME,
  ];
  if (existsSync(rpOut())) {
    args.push("--rp-src", rpOut(), "--rp-name", RP_NAME);
  }
  const proc = spawnServiceSync("pack-manager", args as string[], { encoding: "utf8" });
  if (proc.status !== 0) {
    const stderr = (proc.stderr ?? "").toString();
    return c.red(`pack-manager deploy failed: ${stderr}`);
  }
  return `${c.green(`deployed to ${path.join(bdsPath, "worlds", p.levelName as string)}`)}\n${(proc.stdout ?? "").toString().trim()}\n`;
}

void process;

