/**
 * pack-update 公共入口：依赖注入工厂 + 纯函数/类型再导出
 */
import { createPackUpdateBindingsApi } from "./bindings.js";
import { createPackUpdateConfigApi } from "./config.js";
import { createTestPackUpdateDeps, identityPaint, type PackUpdateDeps } from "./deps.js";
import {
  createPackSourceProvider,
  providerShortLabel,
  resolveConfiguredPackProvider,
} from "./providers/index.js";
import { createPackUpdateServiceApi } from "./service.js";

export type { PackUpdateDeps };
export { createTestPackUpdateDeps, identityPaint };

export type {
  CurseForgeProviderConfig,
  PackProviderId,
  PackReleaseType,
  PackSourceBinding,
  PackSourceProvider,
  PackSourcesFile,
  PackUpdateConfig,
  PackUpdateMatchConfig,
  PackUninstallConfig,
  SemVer3,
  SourceFileRef,
  SourceSearchHit,
  VersionCompareResult,
  VersionPolicyConfig,
} from "./types.js";
export { DEFAULT_PACK_UNINSTALL } from "./types.js";

export {
  buildSearchQueries,
  buildSearchQueriesFromSources,
  bumpSemVer3,
  collectQuerySeeds,
  compareSemVer3,
  decideVersionPolicy,
  extractLatinPhrase,
  insertCjkLatinBoundaries,
  isNewer,
  maxSemVer3,
  nextEnabledVersion,
  normalizePackSearchName,
  packSourceScore,
  toCfSlugCandidate,
} from "./version-policy.js";
export type { SearchQueryPlan, SearchQuerySource } from "./version-policy.js";

export {
  createPackSourceProvider,
  CurseForgeBedrockProvider,
  providerShortLabel,
  resolveConfiguredPackProvider,
} from "./providers/index.js";

export type { PackUpdateBindingsApi } from "./bindings.js";
export type { PackUpdateConfigApi } from "./config.js";
export type { PackUpdateServiceApi } from "./service.js";

export function createPackUpdateApi(deps: PackUpdateDeps) {
  const paint = deps.paint ?? identityPaint();
  const resolved: PackUpdateDeps = { ...deps, paint };
  const config = createPackUpdateConfigApi(resolved);
  const bindings = createPackUpdateBindingsApi(resolved);
  const service = createPackUpdateServiceApi(resolved, config, bindings);
  return {
    ...config,
    ...bindings,
    ...service,
    createPackSourceProvider,
    providerShortLabel,
    resolveConfiguredPackProvider,
  };
}

export type PackUpdateApi = ReturnType<typeof createPackUpdateApi>;
