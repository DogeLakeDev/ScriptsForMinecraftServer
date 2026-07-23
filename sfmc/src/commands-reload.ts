/**
 * commands-reload.ts — 模块开发一键重载
 *
 * 语义：pack build → pack deploy →（默认）向 BDS 控制台发送 `reload`。
 * 游戏内 / BDS 均支持 reload：部署新 main.js 后发该命令即可重新加载脚本，无需重启进程。
 */

import { c } from "./theme.js";

function looksFailed(out: string): boolean {
  return /failed/i.test(out) || out.includes("失败");
}

/**
 * `sfmc reload [--build-only]`
 * `--build-only`：只 build+deploy，不向 BDS 发 reload。
 */
export async function cmdReload(args: string[]): Promise<string> {
  const buildOnly = args.includes("--build-only");
  const { cmdPackBuild, cmdPackDeploy } = await import("./pack-lifecycle.js");

  const parts: string[] = [];
  const buildOut = await cmdPackBuild([]);
  parts.push(buildOut.trimEnd());
  if (looksFailed(buildOut)) return parts.join("\n") + "\n";

  const deployOut = await cmdPackDeploy([]);
  parts.push(deployOut.trimEnd());
  if (looksFailed(deployOut)) return parts.join("\n") + "\n";

  if (buildOnly) {
    parts.push(c.dim("(deploy 完成；在 BDS/游戏内输入 reload，或去掉 --build-only 自动发送)"));
    return parts.join("\n") + "\n";
  }

  const { services } = await import("./services.js");
  if (!services.bds.running) {
    parts.push(c.yellow("BDS 未运行 — 已完成 build+deploy。启动后请在 BDS 控制台或游戏内输入 reload。"));
    return parts.join("\n") + "\n";
  }

  const { cmdSend } = await import("./commands.js");
  parts.push((await cmdSend("bds", "reload")).trimEnd());
  parts.push(c.green("已向 BDS 发送 reload（脚本将按新 main.js 重新加载）"));
  return parts.join("\n") + "\n";
}
