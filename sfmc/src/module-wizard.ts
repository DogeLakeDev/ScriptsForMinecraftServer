/**
 * module-wizard.ts — 模块脚手架 / 本地联调交互向导
 *
 * 复用 @clack/prompts 与 init 向导相同依赖；薄包装 tools/new-module.mjs、fetch-module.mjs。
 */

import { confirm, intro, isCancel, note, outro, select, tasks, text } from "@clack/prompts";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { cmdModuleEnable } from "./module-commands.js";
import { pickDirectory, resolveUserPath } from "./interactive-prompts.js";
import { ROOT, resolveFetchModule, resolveNewModule } from "./runtime.js";
import {
  listSfmcModulePackages,
  packageDirForId,
  persistSfmcModulesRoot,
  resolveSfmcModulesRoot,
} from "./sfmc-modules-root.js";
import { c } from "./theme.js";

function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY);
}

function cancelMessage(): string {
  return c.dim("已取消");
}

/** 子进程执行工具脚本；用参数数组避免 Windows 含 # 路径被 shell 误解析。 */
function spawnTool(script: string, args: string[]): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve) => {
    const proc = spawn(process.execPath, [script, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, SFMC_ROOT: ROOT },
    });
    let output = "";
    proc.stdout?.on("data", (d: Buffer) => {
      output += d.toString();
    });
    proc.stderr?.on("data", (d: Buffer) => {
      output += d.toString();
    });
    proc.on("exit", (code) => resolve({ code, output }));
    proc.on("error", (e) => resolve({ code: 1, output: `${output}${e.message}` }));
  });
}

async function ensureSfmcModulesRoot(): Promise<string | null> {
  let modulesRoot = resolveSfmcModulesRoot();
  if (modulesRoot) {
    note(c.text(`sfmc-modules: ${modulesRoot}`), "路径");
    return modulesRoot;
  }

  const defaultGuess = path.resolve(ROOT, "..", "sfmc-modules");
  const picked = await pickDirectory("sfmc-modules 根目录（含 packages/ 与 index.json）", defaultGuess);
  modulesRoot = resolveUserPath(picked, ROOT);
  if (!existsSync(path.join(modulesRoot, "packages"))) {
    outro(c.red(`未找到 packages/ 子目录: ${modulesRoot}`));
    return null;
  }
  persistSfmcModulesRoot(modulesRoot);
  return modulesRoot;
}

async function runFetchModuleLink(folderId: string, pkgPath: string): Promise<{ ok: boolean; output: string }> {
  const fetchScript = resolveFetchModule();
  if (!fetchScript) {
    return { ok: false, output: c.red("未找到 fetch-module.mjs") };
  }
  const fromArg = `dir:${path.resolve(pkgPath)}`;
  const { code, output } = await spawnTool(fetchScript, ["install", folderId, "--from", fromArg, "--link"]);
  return { ok: code === 0, output };
}

async function maybeEnableModule(folderId: string): Promise<string | undefined> {
  const enable = await confirm({ message: "启用该模块？（写入 module-lock.json，需 db-server）", initialValue: true });
  if (isCancel(enable) || !enable) return undefined;
  return cmdModuleEnable([folderId]);
}

async function maybeBuildDeploy(): Promise<void> {
  const buildDeploy = await confirm({
    message: "构建并部署行为包？（完成后可用 `sfmc reload` 或在 BDS/游戏内输入 reload）",
    initialValue: true,
  });
  if (isCancel(buildDeploy) || !buildDeploy) return;

  const { cmdBehaviorPackBuild, cmdBehaviorPackDeploy } = await import("./commands-behavior-pack.js");
  await tasks([
    {
      title: "构建行为包",
      task: async () => {
        const out = await cmdBehaviorPackBuild([]);
        if (out.includes("失败") || out.startsWith("\x1b[31m")) throw new Error(out.trim());
        return "完成";
      },
    },
    {
      title: "部署行为包",
      task: async () => {
        const out = await cmdBehaviorPackDeploy([]);
        if (out.includes("失败") || out.startsWith("\x1b[31m")) throw new Error(out.trim());
        return "完成";
      },
    },
  ]);
  note(c.yellow("请用 `sfmc reload`（build+deploy 后向 BDS 发 reload）；也可手动在 BDS/游戏内输入 reload。"), "提示");
}

