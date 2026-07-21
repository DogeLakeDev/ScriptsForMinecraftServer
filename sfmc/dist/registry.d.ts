/**
 * registry.ts — first-party sfmc-modules index resolution, shared between
 * the module CLI and the startup unknown-source warning.
 *
 * Talks to https://raw.githubusercontent.com/Shiroha7z/sfmc-modules/main/index.json
 * (the registry lives in a separate repo to keep this one free of "what
 * modules exist" governance). Caches to <sfmc/src/.sfmc-registry-cache.json>
 * with a 1h TTL so a brief network blip doesn't degrade the CLI.
 *
 * Both helpers are best-effort: failures are surfaced as `null` and a
 * console warning, never an exception, because the SEA must still boot
 * when the registry is unreachable.
 */
declare const DEFAULT_REGISTRY_REPO = "Shiroha7z/sfmc-modules";
declare const DEFAULT_REGISTRY_TAG = "main";
export interface RegistryEntry {
    repo: string;
    tag: string;
}
export type RegistryIndex = Record<string, RegistryEntry>;
export interface RegistryResult {
    index: RegistryIndex;
    /** True when the index came from a stale cache because the live fetch failed. */
    stale: boolean;
}
/**
 * Resolve the first-party index.
 *
 * Order:
 *   1. If the cache is fresh (< TTL): return it without trying the network.
 *   2. Otherwise attempt a live fetch.
 *      - success → write cache, return fresh.
 *      - failure + cache exists → return cache with `stale: true` and a warning.
 *      - failure + no cache → return `{ index: {}, stale: true }` and warn.
 *
 * Never throws: the unknown-source warning is best-effort.
 */
export declare function resolveRegistryIndex(): Promise<RegistryResult>;
/**
 * Compare a set of installed module ids to the registry and return the
 * subset that isn't published in the first-party index. The "best-effort"
 * guarantee: this returns an empty array when the registry can't be reached
 * (we don't want a network outage to mark every local module as unknown).
 */
export declare function findUnknownModules(installedIds: string[]): Promise<string[]>;
export { DEFAULT_REGISTRY_REPO, DEFAULT_REGISTRY_TAG };
//# sourceMappingURL=registry.d.ts.map