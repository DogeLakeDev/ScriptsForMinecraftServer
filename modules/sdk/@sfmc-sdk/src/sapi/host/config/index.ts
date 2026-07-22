/**
 * sapi/host/config — 兼容出口
 *
 * 历史:曾从 shared/sfmc-config 迁入一份独立实现,与 @sfmc/sdk/node/config 重复。
 * 现统一 re-export node/config,避免双路径维护(DRY)。
 * host 适配层其它代码若需要路径/JSON 工具,从此处或直接从 node/config 引入均可。
 */
export {
  resolveRuntimeRoot,
  resolveRuntimePath,
  configDir,
  configPath,
  moduleDir,
  modulePath,
  readJson,
  writeJson,
  patchJson,
  ensureJson,
  ensureJsonConfig,
} from "../../../node/config/index.js";
