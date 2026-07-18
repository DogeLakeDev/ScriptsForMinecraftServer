/**
 * version.ts — 版本号工具 / 版本缓存
 */
/** 4段 → 3段 (去尾) */
export declare function toVer3(v: string): string;
/** 3段 → 4段 (补 0) */
export declare function toVer4(v: string): string;
/** 版本比较 (按 4 段数字排序) */
export declare function compareVersions(a: string, b: string): number;
/** 简单的真值校验 (按版本号外形) */
export declare function isValidVersion(v: string): boolean;
export declare function saveVersionCache(version: string, sha256: string): void;
/**
 * 异步识别当前 BDS 版本
 * 优先通过 SHA256 反查缓存，失败则回退 `current_version.txt`（如果存在）
 */
export declare function getCurrentVersionAsync(exePath: string): Promise<string>;
/** 同步版本 (兼容旧流程) */
export declare function getCurrentVersionSync(exePath: string): string;
//# sourceMappingURL=version.d.ts.map