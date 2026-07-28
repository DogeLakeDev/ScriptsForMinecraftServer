/**
 * cli-gate.ts — 将 command-surface 拒绝原因格式化为用户文案（DRY）
 */
import {
  canRunCommand,
  findModuleSubSpec,
  findPacksSubSpec,
  findTopLevelSpec,
  isCliTty,
  type CanRunFailReason,
  type CommandMode,
  type CommandSpec,
} from "./command-surface.js";
import { t } from "./i18n/index.js";
import { c } from "./theme.js";

export function formatGateFailure(reason: CanRunFailReason, hintCmd?: string): string {
  switch (reason) {
    case "externalOnly":
      return (
        c.yellow(t("cli.externalOnly", { cmd: hintCmd ?? "" })) +
        "\n" +
        c.dim(t("cli.externalOnly.hint", { cmd: hintCmd || "…" }))
      );
    case "replOnly":
      return c.yellow(t("cli.replOnly", { cmd: hintCmd ?? "" })) + "\n" + c.dim(t("cli.replOnly.hint"));
    case "needTty":
      return c.yellow(t("cli.needTty", { cmd: hintCmd ?? "" }));
  }
}

export function gateSpec(
  spec: CommandSpec | undefined,
  mode: CommandMode,
  hintCmd?: string
): string | null {
  if (!spec) return null;
  const result = canRunCommand(spec, { mode, isTty: isCliTty() });
  if (result.ok) return null;
  return formatGateFailure(result.reason, hintCmd ?? spec.id);
}

/** 顶层命令门禁；未知命令返回 null（由调用方报 unknown）。 */
export function gateTopLevel(cmd: string | undefined, mode: CommandMode): string | null {
  const spec = findTopLevelSpec(cmd);
  if (!spec) return null;
  return gateSpec(spec, mode, cmd);
}

export function gateModuleSub(sub: string | undefined, mode: CommandMode): string | null {
  const spec = findModuleSubSpec(sub);
  if (!spec) return null;
  return gateSpec(spec, mode, `module ${sub}`);
}

export function gatePacksSub(sub: string | undefined, mode: CommandMode): string | null {
  const spec = findPacksSubSpec(sub);
  if (!spec) return null;
  return gateSpec(spec, mode, `packs ${sub}`);
}
