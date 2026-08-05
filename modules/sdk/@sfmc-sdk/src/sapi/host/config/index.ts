/**
 * sapi/host/config — 兼容出口
 *
 * 统一 re-export node/config,避免双路径维护(DRY)。
 * host 适配层其它代码若需要路径/JSON 工具,从此处或直接从 node/config 引入均可。
 */
export {
  MONOREPO_PACKAGE_NAME,
  findMonorepoRoot,
  resolveRuntimeRoot,
  resolveRuntimePath,
  configDir,
  configPath,
  stateDir,
  logsDir,
  logFile,
  moduleDir,
  modulePath,
  readJson,
  writeJson,
  patchJson,
  ensureJson,
  ensureJsonConfig,
} from "../../../node/config/index.js";
