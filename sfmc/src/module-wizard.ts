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
import { t } from "./i18n/index.js";
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
  return c.dim(t("common.cancelled"));
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
    note(c.text(t("modwiz.sfmcModulesPath", { path: modulesRoot })), t("common.path"));
    return modulesRoot;
  }

  const defaultGuess = path.resolve(ROOT, "..", "sfmc-modules");
  const picked = await pickDirectory(t("modwiz.pickModulesRoot"), defaultGuess);
  modulesRoot = resolveUserPath(picked, ROOT);
  if (!existsSync(path.join(modulesRoot, "packages"))) {
    outro(c.red(t("modwiz.noPackages", { path: modulesRoot })));
    return null;
  }
  persistSfmcModulesRoot(modulesRoot);
  return modulesRoot;
}

async function runFetchModuleLink(folderId: string, pkgPath: string): Promise<{ ok: boolean; output: string }> {
  const fetchScript = resolveFetchModule();
  if (!fetchScript) {
    return { ok: false, output: c.red(t("modwiz.noFetch")) };
  }
  const fromArg = `dir:${path.resolve(pkgPath)}`;
  const { code, output } = await spawnTool(fetchScript, ["install", folderId, "--from", fromArg, "--link"]);
  return { ok: code === 0, output };
}

async function maybeEnableModule(folderId: string): Promise<string | undefined> {
  const enable = await confirm({ message: t("modwiz.enableModule"), initialValue: true });
  if (isCancel(enable) || !enable) return undefined;
  return (await cmdModuleEnable([folderId])).message;
}

async function maybeBuildDeploy(): Promise<void> {
  const buildDeploy = await confirm({
    message: t("modwiz.buildDeploy"),
    initialValue: true,
  });
  if (isCancel(buildDeploy) || !buildDeploy) return;

  const { cmdBehaviorPackBuild, cmdBehaviorPackDeploy } = await import("./commands-behavior-pack.js");
  await tasks([
    {
      title: t("modwiz.task.build"),
      task: async () => {
        const r = await cmdBehaviorPackBuild([]);
        if (!r.ok) throw new Error(r.message.trim());
        return t("common.done");
      },
    },
    {
      title: t("modwiz.task.deploy"),
      task: async () => {
        const r = await cmdBehaviorPackDeploy([]);
        if (!r.ok) throw new Error(r.message.trim());
        return t("common.done");
      },
    },
  ]);
  note(c.yellow(t("modwiz.reloadHint")), t("common.hint"));
}

function validateFolderId(value: string | undefined): string | undefined {
  if (!value?.trim()) return t("common.required");
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(value.trim())) {
    return t("modwiz.kebab");
  }
  return undefined;
}

