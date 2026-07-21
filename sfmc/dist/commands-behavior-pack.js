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
 *      SEA 与 npm 路径都用同一份逻辑 — 区别只在 esbuild bundle 放在哪里:
 *        npm: <ROOT>/build/...
 *        SEA: <exe-dir>/build/...
 *   2. `deploy` = spawnService pack-manager deploy 拷到 worlds/<level>/behavior_packs/<bpName>/
 *      并写 permissions.json。enable/disable packs in world (写 world_behavior_packs.json)
 *      是单独命令 `behavior-pack enable-pack` / `disable-pack` — 因为 BDS 重启后
 *      才会读那个 JSON,与 build/deploy 顺序解耦。
 *
 * 注意事项:
 *   - 本文件不直接 import bds-tools/pack-manager;通过 spawnService 调到子进程。
 *     这样 SEA 模式下整个 dispatcher 里 bds-tools dist 走打包路径,esbuild 自己
 *     由 sfmc 的依赖里提供(SEA 嵌入 @esbuild/<platform>-x64)。
 *   - 这是 Commit 4 的骨架:build 的 esbuild 步骤实际留给 npm 模式跑通,SEA 模式
 *     这条路径在 SEA 内嵌 esbuild 完成后再启用。
 */
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { c } from "./theme.js";
import { ROOT, spawnServiceSync } from "./runtime.js";
export const BP_NAME = "sfmc-modules";
export const RP_NAME = "sfmc-modules-rp";
/** Build 输出根: <ROOT>/build/ */
export function buildRoot() {
    return path.join(ROOT, "build");
}
/** Build 中间产物的 BP 源目录(已经被 esbuild 写过 scripts/main.js):<ROOT>/build/sfmc-modules-bp/ */
export function bpSrc() {
    return path.join(buildRoot(), `${BP_NAME}-bp`);
}
/** 最终装配好的 BP 目录(assemble-bp 后写到此处,deploy 从这里拷到 BDS):<ROOT>/build/sfmc-modules/ */
export function bpOut() {
    return path.join(buildRoot(), BP_NAME);
}
/** RP 装配结果:<ROOT>/build/sfmc-modules-rp/ */
export function rpOut() {
    return path.join(buildRoot(), RP_NAME);
}
/** Esbuild bundle 入口到输出路径表 */
const ENTRY_FILES = ["sapi", "src", "index.ts"];
/**
 * Walk modules/packages/<id>/sapi/src/index.ts and produce a list of entry
 * paths. Modules without sapi/ are skipped silently.
 */
export async function listEnabledEntries() {
    const pkgDir = path.join(ROOT, "modules", "packages");
    try {
        const entries = await fs.readdir(pkgDir, { withFileTypes: true });
        const out = [];
        for (const e of entries) {
            if (!e.isDirectory())
                continue;
            const entry = path.join(pkgDir, e.name, ...ENTRY_FILES);
            if (existsSync(entry))
                out.push(entry);
        }
        return out.sort();
    }
    catch {
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
export async function bundleScripts() {
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
export async function cmdBehaviorPackBuild(_args) {
    const scriptFile = await bundleScripts();
    if (!existsSync(scriptFile)) {
        return c.red(`bundle failed: ${scriptFile} missing`);
    }
    const proc = spawnServiceSync("pack-manager", [
        "assemble-bp",
        "--src", bpSrc(),
        "--out", bpOut(),
        "--name", BP_NAME,
        "--version", "1,0,0",
        "--description", "ScriptsForMinecraftServer aggregated behavior pack",
    ], { encoding: "utf8" });
    if (proc.status !== 0) {
        const stderr = (proc.stderr ?? "").toString();
        return c.red(`pack-manager assemble-bp failed: ${stderr}`);
    }
    return `${c.green(`built behavior pack at ${bpOut()}`)}\n${(proc.stdout ?? "").toString().trim()}\n`;
}
/** Deploy the assembled BP + RP into the BDS world's behavior_packs folder. */
export async function cmdBehaviorPackDeploy(_args) {
    const cfg = await loadBdsConfig();
    if (!cfg.bdsRoot) {
        return c.red("deploy: bds_root not configured. Run `sfmc init` first.");
    }
    const args = [
        "deploy",
        "--bds-root", cfg.bdsRoot,
        "--level", cfg.levelName,
        "--bp-src", bpOut(),
        "--bp-name", BP_NAME,
    ];
    if (existsSync(rpOut())) {
        args.push("--rp-src", rpOut(), "--rp-name", RP_NAME);
    }
    const proc = spawnServiceSync("pack-manager", args, { encoding: "utf8" });
    if (proc.status !== 0) {
        const stderr = (proc.stderr ?? "").toString();
        return c.red(`pack-manager deploy failed: ${stderr}`);
    }
    return `${c.green(`deployed to ${path.join(cfg.bdsRoot, "worlds", cfg.levelName)}`)}\n${(proc.stdout ?? "").toString().trim()}\n`;
}
async function loadBdsConfig() {
    /* Reads bds_updater.json (shared with bds-tools). When missing, fall back
     * to db_config.json's `bds_root` and let pack-manager#readLevelName resolve
     * the level-name from server.properties at deploy time. */
    const cfgPath = path.join(ROOT, "configs", "bds_updater.json");
    let bdsRoot = null;
    try {
        const raw = await fs.readFile(cfgPath, "utf8");
        const cfg = JSON.parse(raw);
        if (cfg.bds_path)
            bdsRoot = path.resolve(ROOT, cfg.bds_path);
    }
    catch {
        /* fall through */
    }
    if (!bdsRoot) {
        const dbCfgPath = path.join(ROOT, "configs", "db_config.json");
        try {
            const raw = await fs.readFile(dbCfgPath, "utf8");
            const cfg = JSON.parse(raw);
            if (cfg.bds_root)
                bdsRoot = path.resolve(ROOT, cfg.bds_root);
        }
        catch {
            /* no config yet */
        }
    }
    /* levelName resolved by pack-manager via server.properties — default to
     * empty so the CLI flag can still be passed; the spawnService call above
     * uses cfg.levelName but we leave it empty here and let server.properties
     * parsing happen server-side. TODO Commit 5: move readLevelName here so
     * error messages can be more specific. */
    return { bdsRoot, levelName: "" };
}
void process;
//# sourceMappingURL=commands-behavior-pack.js.map