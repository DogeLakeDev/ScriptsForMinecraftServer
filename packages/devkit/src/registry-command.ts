import fs from "node:fs/promises";
import path from "node:path";
import { submitModuleToRegistry, type RegistryModule, type RegistrySubmitOptions } from "./registry-submit.js";

/** CLI 与 CI 共用参数解析，未知参数返回失败，避免误提交。 */
export async function runRegistrySubmitCommand(args: string[]): Promise<string> {
  const options: RegistrySubmitOptions = {};
  let entryFile: string | undefined;
  const help =
    "sfmc mod submit [模块目录] [--dry-run] [--no-fork] [--wait-for-publish] [--registry owner/repo]\nCI：sfmc-module-submit --entry-file <JSON>（与模块目录互斥）";
  if (args.includes("--help") || args.includes("-h")) return help;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--no-fork") options.noFork = true;
    else if (arg === "--wait-for-publish") options.waitForPublish = true;
    else if (arg === "--registry" || arg === "--entry-file") {
      const value = args[++i];
      if (!value || value.startsWith("-")) throw new Error(`缺少 ${arg} 的值`);
      if (arg === "--registry") options.registryRepo = value;
      else entryFile = value;
    } else if (arg.startsWith("-") || options.moduleRoot) throw new Error(`未知或重复参数：${arg}\n${help}`);
    else options.moduleRoot = path.resolve(arg);
  }
  if (entryFile) {
    if (options.moduleRoot) throw new Error("--entry-file 与模块目录互斥");
    options.entry = JSON.parse(await fs.readFile(path.resolve(entryFile), "utf8")) as RegistryModule;
  }
  const result = await submitModuleToRegistry(options);
  if (result.status === "preview")
    return `预览：${result.registryRepo}/${result.path}\n原条目：\n${JSON.stringify(result.previous, null, 2)}\n拟提交：\n${JSON.stringify(result.entry, null, 2)}\n校验通过，未写入远端。`;
  return `${{ unchanged: "内容相同，未重复提交", created: "已创建索引 PR", updated: "已更新索引 PR" }[result.status]}${result.prUrl ? `：${result.prUrl}` : ""}`;
}