function validateFolderId(value: string | undefined): string | undefined {
  if (!value?.trim()) return "必填";
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(value.trim())) {
    return "须为小写 kebab-case，例如 my-feature";
  }
  return undefined;
}

/** 交互式创建模块包并可选 link / enable / build+deploy。 */
export async function runModuleCreateWizard(): Promise<string> {
  if (!isInteractive()) {
    return c.yellow("请在交互终端运行: sfmc module create");
  }

  intro(c.bold("模块脚手架"));

  const modulesRoot = await ensureSfmcModulesRoot();
  if (!modulesRoot) return cancelMessage();

  const idRaw = await text({
    message: "模块文件夹名（install id）",
    placeholder: "my-feature",
    validate: validateFolderId,
  });
  if (isCancel(idRaw) || !idRaw) {
    outro(cancelMessage());
    return cancelMessage();
  }
  const folderId = idRaw.trim();

  const target = packageDirForId(modulesRoot, folderId);
  if (existsSync(target)) {
    outro(c.red(`目录已存在: ${target}`));
    return c.red(`目录已存在: ${target}`);
  }

  const nameRaw = await text({
    message: "显示名称",
    initialValue: folderId,
    validate: (v) => (!v?.trim() ? "必填" : undefined),
  });
  if (isCancel(nameRaw) || !nameRaw) {
    outro(cancelMessage());
    return cancelMessage();
  }

  const template = await select({
    message: "脚手架模板",
    options: [
      { value: "minimal", label: "最小模块", hint: "命令 + 权限占位" },
      { value: "db", label: "含 DB 权限占位", hint: "manifest 预置 db:read/write" },
    ],
  });
  if (isCancel(template)) {
    outro(cancelMessage());
    return cancelMessage();
  }

  const siblingNewModule = path.join(modulesRoot, "tools", "new-module.mjs");
  const platformNewModule = resolveNewModule();
  const useSibling = existsSync(siblingNewModule) && template === "minimal";
  const newModuleScript = useSibling ? siblingNewModule : platformNewModule;
  if (!newModuleScript) {
    outro(c.red("未找到 tools/new-module.mjs（旁路 sfmc-modules 或主仓 tools/）"));
    return c.red("未找到 tools/new-module.mjs");
  }

  let scaffoldOutput = "";
  try {
    await tasks([
      {
        title: `生成 packages/${folderId}`,
        task: async () => {
          const spawnArgs = useSibling
            ? [folderId, nameRaw.trim()]
            : [folderId, "--name", nameRaw.trim(), "--root", modulesRoot, "--template", String(template)];
          const { code, output } = await spawnTool(newModuleScript, spawnArgs);
          scaffoldOutput = output;
          if (code !== 0) throw new Error(output.trim() || `exit ${code}`);
          return "骨架已写入 sfmc-modules";
        },
      },
    ]);
  } catch (e) {
    outro(c.red((e as Error).message));
    return c.red((e as Error).message);
  }

  note(scaffoldOutput.trim() || c.green(`已创建 ${target}`), "脚手架");

  const doLink = await confirm({
    message: "链接到主仓 modules/packages/？（--link，改源码即生效）",
    initialValue: true,
  });
  if (!isCancel(doLink) && doLink) {
    const { ok, output } = await runFetchModuleLink(folderId, target);
    note(output.trim(), ok ? "链接" : "链接失败");
    if (ok) {
      const enableMsg = await maybeEnableModule(folderId);
      if (enableMsg) note(enableMsg, "启用");
      await maybeBuildDeploy();
    }
  }

  outro(c.green(`完成。源码: ${target}`));
  return c.green(`模块 ${folderId} 已创建`);
}

