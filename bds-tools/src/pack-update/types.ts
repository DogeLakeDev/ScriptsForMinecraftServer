/**
 * pack-update 类型定义
 */

export type PackReleaseType = "release" | "beta" | "alpha";

/** 已实现的源提供者 id（扩展时只加字面量，编排层走 PackSourceProvider） */
export type PackProviderId = "curseforge";

/**
 * 名称/slug 匹配策略。
 * 探测与 search 共用；勿再加未接线的开关（曾出现 byUuidInArchive/byName 死配置）。
 */
export interface PackUpdateMatchConfig {
  nameMinScore: number;
  stripFolderTags: boolean;
}

/** CF 源专属配置（不含通用 match；match 在 PackUpdateConfig 顶层） */
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

/** 世界包卸载策略（与 CF 更新同属 packs 生命周期配置） */
export interface PackUninstallConfig {
  /** true：移入回收站；false：直接删除目录 */
  recycleBin: boolean;
  /** 相对 SFMC_ROOT 的回收站路径，默认 packs/_trash */
  trashRelativeDir: string;
}

/** 卸载策略内置默认（DEFAULTS / resolve / schema 文案的唯一权威） */
export const DEFAULT_PACK_UNINSTALL: PackUninstallConfig = {
  recycleBin: true,
  trashRelativeDir: "packs/_trash",
};

export interface PackUpdateConfig {
  enabled: boolean;
  checkOnBdsStart: boolean;
  applyOnBdsStart: boolean;
  askConfirmOnBind: boolean;
  probeSourceAfterInstall: boolean;
  /**
   * 新建绑定的默认 enabled。
   * false 时探测/手动 bind 仍写入 pack-sources，但不会自动检查/更新，需手改或改此默认。
   */
  defaultBindingEnabled: boolean;
  /**
   * 名称/slug 匹配策略（源无关）。
   * 勿再塞进 providers.*（曾挂在 curseforge 下，违反 DIP/OCP）。
   */
  match: PackUpdateMatchConfig;
  providers: {
    curseforge: CurseForgeProviderConfig;
  };
  versionPolicy: VersionPolicyConfig;
  startup: StartupUpdateConfig;
  uninstall: PackUninstallConfig;
}

export interface PackSourceBinding {
  enabled: boolean;
  provider: PackProviderId;
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
  provider: PackProviderId;
  projectId: number;
  slug: string;
  name: string;
  summary: string;
  websiteUrl: string;
  downloadCount?: number;
}

export interface SourceFileRef {
  provider: PackProviderId;
  projectId: number;
  fileId: number;
  fileName: string;
  displayName: string;
  downloadUrl: string;
  fileDate?: string;
  releaseType?: PackReleaseType;
}

/** 源提供者契约：编排层只依赖此接口（DIP），具体实现可互换（LSP） */
export interface PackSourceProvider {
  readonly id: PackProviderId;
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
