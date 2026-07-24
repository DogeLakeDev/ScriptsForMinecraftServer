/**
 * pack-update 类型定义
 */

export type PackReleaseType = "release" | "beta" | "alpha";

export interface PackUpdateMatchConfig {
  byUuidInArchive: boolean;
  byName: boolean;
  nameMinScore: number;
  stripFolderTags: boolean;
}

export interface CurseForgeProviderConfig {
  enabled: boolean;
  apiKey: string;
  /** 官方 Core API，用于 getMod / files / download-url */
  baseUrl: string;
  /**
   * 搜索用镜像（官方 /v1/mods/search 部分 key 会 403）。
   * 默认 https://api.curse.tools/v1/cf
   */
  searchBaseUrl: string;
  /** Minecraft Bedrock = 78022（不是 459） */
  gameId: number;
  /** Addons class = 4984；null 时自动解析 */
  classId: number | null;
  pageSize: number;
  preferredReleaseTypes: PackReleaseType[];
  match: PackUpdateMatchConfig;
}

export interface VersionPolicyConfig {
  authority: "behavior_pack";
  onUpdateOverwriteBoth: boolean;
  rpBumpWhenSameMajor: boolean;
  rpBumpComponent: "patch" | "minor";
  majorHigherSkipRpBump: boolean;
}

export interface StartupUpdateConfig {
  sequential: boolean;
  delayMsBetweenPacks: number;
  skipDisabledBindings: boolean;
  failMode: "continue" | "abort";
}

export interface PackUpdateConfig {
  enabled: boolean;
  checkOnBdsStart: boolean;
  applyOnBdsStart: boolean;
  askConfirmOnBind: boolean;
  probeSourceAfterInstall: boolean;
  providers: {
    curseforge: CurseForgeProviderConfig;
  };
  versionPolicy: VersionPolicyConfig;
  startup: StartupUpdateConfig;
}

export interface PackSourceBinding {
  enabled: boolean;
  provider: "curseforge";
  projectId: number;
  slug: string;
  websiteUrl: string;
  pairedResourceUuid: string | null;
  lastFileId: number | null;
  lastCheckedAt: string | null;
  lastAppliedFileId: number | null;
}

export interface PackSourcesFile {
  bindings: Record<string, PackSourceBinding>;
}

export interface SourceSearchHit {
  provider: "curseforge";
  projectId: number;
  slug: string;
  name: string;
  summary: string;
  websiteUrl: string;
  downloadCount?: number;
}

export interface SourceFileRef {
  provider: "curseforge";
  projectId: number;
  fileId: number;
  fileName: string;
  displayName: string;
  downloadUrl: string;
  fileDate?: string;
  releaseType?: PackReleaseType;
}

export interface PackSourceProvider {
  readonly id: "curseforge";
  isConfigured(): boolean;
  search(query: string): Promise<SourceSearchHit[]>;
  getLatestFile(projectId: number): Promise<SourceFileRef | null>;
  download(file: SourceFileRef, destPath: string, onProgress?: (dl: number, total: number) => void): Promise<void>;
  resolveProject(ref: string | number): Promise<SourceSearchHit | null>;
}

export type SemVer3 = [number, number, number];

export interface VersionCompareResult {
  remoteNewer: boolean;
  majorHigher: boolean;
  shouldBumpRp: boolean;
}