/** 从 sfmc-modules/packages 选择并 --link 安装。 */
export async function runModuleLinkWizard(): Promise<string> {
  if (!isInteractive()) {
    return c.yellow("请在交互终端运行: sfmc module link");
  }

  intro(c.bold("链接本地模块"));

  const modulesRoot = await ensureSfmcModulesRoot();
  if (!modulesRoot) return cancelMessage();

  const packages = listSfmcModulePackages(modulesRoot);
  if (packages.length === 0) {
    outro(c.yellow(`${modulesRoot}/packages 下没有模块`));
    return c.yellow("没有可链接的模块包");
  }

  const picked = await select({
    message: "选择要链接的模块包",
    options: packages.map((p) => ({
      value: p.id,
      label: p.id,
      hint: `${p.name} · ${p.logicalId}`,
    })),
  });
  if (isCancel(picked)) {
    outro(cancelMessage());
    return cancelMessage();
  }

  const pkg = packages.find((p) => p.id === picked)!;
  let linkOutput = "";
  try {
    await tasks([
      {
        title: `链接 ${pkg.id}`,
        task: async () => {
          const { ok, output } = await runFetchModuleLink(pkg.id, pkg.path);
          linkOutput = output;
          if (!ok) throw new Error(output.trim() || "link failed");
          return "catalog + lock 已同步";
        },
      },
    ]);
  } catch (e) {
    outro(c.red((e as Error).message));
    return c.red((e as Error).message);
  }

  note(linkOutput.trim(), "链接");
  const enableMsg = await maybeEnableModule(pkg.id);
  if (enableMsg) note(enableMsg, "启用");

  outro(c.green(`已链接 ${pkg.id}`));
  return c.green(`已链接 ${pkg.id}`);
}

/** 链接 + 启用 + 构建部署（本地开发一键流）。 */
export async function runModuleDevWizard(): Promise<string> {
  if (!isInteractive()) {
    return c.yellow("请在交互终端运行: sfmc module dev");
  }

  intro(c.bold("本地模块开发"));

  const modulesRoot = await ensureSfmcModulesRoot();
  if (!modulesRoot) return cancelMessage();

  const packages = listSfmcModulePackages(modulesRoot);
  if (packages.length === 0) {
    outro(c.yellow(`${modulesRoot}/packages 下没有模块`));
    return c.yellow("没有可开发的模块包");
  }

  const picked = await select({
    message: "选择要联调的模块",
    options: packages.map((p) => ({
      value: p.id,
      label: p.id,
      hint: `${p.name} · ${p.logicalId}`,
    })),
  });
  if (isCancel(picked)) {
    outro(cancelMessage());
    return cancelMessage();
  }

  const pkg = packages.find((p) => p.id === picked)!;

  try {
    await tasks([
      {
        title: `链接 ${pkg.id}`,
        task: async () => {
          const { ok, output } = await runFetchModuleLink(pkg.id, pkg.path);
          if (!ok) throw new Error(output.trim() || "link failed");
          return output.trim().split("\n").pop() ?? "linked";
        },
      },
      {
        title: `启用 ${pkg.id}`,
        task: async () => {
          const msg = await cmdModuleEnable([pkg.id]);
          if (msg.startsWith("\x1b[31m") || msg.includes("failed")) throw new Error(msg.trim());
          return msg.trim();
        },
      },
      {
        title: "构建行为包",
        task: async () => {
          const { cmdBehaviorPackBuild } = await import("./commands-behavior-pack.js");
          const out = await cmdBehaviorPackBuild([]);
          if (out.includes("失败") || out.startsWith("\x1b[31m")) throw new Error(out.trim());
          return "完成";
        },
      },
      {
        title: "部署行为包",
        task: async () => {
          const { cmdBehaviorPackDeploy } = await import("./commands-behavior-pack.js");
          const out = await cmdBehaviorPackDeploy([]);
          if (out.includes("失败") || out.startsWith("\x1b[31m")) throw new Error(out.trim());
          return "完成";
        },
      },
    ]);
  } catch (e) {
    outro(c.red((e as Error).message));
    return c.red((e as Error).message);
  }

  note(
    c.yellow(
      "修改 sfmc-modules 源码后执行 `sfmc reload`（build + deploy + 向 BDS 发 reload）。\n" +
        "或再次运行 `sfmc module dev`，然后在 BDS/游戏内输入 reload。"
    ),
    "提示"
  );
  outro(c.green(`${pkg.id} 已链接并完成 build + deploy`));
  return c.green(`${pkg.id} 开发环境就绪`);
}

export { isInteractive as isModuleWizardInteractive };
