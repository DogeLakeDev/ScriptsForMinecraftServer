/**
 * host-platform.ts — BDS 宿主平台契约（单一权威来源）
 *
 * Windows / Linux 官方 BDS 的可执行文件名、CDN 路径、启动环境不同。
 * 启动器与更新器只依赖本模块，禁止在业务里再写 bedrock_server.exe / bin-win。
 * macOS 无官方 BDS，按 linux 处理（调用方应避免在 darwin 上当生产宿主）。
 */

import fs from "node:fs";
import path from "node:path";

export type BdsHostOs = "windows" | "linux";

export function bdsHostOs(platform = process.platform): BdsHostOs {
  return platform === "win32" ? "windows" : "linux";
}

export function bdsExeName(os: BdsHostOs = bdsHostOs()): string {
  return os === "windows" ? "bedrock_server.exe" : "bedrock_server";
}

export function bdsExePath(bdsPath: string, os: BdsHostOs = bdsHostOs()): string {
  return path.join(bdsPath, bdsExeName(os));
}

/** BDS-Versions 详情 JSON 的 platform 段：windows / windows_preview / linux / linux_preview */
export function bdsDetailsPlatformKey(channel: string, os: BdsHostOs = bdsHostOs()): string {
  const preview = channel === "preview";
  if (os === "windows") return preview ? "windows_preview" : "windows";
  return preview ? "linux_preview" : "linux";
}

/** minecraft.net / azureedge CDN 上的 zip 相对路径 */
export function bdsCdnZipSuffix(channel: string, version: string, os: BdsHostOs = bdsHostOs()): string {
  const preview = channel === "preview";
  if (os === "windows") {
    return preview
      ? `/bin-win-preview/bedrock-server-${version}-preview.zip`
      : `/bin-win/bedrock-server-${version}.zip`;
  }
  return preview
    ? `/bin-linux-preview/bedrock-server-${version}-preview.zip`
    : `/bin-linux/bedrock-server-${version}.zip`;
}

/** 解压后完整性检查的必备相对路径 */
export function bdsInstallRequiredFiles(os: BdsHostOs = bdsHostOs()): string[] {
  return [bdsExeName(os), "permissions.json"];
}

/**
 * 仅返回需覆盖进 spawn env 的键。
 * Linux 官方 BDS 依赖同目录 lib*.so，须把安装目录放进 LD_LIBRARY_PATH。
 */
export function bdsSpawnEnvExtra(bdsPath: string, os: BdsHostOs = bdsHostOs()): Record<string, string> {
  if (os === "windows") return {};
  const prev = process.env.LD_LIBRARY_PATH ?? "";
  const ld = prev ? `${bdsPath}${path.delimiter}${prev}` : bdsPath;
  return { LD_LIBRARY_PATH: ld };
}

/** Linux zip 解压后往往没有 +x，启动前补上 */
export function ensureBdsExecutable(exePath: string, os: BdsHostOs = bdsHostOs()): void {
  if (os === "windows") return;
  try {
    if (fs.existsSync(exePath)) fs.chmodSync(exePath, 0o755);
  } catch {
    /* 只读文件系统时忽略，spawn 会再报错 */
  }
}
