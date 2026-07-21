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
export declare const BP_NAME = "sfmc-modules";
export declare const RP_NAME = "sfmc-modules-rp";
/** Build 输出根: <ROOT>/build/ */
export declare function buildRoot(): string;
/** Build 中间产物的 BP 源目录(已经被 esbuild 写过 scripts/main.js):<ROOT>/build/sfmc-modules-bp/ */
export declare function bpSrc(): string;
/** 最终装配好的 BP 目录(assemble-bp 后写到此处,deploy 从这里拷到 BDS):<ROOT>/build/sfmc-modules/ */
export declare function bpOut(): string;
/** RP 装配结果:<ROOT>/build/sfmc-modules-rp/ */
export declare function rpOut(): string;
/**
 * Walk modules/packages/<id>/sapi/src/index.ts and produce a list of entry
 * paths. Modules without sapi/ are skipped silently.
 */
export declare function listEnabledEntries(): Promise<string[]>;
/**
 * Run esbuild to bundle every enabled module entry into a single script.
 * This function returns the output path. On failure it throws — the CLI
 * surfaces the error message back to the user.
 *
 * NOTE: Commits 4 doesn't pull in esbuild as a runtime dep. This function
 * is therefore only usable from the npm path; the SEA path needs the
 * platform binary embed (Stage K follow-up).
 */
export declare function bundleScripts(): Promise<string>;
/** Build the BP from already-bundled scripts + assemble via pack-manager. */
export declare function cmdBehaviorPackBuild(_args: string[]): Promise<string>;
/** Deploy the assembled BP + RP into the BDS world's behavior_packs folder. */
export declare function cmdBehaviorPackDeploy(_args: string[]): Promise<string>;
//# sourceMappingURL=commands-behavior-pack.d.ts.map