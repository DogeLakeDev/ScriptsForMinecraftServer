/**
 * argv-parse.ts — 外部 CLI 全局旗标与短命令预解析（DRY）
 *
 * - `-p` / `--packs`：资源包上下文（兼容；帮助优先推荐 `sfmc packs <sub>`）
 * - 顶层模块短命令：见 command-surface#MODULE_TOP_SHORTHAND / resolveModuleTopShorthand
 * - packs 上下文下 `i` → `install`
 */
import { resolveModuleTopShorthand } from "./command-surface.js";

export type ParsedArgv = {
  packsMode: boolean;
  /** 规范化后的位置参数（已去掉 -p/--packs） */
  args: string[];
};

const PACKS_FLAGS = new Set(["-p", "--packs"]);

export function parseGlobalArgv(raw: string[]): ParsedArgv {
  const args: string[] = [];
  let packsMode = false;
  for (const a of raw) {
    if (PACKS_FLAGS.has(a)) {
      packsMode = true;
      continue;
    }
    args.push(a);
  }
  return { packsMode, args };
}

/** packs 子命令短别名 */
export function mapPacksSubAlias(sub: string | undefined): string | undefined {
  if (!sub) return sub;
  if (sub === "i") return "install";
  return sub;
}

/** 是否为顶层模块短命令（install / uninstall / search …） */
export function isModuleInstallShorthand(cmd: string | undefined): boolean {
  return resolveModuleTopShorthand(cmd) !== undefined;
}

/** @deprecated 使用 resolveModuleTopShorthand；保留别名避免外部破坏 */
export function resolveModuleShorthandSub(cmd: string | undefined): string | undefined {
  return resolveModuleTopShorthand(cmd);
}
