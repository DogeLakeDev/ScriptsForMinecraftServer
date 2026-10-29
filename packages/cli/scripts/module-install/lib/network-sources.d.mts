/**
 * network-sources.mjs 的类型声明。
 * 使用场景：cli/src 下的 TypeScript（平台版本检查、平台升级、CLI 模块索引）直接导入这份共用实现。
 */
export declare const OFFICIAL_NPM_REGISTRY: string;
export declare const DEFAULT_REGISTRY_REPO: string;
export declare const DEFAULT_REGISTRY_TAG: string;
export declare const MODULE_INDEX_URLS: string[];
export declare function normalizeRegistry(value: unknown): string | null;
export declare function configuredNpmRegistry(root?: string): string;
export declare function npmRegistries(root?: string): string[];
export declare function npmMetadataUrls(pathname: string, root?: string): string[];
export declare function fetchFirstJson(
  urls: string[],
  options?: { headers?: Record<string, string>; timeoutMs?: number },
): Promise<{ url: string; json: unknown }>;
export declare function withNpmRegistry<T>(run: (registry: string) => Promise<T>, root?: string): Promise<T>;
