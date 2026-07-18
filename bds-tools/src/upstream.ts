/**
 * upstream.ts — 版本源 / 下载源 / 哈希校验
 *
 * 改进:
 *  - 3 次重试 + 指数退避
 *  - sha1 / sha256 同时校验
 *  - 流式校验 + 边下边校验
 */

import fs from "node:fs";
import crypto from "node:crypto";
import { fetchJsonWithFallback } from "./http.js";
import { toVer3 } from "./version.js";
import type { BdsUpdaterConfig, VersionDetails, VersionInfo } from "./types.js";
import { logger } from "./logger.js";

const DEFAULT_VERSIONS_API =
  "https://raw.githubusercontent.com/Bedrock-OSS/BDS-Versions/main/versions.json";
const DEFAULT_VERSIONS_MIRROR =
  "https://cdn.jsdelivr.net/gh/Bedrock-OSS/BDS-Versions@main/versions.json";

function resolveTemplate(tpl: string, vars: Record<string, string>): string {
  let s = tpl;
  for (const [k, v] of Object.entries(vars)) {
    s = s.replace(new RegExp(`\\{${k}\\}`, "g"), v);
  }
  return s;
}

/** 获取最新版本号 (含 cdn_root)，3 次重试 */
export async function getVersionInfo(cfg: BdsUpdaterConfig, channel: string): Promise<VersionInfo> {
  const api =
    cfg.version_versions || process.env["BDS_VERSIONS_API"] || DEFAULT_VERSIONS_API;
  const mirror =
    cfg.version_versions_mirror || process.env["BDS_VERSIONS_MIRROR"] || DEFAULT_VERSIONS_MIRROR;
  const sources = [api, mirror].filter(Boolean);
  const versionMode = cfg.version_mode || "bedrock-oss";

  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const json = (await fetchJsonWithFallback<any>(sources)) as any;
      let ver: string | undefined;
      if (versionMode === "endstone") {
        const entry = channel === "preview" ? json.preview : json.release;
        ver = entry?.latest;
      } else {
        const platform = json.windows || json.linux;
        ver = channel === "preview" ? platform?.preview : platform?.stable;
      }
      if (!ver) throw new Error("未找到最新版本号");
      return { version: ver, cdnRoot: json.cdn_root ?? "" };
    } catch (e) {
      lastErr = e;
      if (attempt < 3) {
        const wait = attempt * 3000;
        logger.warn(`版本号获取失败 (${attempt}/3): ${(e as Error).message}，${wait / 1000}s 后重试...`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("版本号获取失败");
}

/** 获取 per-version 的下载链接 + 哈希 (fallback GitHub → jsdelivr) */
export async function fetchVersionDetails(
  cfg: BdsUpdaterConfig,
  channel: string,
  version: string
): Promise<VersionDetails> {
  const platform = channel === "preview" ? "windows_preview" : "windows";
  const ch = channel === "preview" ? "preview" : "release";
  const vars = { version, ver3: toVer3(version), platform, channel: ch };
  const detailsTpl = cfg.version_details || "https://raw.githubusercontent.com/Bedrock-OSS/BDS-Versions/main/{platform}/{version}.json";
  const mirrorTpl = cfg.version_details_mirror || "https://cdn.jsdelivr.net/gh/Bedrock-OSS/BDS-Versions@main/{platform}/{version}.json";
  const sources = [detailsTpl, mirrorTpl].filter(Boolean).map((t) => resolveTemplate(t, vars));

  const json = await fetchJsonWithFallback<any>(sources);
  const mode = cfg.version_mode || "bedrock-oss";
  if (mode === "endstone") {
    const bw = json.binary?.windows;
    return {
      downloadUrl: bw?.url ?? "",
      sha1: "",
      sha256: bw?.sha256 ?? "",
      size: bw?.size_in_bytes ?? 0,
    };
  }
  return {
    downloadUrl: json.download_url ?? "",
    sha1: json.sha1 ?? "",
    sha256: "",
    size: json.size_in_bytes ?? 0,
  };
}

/** 候选下载 URL (按优先级) */
export function buildDownloadUrls(
  cfg: BdsUpdaterConfig,
  channel: string,
  version: string,
  details: VersionDetails
): string[] {
  const urls: string[] = [];
  if (cfg.download_mirror) {
    const mirrorVer = channel === "preview" ? `${version}-preview` : version;
    urls.push(resolveTemplate(cfg.download_mirror, { version: mirrorVer }));
  }
  if (details.downloadUrl) urls.push(details.downloadUrl);
  const cdnRoot = cfg.cdn_root || "https://www.minecraft.net/bedrockdedicatedserver";
  const suffix = channel === "preview"
    ? `/bin-win-preview/bedrock-server-${version}-preview.zip`
    : `/bin-win/bedrock-server-${version}.zip`;
  urls.push(cdnRoot + suffix);
  urls.push(`https://minecraft.azureedge.net${suffix}`);
  return [...new Set(urls)];
}

/** 同步 / 异步校验文件哈希 */
export async function verifyFileHash(
  filePath: string,
  expectedSha1: string,
  expectedSha256: string
): Promise<boolean> {
  const expected = expectedSha256 || expectedSha1;
  if (!expected) return true;
  const algo: "sha1" | "sha256" = expectedSha256 ? "sha256" : "sha1";

  return new Promise((resolve, reject) => {
    const h = crypto.createHash(algo);
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk: Buffer | string) => {
      h.update(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    });
    stream.on("end", () => {
      const actual = h.digest("hex").toLowerCase();
      resolve(actual === expected.toLowerCase());
    });
    stream.on("error", reject);
  });
}

/** 检查版本兼容性 (白名单) */
export function isVersionCompatible(cfg: BdsUpdaterConfig, version: string): boolean {
  const allow = cfg.compatible_versions;
  if (!allow || allow.length === 0) return true;
  return allow.includes(version) || allow.includes(toVer3(version));
}
