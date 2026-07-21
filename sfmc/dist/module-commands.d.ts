/**
 * sfmc module-commands — runtime CLI for inspecting and managing modules
 * already on disk under `modules/packages/<id>/`.
 *
 * Subcommands:
 *   list                    List every installed module (reads each
 *                           modules/packages/<id>/sapi/manifest.json).
 *                           Marks registry-known modules with `●` and
 *                           modules from an unknown publisher with `?`.
 *   info <id>               Show one module's manifest + on-disk fingerprint
 *   verify [id]             Recompute the SHA-256 fingerprint of installed
 *                           modules (id = one; no id = all)
 *   install <id>            Wrapper around `tools/fetch-module.mjs install`.
 *                           If `--from` is omitted, the first-party registry
 *                           is consulted (Tanya7z/sfmc-modules).
 *   uninstall <id>          Remove modules/packages/<id>/
 *   enable <id>             POST /api/sfmc/modules/:id/enable on db-server
 *   disable <id>            POST /api/sfmc/modules/:id/disable on db-server
 *
 * The runtime SEA process never connects to the network. `install` simply
 * delegates to the build-time helper `tools/fetch-module.mjs`, which handles
 * GitHub / local sources. enable/disable go through db-server's existing
 * REST endpoints so module-lock.json stays the single source of truth.
 */
export declare function cmdModuleList(_args: string[]): Promise<string>;
/**
 * Walk `modules/packages/<id>/` and print a one-line yellow warning for each
 * id that isn't in the first-party registry. Intended for the REPL startup
 * hook so users immediately see modules they installed from somewhere else.
 *
 * Best-effort: registry unreachable → no warning (no false positives).
 */
export declare function scanAndWarnUnknown(): Promise<string>;
export declare function cmdModuleInfo(args: string[]): Promise<string>;
export declare function cmdModuleVerify(args: string[]): Promise<string>;
export declare function cmdModuleEnable(args: string[]): Promise<string>;
export declare function cmdModuleDisable(args: string[]): Promise<string>;
export declare function cmdModuleInstall(args: string[]): Promise<string>;
export declare function cmdModuleUninstall(args: string[]): Promise<string>;
//# sourceMappingURL=module-commands.d.ts.map