/** 交互式创建模块包并可选 link / enable / build+deploy。 */
export async function runModuleCreateWizard(): Promise<string> {
  if (!isInteractive()) {
    return c.yellow(t("modwiz.needTty.create"));
  }

  intro(c.bold(t("modwiz.createIntro")));

  const modulesRoot = await ensureSfmcModulesRoot();
  if (!modulesRoot) return cancelMessage();

  const idRaw = await text({
    message: t("modwiz.folderId"),
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
    outro(c.red(t("modwiz.dirExists", { path: target })));
    return c.red(t("modwiz.dirExists", { path: target }));
  }

  const nameRaw = await text({
    message: t("modwiz.displayName"),
    initialValue: folderId,
    validate: (v) => (!v?.trim() ? t("common.required") : undefined),
  });
  if (isCancel(nameRaw) || !nameRaw) {
    outro(cancelMessage());
    return cancelMessage();
  }

  const template = await select({
    message: t("modwiz.template"),
    options: [
      { value: "minimal", label: t("modwiz.tpl.minimal"), hint: t("modwiz.tpl.minimalHint") },
      { value: "db", label: t("modwiz.tpl.db"), hint: t("modwiz.tpl.dbHint") },
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
    outro(c.red(t("modwiz.noNewModule")));
    return c.red(t("modwiz.noNewModule"));
  }

  let scaffoldOutput = "";
  try {
    await tasks([
      {
        title: t("modwiz.genPackage", { id: folderId }),
        task: async () => {
          const spawnArgs = useSibling
            ? [folderId, nameRaw.trim()]
            : [folderId, "--name", nameRaw.trim(), "--root", modulesRoot, "--template", String(template)];
          const { code, output } = await spawnTool(newModuleScript, spawnArgs);
          scaffoldOutput = output;
          if (code !== 0) throw new Error(output.trim() || `exit ${code}`);
          return t("modwiz.skeletonWritten");
        },
      },
    ]);
  } catch (e) {
    outro(c.red((e as Error).message));
    return c.red((e as Error).message);
  }

  note(scaffoldOutput.trim() || c.green(t("modwiz.createdNote", { path: target })), t("modwiz.createIntro"));

  const doLink = await confirm({
    message: t("modwiz.linkAsk"),
    initialValue: true,
  });
  if (!isCancel(doLink) && doLink) {
    const { ok, output } = await runFetchModuleLink(folderId, target);
    note(output.trim(), ok ? t("modwiz.link") : t("modwiz.linkFailed"));
    if (ok) {
      const enableMsg = await maybeEnableModule(folderId);
      if (enableMsg) note(enableMsg, t("modwiz.enable"));
      await maybeBuildDeploy();
    }
  }

  outro(c.green(t("modwiz.createDone", { path: target })));
  return c.green(t("modwiz.moduleCreated", { id: folderId }));
}

/** 从 sfmc-modules/packages 选择并 --link 安装。 */
export async function runModuleLinkWizard(): Promise<string> {
  if (!isInteractive()) {
    return c.yellow(t("modwiz.needTty.link"));
  }

  intro(c.bold(t("modwiz.linkIntro")));

  const modulesRoot = await ensureSfmcModulesRoot();
  if (!modulesRoot) return cancelMessage();

  const packages = listSfmcModulePackages(modulesRoot);
  if (packages.length === 0) {
    outro(c.yellow(t("modwiz.noLinkable", { path: modulesRoot })));
    return c.yellow(t("modwiz.noLinkableShort"));
  }

  const picked = await select({
    message: t("modwiz.pickLink"),
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
        title: t("modwiz.linking", { id: pkg.id }),
        task: async () => {
          const { ok, output } = await runFetchModuleLink(pkg.id, pkg.path);
          linkOutput = output;
          if (!ok) throw new Error(output.trim() || t("modwiz.linkFailed"));
          return t("modwiz.linkSynced");
        },
      },
    ]);
  } catch (e) {
    outro(c.red((e as Error).message));
    return c.red((e as Error).message);
  }

  note(linkOutput.trim(), t("modwiz.link"));
  const enableMsg = await maybeEnableModule(pkg.id);
  if (enableMsg) note(enableMsg, t("modwiz.enable"));

  outro(c.green(t("modwiz.linked", { id: pkg.id })));
  return c.green(t("modwiz.linked", { id: pkg.id }));
}

/** 链接 + 启用 + 构建部署（本地开发一键流）。 */
export async function runModuleDevWizard(): Promise<string> {
  if (!isInteractive()) {
    return c.yellow(t("modwiz.needTty.dev"));
  }

  intro(c.bold(t("modwiz.devIntro")));

  const modulesRoot = await ensureSfmcModulesRoot();
  if (!modulesRoot) return cancelMessage();

  const packages = listSfmcModulePackages(modulesRoot);
  if (packages.length === 0) {
    outro(c.yellow(t("modwiz.noDevPackages", { path: modulesRoot })));
    return c.yellow(t("modwiz.noDevShort"));
  }

  const picked = await select({
    message: t("modwiz.pickDev"),
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
        title: t("modwiz.linking", { id: pkg.id }),
        task: async () => {
          const { ok, output } = await runFetchModuleLink(pkg.id, pkg.path);
          if (!ok) throw new Error(output.trim() || t("modwiz.linkFailed"));
          return output.trim().split("\n").pop() ?? "linked";
        },
      },
      {
        title: t("modwiz.enabling", { id: pkg.id }),
        task: async () => {
          const r = await cmdModuleEnable([pkg.id]);
          if (!r.ok) throw new Error(r.message.trim());
          return r.message.trim();
        },
      },
      {
        title: t("modwiz.task.build"),
        task: async () => {
          const { cmdBehaviorPackBuild } = await import("./commands-behavior-pack.js");
          const r = await cmdBehaviorPackBuild([]);
          if (!r.ok) throw new Error(r.message.trim());
          return t("common.done");
        },
      },
      {
        title: t("modwiz.task.deploy"),
        task: async () => {
          const { cmdBehaviorPackDeploy } = await import("./commands-behavior-pack.js");
          const r = await cmdBehaviorPackDeploy([]);
          if (!r.ok) throw new Error(r.message.trim());
          return t("common.done");
        },
      },
    ]);
  } catch (e) {
    outro(c.red((e as Error).message));
    return c.red((e as Error).message);
  }

  note(c.yellow(t("modwiz.devHint")), t("common.hint"));
  outro(c.green(t("modwiz.devDone", { id: pkg.id })));
  return c.green(t("modwiz.devReady", { id: pkg.id }));
}

export { isInteractive as isModuleWizardInteractive };
