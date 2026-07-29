/**
 * module-wizard.ts — 模块脚手架 / 本地联调交互向导
 *
 * 单包根（template 同构）：不写入旁路 sfmc-modules monorepo。
 */

import { confirm, intro, isCancel, note, outro, select, tasks, text } from "@clack/prompts";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { t, type MessageKey } from "./i18n/index.js";
import { cmdModuleEnable } from "./module-commands.js";
import { pickDirectory, resolveUserPath } from "./interactive-prompts.js";
import { ROOT, resolveFetchModule, resolveNewModule } from "./runtime.js";
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

type TemplateMeta = { id: string; isDefault: boolean };

async function listTemplatesFromTool(): Promise<TemplateMeta[]> {
  const script = resolveNewModule();
  if (!script) return [];
  const { code, output } = await spawnTool(script, ["--list-templates"]);
  if (code !== 0) return [];
  const out: TemplateMeta[] = [];
  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [id, ...flags] = trimmed.split("\t");
    if (!id) continue;
    out.push({ id, isDefault: flags.includes("default") });
  }
  return out;
}

function tplLabel(id: string): string {
  const label = t(`modwiz.tpl.${id}` as MessageKey);
  return label === `modwiz.tpl.${id}` ? id : label;
}
function tplHint(id: string): string | undefined {
  const hint = t(`modwiz.tpl.${id}Hint` as MessageKey);
  return hint === `modwiz.tpl.${id}Hint` ? undefined : hint;
}

/** 交互式创建单包模块（cwd 或指定空目录），可选 link / enable / build+deploy。 */
export async function runModuleCreateWizard(): Promise<string> {
  if (!isInteractive()) {
    return c.yellow(t("modwiz.needTty.create"));
  }

  intro(c.bold(t("modwiz.createIntro")));
  note(c.dim(t("modwiz.standaloneHint")), t("common.hint"));

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

  const defaultTarget = path.resolve(process.cwd(), folderId);
  const picked = await pickDirectory(t("modwiz.pickPackageRoot"), path.dirname(defaultTarget));
  if (isCancel(picked) || !picked) {
    outro(cancelMessage());
    return cancelMessage();
  }
  const parentDir = resolveUserPath(String(picked), ROOT);
  const target = path.join(parentDir, folderId);
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

  const templates = await listTemplatesFromTool();
  if (templates.length === 0) {
    outro(c.red(t("modwiz.noNewModule")));
    return c.red(t("modwiz.noNewModule"));
  }
  const defaultTpl = templates.find((tpl) => tpl.isDefault) ?? templates[0]!;
  const template = await select({
    message: t("modwiz.template"),
    initialValue: defaultTpl.id,
    options: templates.map((tpl) => {
      const opt: { value: string; label: string; hint?: string } = {
        value: tpl.id,
        label: tplLabel(tpl.id),
      };
      const hint = tplHint(tpl.id);
      if (hint) opt.hint = hint;
      return opt;
    }),
  });
  if (isCancel(template)) {
    outro(cancelMessage());
    return cancelMessage();
  }

  const newModuleScript = resolveNewModule();
  if (!newModuleScript) {
    outro(c.red(t("modwiz.noNewModule")));
    return c.red(t("modwiz.noNewModule"));
  }

  const { mkdirSync } = await import("node:fs");
  mkdirSync(target, { recursive: true });

  let scaffoldOutput = "";
  try {
    await tasks([
      {
        title: t("modwiz.genPackage", { id: folderId }),
        task: async () => {
          const { spawn: spawnChild } = await import("node:child_process");
          const result = await new Promise<{ code: number | null; output: string }>((resolve) => {
            const proc = spawnChild(
              process.execPath,
              [newModuleScript, folderId, "--name", nameRaw.trim(), "--template", String(template)],
              {
                cwd: target,
                stdio: ["ignore", "pipe", "pipe"],
                env: { ...process.env, SFMC_ROOT: ROOT },
              }
            );
            let output = "";
            proc.stdout?.on("data", (d: Buffer) => {
              output += d.toString();
            });
            proc.stderr?.on("data", (d: Buffer) => {
              output += d.toString();
            });
            proc.on("exit", (code) => resolve({ code, output }));
            proc.on("error", (e) => resolve({ code: 1, output: e.message }));
          });
          scaffoldOutput = result.output;
          if (result.code !== 0) throw new Error(result.output.trim() || `exit ${result.code}`);
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

/** 选择本地作者仓目录并 --link 安装。 */
export async function runModuleLinkWizard(): Promise<string> {
  if (!isInteractive()) {
    return c.yellow(t("modwiz.needTty.link"));
  }

  intro(c.bold(t("modwiz.linkIntro")));

  const picked = await pickDirectory(t("modwiz.pickAuthorPkg"), process.cwd());
  if (isCancel(picked) || !picked) {
    outro(cancelMessage());
    return cancelMessage();
  }
  const pkgPath = resolveUserPath(String(picked), ROOT);
  if (!existsSync(path.join(pkgPath, "sapi", "manifest.json"))) {
    outro(c.red(t("modwiz.notModulePkg", { path: pkgPath })));
    return c.red(t("modwiz.notModulePkg", { path: pkgPath }));
  }

  const fetchScript = resolveFetchModule();
  if (!fetchScript) {
    outro(c.red(t("modwiz.noFetch")));
    return c.red(t("modwiz.noFetch"));
  }

  let linkOutput = "";
  try {
    await tasks([
      {
        title: t("modwiz.linking", { id: path.basename(pkgPath) }),
        task: async () => {
          const { code, output } = await spawnTool(fetchScript, [
            "install",
            "--from",
            `dir:${pkgPath}`,
            "--link",
          ]);
          linkOutput = output;
          if (code !== 0) throw new Error(output.trim() || `exit ${code}`);
          return t("common.done");
        },
      },
    ]);
  } catch (e) {
    outro(c.red((e as Error).message));
    return c.red((e as Error).message);
  }

  note(linkOutput.trim(), t("modwiz.link"));
  const folderId = path.basename(pkgPath);
  const enableMsg = await maybeEnableModule(folderId);
  if (enableMsg) note(enableMsg, t("modwiz.enable"));
  await maybeBuildDeploy();

  outro(c.green(t("modwiz.linkDone", { id: folderId })));
  return c.green(t("modwiz.linkDone", { id: folderId }));
}

/** 本地开发提示（不再依赖旁路 sfmc-modules）。 */
export async function runModuleDevWizard(): Promise<string> {
  if (!isInteractive()) {
    return c.yellow(t("modwiz.needTty.dev"));
  }
  intro(c.bold(t("modwiz.devIntro")));
  note(c.text(t("modwiz.devStandalone")), t("common.hint"));
  const doReload = await confirm({
    message: t("modwiz.buildDeploy"),
    initialValue: false,
  });
  if (!isCancel(doReload) && doReload) {
    await maybeBuildDeploy();
  }
  outro(c.green(t("modwiz.reloadHint")));
  return c.dim(t("modwiz.reloadHint"));
}
