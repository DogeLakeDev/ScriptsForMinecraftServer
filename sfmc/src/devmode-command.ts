import { isDeveloperMode, setDeveloperMode } from "./devmode.js";
import { t } from "./i18n/index.js";
import { ROOT } from "./runtime.js";
import { c } from "./theme.js";

/**
 * `sfmc devmode [on|off|status]` —— 切换/查看持久化开发模式。
 *
 * 仅写 `configs/runtime.json#developer_mode`；不直接联动 module 开发者子命令可见性
 * （由 {@link isDeveloperMode} 在 REPL/帮助/补全/分发处按需调用）。
 */
export function cmdDevMode(args: string[]): string {
  const sub = args[0]?.toLowerCase();
  const stateLabel = (on: boolean): string => t(on ? "devmode.state.on" : "devmode.state.off");

  if (!sub) {
    return c.text(t("devmode.status", { state: stateLabel(isDeveloperMode()) }));
  }

  switch (sub) {
    case "on":
      setDeveloperMode(ROOT, true);
      return (
        c.green(t("devmode.set", { state: stateLabel(true) })) + "\n" + c.dim(t("devmode.hint"))
      );
    case "off":
      setDeveloperMode(ROOT, false);
      return c.yellow(t("devmode.set", { state: stateLabel(false) }));
    case "status":
      return c.text(t("devmode.status", { state: stateLabel(isDeveloperMode()) }));
    default:
      return c.red(t("devmode.invalid", { value: sub })) + "\n" + c.dim(t("devmode.usage"));
  }
}
