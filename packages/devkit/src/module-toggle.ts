/**
 * 模块启停：spawn `sfmc mod enable|disable`（写 module-lock + best-effort 热同步）。
 */

import { runSfmcCli, type RunSfmcCliResult } from "./sfmc-cli.js";

export interface SetModuleEnabledOptions {
  /** SFMC 工作目录（含 modules/module-lock.json）。 */
  sfmcRoot: string;
  /** 模块 logicalId / folderId / configKey（与 CLI `mod enable` 一致）。 */
  moduleId: string;
  enabled: boolean;
  /** 可选：显式 sfmc CLI 入口；默认由安装树 / PATH / SFMC_CLI 解析。 */
  cliPath?: string;
}

export type SetModuleEnabledResult = RunSfmcCliResult;

/** 启用或关闭模块（与 CLI `mod enable|disable` 同源）。 */
export async function setModuleEnabled(opts: SetModuleEnabledOptions): Promise<SetModuleEnabledResult> {
  const id = String(opts.moduleId || "").trim();
  if (!id) {
    return { ok: false, output: "moduleId 为空" };
  }
  const action = opts.enabled ? "enable" : "disable";
  return runSfmcCli(opts.sfmcRoot, ["mod", action, id], { cliPath: opts.cliPath });
}
