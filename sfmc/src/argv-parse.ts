/**
 * argv-parse.ts — 外部 CLI 全局旗标与短命令预解析（DRY）
 *
 * - `-p` / `--packs`：附加包上下文
 * - 顶层 `i` / `install`：模块安装（非 packs 时）
 * - packs 上下文下 `i` → `install`
 */
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

/** 是否为顶层模块 install 短命令 */
export function isModuleInstallShorthand(cmd: string | undefined): boolean {
  return cmd === "install" || cmd === "i";
}
