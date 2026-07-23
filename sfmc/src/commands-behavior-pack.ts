/**
 * commands-behavior-pack.ts — sfmc CLI `behavior-pack` / `bp`
 *
 * 实际装载逻辑在 pack-lifecycle.ts;本文件保留路径常量再导出与薄包装。
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
