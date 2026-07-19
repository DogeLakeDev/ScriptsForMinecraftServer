export declare function resolveRuntimeRoot(fallbackRoot: string): string;
export declare function configDir(runtimeRoot: string): string;
export declare function configPath(runtimeRoot: string, name: string): string;
export declare function modulePath(runtimeRoot: string, name: string): string;
export declare function readJson<T>(filePath: string, fallback: T): T;
export declare function resolveRuntimePath(runtimeRoot: string, configuredPath: string): string;
