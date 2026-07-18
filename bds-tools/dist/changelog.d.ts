/**
 * changelog.ts — 更新日志抓取 (官方页面)
 */
import type { ChangelogPayload } from "./types.js";
declare const CHANGELOG_BASE = "https://feedback.minecraft.net/hc/en-us/sections/360001186971";
/** 抓取当前版本的更新说明 (文本 + 首张图 base64) */
export declare function fetchChangelog(channel: string): Promise<ChangelogPayload | null>;
export { CHANGELOG_BASE };
//# sourceMappingURL=changelog.d.ts.map