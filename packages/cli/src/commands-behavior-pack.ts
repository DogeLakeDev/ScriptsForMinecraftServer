/**
 * commands-behavior-pack.ts — 模块聚合 BP/RP 的薄包装
 *
 * CLI 已不再暴露 `behavior-pack`/`bp`；本文件供 wizard / ensurePacksReady 内部调用。
 */

import type { CliResult } from "./cli-result.js";
import { c } from "./theme.js";
import { t } from "./i18n/index.js";
import {
  BP_NAME,
  RP_NAME,
  DEPLOY_CATALOG_NAME,
  bpOut,
  bpSrc,
  buildRoot,
  rpOut,
  buildPacks,
  cmdPackBuild,
  cmdPackDeploy,
  deployPacks,
  ensurePacksReady,
} from "./pack-lifecycle.js";

export {
  BP_NAME,
  RP_NAME,
  DEPLOY_CATALOG_NAME,
  bpOut,
  bpSrc,
  buildRoot,
  rpOut,
  ensurePacksReady,
  buildPacks,
  deployPacks,
};

/** Build the BP + RP via pack-lifecycle（结构化结果，勿解析 message 文案）。 */
export async function cmdBehaviorPackBuild(args: string[]): Promise<CliResult> {
  return cmdPackBuild(args);
}

/** Deploy assembled packs + world lists + permission. */
export async function cmdBehaviorPackDeploy(args: string[]): Promise<CliResult> {
  return cmdPackDeploy(args);
}

/** 兼容旧帮助文案 */
export function behaviorPackUsage(): string {
  return c.yellow(t("bp.usage"));
}
