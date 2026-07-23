/**
 * commands-reload.ts — 模块开发一键重载
 *
 * 语义：pack build → pack deploy →（默认）向 BDS 控制台发送 `reload`。
 * 游戏内 / BDS 均支持 reload：部署新 main.js 后发该命令即可重新加载脚本，无需重启进程。
 */

import { t } from "./i18n/index.js";
import { c } from "./theme.js";

/**
 * `sfmc reload [--build-only]`
 * `--build-only`：只 build+deploy，不向 BDS 发 reload。
 */
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
