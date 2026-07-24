/**
 * commands-reload.ts — 模块开发一键重载
 *
 * 语义：build → deploy →（默认）向 BDS 控制台发送 `reload`。
 * 入口：`sfmc mod reload [--build-only]`（不再提供顶层 `sfmc reload`）。
 * `--build-only`：只 build+deploy，不向 BDS 发 reload。
 */

import { t } from "./i18n/index.js";
import { c } from "./theme.js";

export async function cmdReload(args: string[]): Promise<string> {
  const buildOnly = args.includes("--build-only");
  const { cmdPackBuild, cmdPackDeploy } = await import("./pack-lifecycle.js");

  const parts: string[] = [];
  const build = await cmdPackBuild([]);
  parts.push(build.message.trimEnd());
  if (!build.ok) return parts.join("\n") + "\n";

  const deploy = await cmdPackDeploy([]);
  parts.push(deploy.message.trimEnd());
  if (!deploy.ok) return parts.join("\n") + "\n";

  if (buildOnly) {
    parts.push(c.dim(t("reload.buildOnly")));
    return parts.join("\n") + "\n";
  }

  const { services } = await import("./services.js");
  if (!services.bds.running) {
    parts.push(c.yellow(t("reload.bdsNotRunning")));
    return parts.join("\n") + "\n";
  }

  const { cmdSend } = await import("./commands.js");
  parts.push((await cmdSend("bds", "reload")).trimEnd());
  parts.push(c.green(t("reload.sent")));
  return parts.join("\n") + "\n";
}
