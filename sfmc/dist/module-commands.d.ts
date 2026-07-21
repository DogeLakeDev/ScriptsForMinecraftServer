/**
 * sfmc module-commands — runtime CLI for inspecting and managing modules
 * already on disk under `modules/packages/<id>/`.
 *
 * Subcommands:
 *   list                    List every installed module (reads each
 *                           modules/packages/<id>/sapi/manifest.json)
 *   info <id>               Show one module's manifest + on-disk fingerprint
 *   verify [id]             Recompute the SHA-256 fingerprint of installed
 *                           modules (id = one; no id = all)
 *   install <id>            Wrapper around `tools/fetch-module.mjs install`
 *                           so the SEA-mode CLI has a single entry point.
 *                           The CLI itself stays offline (it just shells out).
 *   uninstall <id>          Remove modules/packages/<id>/
 *
 * The runtime SEA process never connects to the network. `install` simply
 * delegates to the build-time helper `tools/fetch-module.mjs`, which handles
 * GitHub / local sources. That keeps the SEA image self-contained.
 */
export declare function cmdModuleList(_args: string[]): Promise<string>;
export declare function cmdModuleInfo(args: string[]): Promise<string>;
export declare function cmdModuleVerify(args: string[]): Promise<string>;
export declare function cmdModuleInstall(args: string[]): Promise<string>;
export declare function cmdModuleUninstall(args: string[]): Promise<string>;
//# sourceMappingURL=module-commands.d.ts.map