/**
 * upstream.ts — 版本源 / 下载源 / 哈希校验
 *
 * 改进:
 *  - 3 次重试 + 指数退避
 *  - sha1 / sha256 同时校验
 *  - 流式校验 + 边下边校验
 */
import type { BdsUpdaterConfig, VersionDetails, VersionInfo } from "./types.js";
/** 获取最新版本号 (含 cdn_root)，3 次重试 */
export declare function getVersionInfo(cfg: BdsUpdaterConfig, channel: string): Promise<VersionInfo>;
/** 获取 per-version 的下载链接 + 哈希 (fallback GitHub → jsdelivr) */
export declare function fetchVersionDetails(cfg: BdsUpdaterConfig, channel: string, version: string): Promise<VersionDetails>;
/** 候选下载 URL (按优先级) */
export declare function buildDownloadUrls(cfg: BdsUpdaterConfig, channel: string, version: string, details: VersionDetails): string[];
/** 同步 / 异步校验文件哈希 */
export declare function verifyFileHash(filePath: string, expectedSha1: string, expectedSha256: string): Promise<boolean>;
/** 检查版本兼容性 (白名单) */
export declare function isVersionCompatible(cfg: BdsUpdaterConfig, version: string): boolean;
//# sourceMappingURL=upstream.d.ts.map