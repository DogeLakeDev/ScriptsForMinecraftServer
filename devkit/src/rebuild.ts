/**
 * 组装并部署行为包：在 SFMC_ROOT 下 spawn `sfmc mod reload`
 * （与 CLI 同一入口，完整传参；勿直接裸调 pack-manager verb）。
 */

import { runSfmcCli } from "./sfmc-cli.js";

export interface RebuildOptions {
  /** SFMC 工作目录（含 configs/、modules/）。 */
  sfmcRoot: string;
  /** 仅构建部署，不向 BDS 发 reload（对应 `mod reload --build-only`）。 */
  buildOnly?: boolean;
  /** 可选：显式 sfmc CLI 入口；默认由安装树 / PATH / SFMC_CLI 解析。 */
  cliPath?: string;
}

export interface RebuildResult {
  ok: boolean;
  output: string;
}

export async function rebuildAndDeploy(opts: RebuildOptions): Promise<RebuildResult> {
  const args = ["mod", "reload"];
  if (opts.buildOnly) args.push("--build-only");
  return runSfmcCli(opts.sfmcRoot, args, { cliPath: opts.cliPath });
}
