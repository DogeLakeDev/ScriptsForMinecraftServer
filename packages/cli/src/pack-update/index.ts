/**
 * sfmc 薄封装：注入 ROOT / i18n / theme / clack / logs，再导出 pack-update API
 */
import { createPackUpdateApi } from "@sfmc-bds/bds-tools/pack-update";
import { confirm, isCancel } from "@clack/prompts";
import { t } from "../i18n/index.js";
import { pushLog } from "../logs.js";
import { resolveBdsContext } from "../pack-lifecycle.js";
import { ROOT } from "../runtime.js";
import { c } from "../theme.js";

const api = createPackUpdateApi({
  rootDir: ROOT,
  resolveBdsContext,
  log: (text: string, level: "info" | "warn" | "error" | "success" = "info") =>
    pushLog(text, "pack", level === "success" ? "info" : level),
  askConfirm: async (message: string) => {
    const ans = await confirm({ message, initialValue: true });
    if (isCancel(ans)) return false;
    return !!ans;
  },
  t: (key: string, params?: Record<string, string | number>) =>
    t(key as Parameters<typeof t>[0], params),
  paint: {
    green: (s: string) => c.green(s),
    yellow: (s: string) => c.yellow(s),
    red: (s: string) => c.red(s),
    dim: (s: string) => c.dim(s),
    cyan: (s: string) => c.cyan(s),
    bold: (s: string) => c.bold(s),
  },
});

export const {
  ensurePackUpdateConfigFile,
  loadPackUpdateConfig,
  getPackMatchConfig,
  packUpdateConfigPath,
  resolvePackTrashDir,
  isPackUninstallRecycleBin,
  resolveUninstallTrashDir,
  packSourcesPath,
  readPackSources,
  writePackSources,
  getBinding,
  setBinding,
  removeBinding,
  listBindings,
  createPackSourceProvider,
  providerShortLabel,
  resolveConfiguredPackProvider,
  pairedRpUuidFromBpDir,
  probeSourceAfterInstall,
  searchRemote,
  bindPackSource,
  formatSourcesList,
  checkPackUpdates,
  runPackUpdatesOnBdsStart,
  bindingLabelForUuid,
} = api;

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
} from "@sfmc-bds/bds-tools/pack-update";

export {
  DEFAULT_PACK_UNINSTALL,
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
} from "@sfmc-bds/bds-tools/pack-update";
