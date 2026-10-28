/**
 * upstream.ts — BDS 上游版本源、多镜像下载与完整性校验
 *
 * 核心机制：
 * - 多源容灾：官方源与镜像源并行竞争与多轮指数退避重试
 * - 动态 URL 模板渲染：根据操作系统架构与更新通道计算下载地址
 * - 流式哈希校验：支持 SHA-1 与 SHA-256 完整性流式计算校验
 * - 版本白名单兼容门禁：防止自动升级至未验证版本
 */

import crypto from "node:crypto";
import fs from "node:fs";
import { bdsCdnZipSuffix, bdsDetailsPlatformKey, bdsHostOs, type BdsHostOs } from "./host-platform.js";
import { fetchJsonWithFallback, httpGetJson } from "./http.js";
import { log } from "./log.js";
import type { BdsUpdaterConfig, VersionDetails, VersionInfo } from "./types.js";
import { toVer3 } from "./version.js";

const DEFAULT_VERSIONS_API = "https://raw.githubusercontent.com/Bedrock-OSS/BDS-Versions/main/versions.json";
const DEFAULT_VERSIONS_MIRROR = "https://cdn.jsdelivr.net/gh/Bedrock-OSS/BDS-Versions@main/versions.json";

/**
 * Mojang 官方下载链接接口：返回各平台当前正式版 / 预览版 BDS 的下载地址（文件名带版本号）。
 * 使用场景：getVersionInfo 的首选版本源。GitHub raw 在部分网络下不可达，jsDelivr 镜像在新版本发布初期
 * 会返回旧缓存，导致检查结果时新时旧；官方接口无此问题。
 */
const OFFICIAL_LINKS_API = "https://net-secondary.web.minecraft-services.net/api/v1.0/download/links";
const OFFICIAL_LINKS_TIMEOUT_MS = 15_000;

/** 官方接口解析结果：当前通道与平台的 BDS 版本号及其官方下载地址。 */
export interface OfficialServerLink {
  version: string;
  downloadUrl: string;
}

/**
 * 官方接口中当前通道与平台对应的 downloadType，例如 serverBedrockWindows、serverBedrockPreviewLinux。
 * 使用场景：parseOfficialServerLink 从 links 列表中挑选条目。
 */
function officialDownloadType(channel: string, hostOs: BdsHostOs): string {
  const preview = channel === "preview" ? "Preview" : "";
  const os = hostOs === "windows" ? "Windows" : "Linux";
  return `serverBedrock${preview}${os}`;
}

/**
 * 从官方接口响应中解析当前通道与平台的 BDS 版本号与下载地址；结构不符或地址中没有版本号时返回 null。
 * 使用场景：fetchOfficialServerLink；单独导出便于离线校验解析规则。
 */
export function parseOfficialServerLink(json: unknown, channel: string, hostOs: BdsHostOs): OfficialServerLink | null {
  const links = (json as { result?: { links?: unknown } } | null)?.result?.links;
  if (!Array.isArray(links)) return null;
  const type = officialDownloadType(channel, hostOs);
  const entry = links.find((l: { downloadType?: unknown }) => l?.downloadType === type) as
    | { downloadUrl?: unknown }
    | undefined;
  const url = typeof entry?.downloadUrl === "string" ? entry.downloadUrl : "";
  const m = /bedrock-server-(\d+(?:\.\d+){2,3})(?:-preview)?\.zip$/i.exec(url);
  return m ? { version: m[1]!, downloadUrl: url } : null;
}

/**
 * 请求官方接口并解析当前通道的 BDS 版本；请求失败或解析不到时记录警告并返回 null，由调用方回退到 Bedrock-OSS 版本列表。
 * 使用场景：getVersionInfo 在 bedrock-oss 模式且未自定义版本列表地址时优先调用。
 */
async function fetchOfficialServerLink(channel: string, hostOs: BdsHostOs): Promise<OfficialServerLink | null> {
  try {
    const json = await httpGetJson<unknown>(OFFICIAL_LINKS_API, { totalTimeoutMs: OFFICIAL_LINKS_TIMEOUT_MS });
    const link = parseOfficialServerLink(json, channel, hostOs);
    if (!link) log.warn("官方下载接口中没有当前通道的 BDS 下载地址，改用 Bedrock-OSS 版本列表");
    return link;
  } catch (e) {
    log.warn(`官方下载接口不可用: ${(e as Error).message}，改用 Bedrock-OSS 版本列表`);
    return null;
  }
}

