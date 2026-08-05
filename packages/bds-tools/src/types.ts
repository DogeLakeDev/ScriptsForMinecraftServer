/**
 * types.ts — BDSTools 共享类型
 */

export interface BdsUpdaterConfig {
  bds_path?: string;
  backup_dir?: string;
  channel?: "release" | "preview" | string;
  auto_restart?: boolean;
  auto_check?: boolean;
  crash_restart?: boolean;
  crash_restart_delay?: number;
  qq_notify?: boolean;
  qq_config?: string;
  preserve?: string[];

  // 高级版本源
  version_mode?: "bedrock-oss" | "endstone";
  version_versions?: string;
  version_versions_mirror?: string;
  version_details?: string;
  version_details_mirror?: string;
  download_mirror?: string;
  cdn_root?: string;
  download_timeout?: number;

  // 兼容版本（升级前白名单）
  compatible_versions?: string[];

  // 内部使用 (不应出现在 bds_updater.json 中)
  _hash?: { sha1: string; sha256: string };
}

export interface VersionInfo {
  version: string;
  cdnRoot: string;
}

export interface VersionDetails {
  downloadUrl: string;
  sha1: string;
  sha256: string;
  size: number;
}

export interface UpdateOutcome {
  ok: boolean;
  currentVer: string;
  latestVer: string;
  backupPath: string | null;
  durationMs: number;
}

export interface ChangelogPayload {
  text: string;
  imageBase64: string | null;
}

export type LogLevel = "info" | "warn" | "error";

export interface Logger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}