function resolveTemplate(tpl: string, vars: Record<string, string>): string {
  let s = tpl;
  for (const [k, v] of Object.entries(vars)) {
    s = s.replace(new RegExp(`\\{${k}\\}`, "g"), v);
  }
  return s;
}

/**
 * 获取 BDS 最新可用版本信息（支持重试与指数退避）。
 * bedrock-oss 模式且未自定义版本列表地址（version_versions / BDS_VERSIONS_API）时，先查 Mojang 官方下载接口，
 * 失败再用 Bedrock-OSS 版本列表（GitHub raw 与 jsDelivr 镜像）。
 *
 * @param cfg BDS 更新器配置。
 * @param channel 更新通道（如 "release" 或 "preview"）。
 * @param hostOs 目标主机操作系统类型。
 * @returns 包含最新版本号与 CDN 根路径的信息对象。
 */
export async function getVersionInfo(

  cfg: BdsUpdaterConfig,
  channel: string,
  hostOs: BdsHostOs = bdsHostOs()
): Promise<VersionInfo> {
  const customApi = cfg.version_versions || process.env["BDS_VERSIONS_API"];
  const api = customApi || DEFAULT_VERSIONS_API;
  const mirror = cfg.version_versions_mirror || process.env["BDS_VERSIONS_MIRROR"] || DEFAULT_VERSIONS_MIRROR;
  const sources = [api, mirror].filter(Boolean);
  const versionMode = cfg.version_mode || "bedrock-oss";

  // 自定义了版本列表地址或使用 endstone 时尊重原配置，不查官方接口
  if (versionMode === "bedrock-oss" && !customApi) {
    const official = await fetchOfficialServerLink(channel, hostOs);
    if (official) return { version: official.version, cdnRoot: "", downloadUrl: official.downloadUrl };
  }

  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const json = await fetchJsonWithFallback<any>(sources);
      let ver: string | undefined;
      if (versionMode === "endstone") {
        const entry = channel === "preview" ? json.preview : json.release;
        ver = entry?.latest;
      } else {
        const platform = hostOs === "windows" ? json.windows || json.linux : json.linux || json.windows;
        ver = channel === "preview" ? platform?.preview : platform?.stable;
      }
      if (!ver) throw new Error("未找到最新版本号");
      return { version: ver, cdnRoot: json.cdn_root ?? "" };
    } catch (e) {
      lastErr = e;
      if (attempt < 3) {
        const wait = attempt * 3000;
        log.warn(`版本号获取失败 (${attempt}/3): ${(e as Error).message}，${wait / 1000}s 后重试...`);
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
  version: string,
  hostOs: BdsHostOs = bdsHostOs()
): Promise<VersionDetails> {
  const platform = bdsDetailsPlatformKey(channel, hostOs);
  const ch = channel === "preview" ? "preview" : "release";
  const vars = { version, ver3: toVer3(version), platform, channel: ch };
  const detailsTpl =
    cfg.version_details || "https://raw.githubusercontent.com/Bedrock-OSS/BDS-Versions/main/{platform}/{version}.json";
  const mirrorTpl =
    cfg.version_details_mirror || "https://cdn.jsdelivr.net/gh/Bedrock-OSS/BDS-Versions@main/{platform}/{version}.json";
  const sources = [detailsTpl, mirrorTpl].filter(Boolean).map((t) => resolveTemplate(t, vars));

  const json = await fetchJsonWithFallback<any>(sources);
  const mode = cfg.version_mode || "bedrock-oss";
  if (mode === "endstone") {
    const bw = hostOs === "windows" ? json.binary?.windows : json.binary?.linux;
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
  details: VersionDetails,
  hostOs: BdsHostOs = bdsHostOs()
): string[] {
  const urls: string[] = [];
  if (cfg.download_mirror) {
    const mirrorVer = channel === "preview" ? `${version}-preview` : version;
    urls.push(resolveTemplate(cfg.download_mirror, { version: mirrorVer }));
  }
  if (details.downloadUrl) urls.push(details.downloadUrl);
  const cdnRoot = cfg.cdn_root || "https://www.minecraft.net/bedrockdedicatedserver";
  const suffix = bdsCdnZipSuffix(channel, version, hostOs);
  urls.push(cdnRoot + suffix);
  urls.push(`https://minecraft.azureedge.net${suffix}`);
  return [...new Set(urls)];
}

/** 同步 / 异步校验文件哈希 */
export async function verifyFileHash(filePath: string, expectedSha1: string, expectedSha256: string): Promise<boolean> {
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

