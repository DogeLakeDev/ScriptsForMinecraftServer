/**
 * panels/commands.ts — QuickPick / InputBox 命令实现（供 TreeView 调用）
 */

import * as vscode from "vscode";
import fs from "node:fs";
import path from "node:path";
import {
  scaffoldModule,
  isValidModuleRoot,
  isValidSfmcRoot,
  findModuleRootFromFile,
  readModuleRootInfo,
  setModuleEnabled,
} from "@sfmc-bds/devkit";
import { ExtLog } from "../log.js";

/** 读取 sfmc.root；未配置返回空字符串（不猜工作区）。 */
export function getSfmcRootConfigured(): string {
  return (vscode.workspace.getConfiguration("sfmc").get<string>("root") || "").trim();
}

/** 可选：显式 sfmc CLI 入口（.js/.mjs）；空则由 devkit 从安装树 / PATH / SFMC_CLI 解析。 */
export function getSfmcCliPathConfigured(): string {
  return (vscode.workspace.getConfiguration("sfmc").get<string>("cliPath") || "").trim();
}

/**
 * 弹文件夹选择器并写入 Workspace `sfmc.root`（工作目录）。
 * ensureSfmcRoot（缺目录）与 cmdSetSfmcRoot（显式修改）共用，避免两套分叉。
 */
export async function pickAndWriteSfmcRoot(): Promise<string | null> {
  const existing = getSfmcRootConfigured();
  const picked = await vscode.window.showOpenDialog({
    canSelectFolders: true,
    canSelectFiles: false,
    title: "选择 SFMC 工作目录",
    openLabel: "选择 SFMC 工作目录",
    defaultUri: existing && fs.existsSync(existing) ? vscode.Uri.file(existing) : undefined,
  });
  if (!picked?.[0]) return null;
  const root = picked[0].fsPath;
  if (!isValidSfmcRoot(root)) {
    vscode.window.showErrorMessage(
      `所选目录不是有效 SFMC 工作目录（需含 configs/ 与 modules/）：${root}`
    );
    ExtLog.error("sfmc.root", `无效工作目录 ${root}（需含 configs/ 与 modules/）`);
    return null;
  }
  await vscode.workspace
    .getConfiguration("sfmc")
    .update("root", root, vscode.ConfigurationTarget.Workspace);
  ExtLog.info("sfmc.root", `工作目录已设为 ${root}`);
  return root;
}

/** 获取 SFMC 工作目录；缺失或无效时弹目录选择并写入 Workspace 设置。取消返回 null。 */
export async function ensureSfmcRoot(): Promise<string | null> {
  const existing = getSfmcRootConfigured();
  if (existing && isValidSfmcRoot(existing)) return existing;
  if (existing) {
    const reason = fs.existsSync(existing)
      ? "需含 configs/ 与 modules/（运行时工作目录，不必是源码仓库）"
      : "路径不存在";
    vscode.window.showWarningMessage(`当前 sfmc.root 无效（${reason}）：${existing}`);
    ExtLog.warn("sfmc.root", `无效 ${existing}（${reason}）`);
  }
  return pickAndWriteSfmcRoot();
}

/** 显式修改 sfmc.root（工作目录）：始终弹出选择器，写 Workspace 设置后刷新 Tree。 */
export async function cmdSetSfmcRoot(): Promise<string | null> {
  const root = await pickAndWriteSfmcRoot();
  if (!root) return null;
  await vscode.commands.executeCommand("sfmcModule.refreshTree");
  vscode.window.showInformationMessage(`SFMC 工作目录已设为：${root}`);
  return root;
}

/**
 * 已配置的 sfmc.root（可能为空）。不猜工作区第一项。
 * Tree 只读 lock 时用；Watch / 编译 / Reload / 启停须走 ensureSfmcRoot。
 */
export function getSfmcRoot(): string {
  return getSfmcRootConfigured();
}

/**
 * 发现有效模块根：活动编辑器向上 + 各 workspaceFolder 自身。
 * 不扫 sfmc.root/modules/packages。
 */
export function findAllModuleRoots(): string[] {
  const roots: string[] = [];
  const seen = new Set<string>();

  const add = (dir: string | null | undefined) => {
    if (!dir || seen.has(dir) || !isValidModuleRoot(dir)) return;
    seen.add(dir);
    roots.push(dir);
  };

  const editor = vscode.window.activeTextEditor?.document.uri.fsPath;
  if (editor) add(findModuleRootFromFile(editor));

  for (const f of vscode.workspace.workspaceFolders ?? []) {
    add(f.uri.fsPath);
  }

  return roots;
}

export async function pickModuleRoot(): Promise<string | undefined> {
  const roots = findAllModuleRoots();
  if (roots.length === 0) {
    const open = "打开模块根目录";
    const choice = await vscode.window.showInformationMessage(
      "未检测到 SFMC 模块（需 package.json + sapi/manifest.json schemaVersion 2）",
      open
    );
    if (choice === open) {
      await vscode.commands.executeCommand("vscode.openFolder");
    }
    return undefined;
  }
  if (roots.length === 1) return roots[0];
  const picks = roots.map((r) => {
    const info = readModuleRootInfo(r);
    return { label: info?.id ?? path.basename(r), description: r, modRoot: r };
  });
  const pick = await vscode.window.showQuickPick(picks, { placeHolder: "选择模块" });
  return pick?.modRoot;
}

export async function cmdNewModule(): Promise<void> {
  const id = await vscode.window.showInputBox({
    prompt: "模块 id（kebab-case）",
    placeHolder: "my-feature",
  });
  if (!id) return;

  const name = await vscode.window.showInputBox({
    prompt: "显示名",
    value: id,
  });

  const folder = await vscode.window.showOpenDialog({
    canSelectFolders: true,
    canSelectFiles: false,
    openLabel: "选择空目录作为模块根",
  });
  if (!folder?.[0]) return;

  ExtLog.show();
  const target = path.join(folder[0].fsPath, id);
  const r = await scaffoldModule({ targetDir: target, moduleId: id, displayName: name || id });
  if (r.ok) {
    ExtLog.info("newModule", r.message);
    vscode.window.showInformationMessage(
      `已创建模块 ${id}：${target}\n请在 SFMC 工作目录通过 sfmc mod install <id> --from dir:${target} --link 联调。`
    );
  } else {
    ExtLog.error("newModule", r.message);
    vscode.window.showErrorMessage(r.message);
  }
}

export async function cmdModuleInfo(modRoot: string): Promise<void> {
  const folderId = path.basename(modRoot);
  const info = readModuleRootInfo(modRoot);
  ExtLog.info(
    "moduleInfo",
    [
      folderId,
      `path=${modRoot}`,
      `id=${info?.id ?? "(none)"}`,
      `name=${info?.name ?? "(none)"}`,
      `schemaVer=${info?.schemaVersion ?? "(none)"}`,
    ].join(" | ")
  );
  ExtLog.show();
}

/** Tree / 命令面板传入的模块根：字符串或带 modRoot 的节点。 */
function coerceModRoot(arg?: unknown): string | undefined {
  if (typeof arg === "string" && arg.trim()) return arg.trim();
  if (arg && typeof arg === "object" && "modRoot" in arg) {
    const root = (arg as { modRoot?: unknown }).modRoot;
    if (typeof root === "string" && root.trim()) return root.trim();
  }
  return undefined;
}

/**
 * 启用或关闭模块：写 `${sfmc.root}/modules/module-lock.json`（经 `sfmc mod enable|disable`）。
 * 成功后由调用方刷新 Tree。
 */
export async function cmdSetModuleEnabled(enabled: boolean, modRootArg?: unknown): Promise<boolean> {
  let modRoot = coerceModRoot(modRootArg);
  if (!modRoot) {
    modRoot = await pickModuleRoot();
    if (!modRoot) return false;
  }
  if (!isValidModuleRoot(modRoot)) {
    vscode.window.showErrorMessage(`不是有效模块根: ${modRoot}`);
    return false;
  }

  const info = readModuleRootInfo(modRoot);
  const moduleId = info?.id;
  if (!moduleId) {
    vscode.window.showErrorMessage(`无法读取模块 id: ${modRoot}`);
    return false;
  }

  const sfmcRoot = await ensureSfmcRoot();
  if (!sfmcRoot) return false;

  const action = enabled ? "enable" : "disable";
  const label = enabled ? "启用" : "关闭";
  ExtLog.show();
  ExtLog.info(action, `module=${moduleId} 工作目录=${sfmcRoot}`);

  const cliPath = getSfmcCliPathConfigured() || undefined;
  const r = await setModuleEnabled({ sfmcRoot, moduleId, enabled, cliPath });
  ExtLog.raw(action, r.output);
  if (r.ok) {
    vscode.window.showInformationMessage(`已${label}模块 ${moduleId}`);
    return true;
  }
  ExtLog.error(action, `${label}失败`);
  vscode.window.showErrorMessage(`${label}模块失败，见「SFMC 扩展」输出`);
  return false;
}

export async function cmdEnableModule(modRootArg?: unknown): Promise<boolean> {
  return cmdSetModuleEnabled(true, modRootArg);
}

export async function cmdDisableModule(modRootArg?: unknown): Promise<boolean> {
  return cmdSetModuleEnabled(false, modRootArg);
}

const LEVEL_PICKS: { label: string; level: "debug" | "info" | "warn" | "error" }[] = [
  { label: "debug（全部）", level: "debug" },
  { label: "info+", level: "info" },
  { label: "warn+", level: "warn" },
  { label: "error", level: "error" },
];

/** Output 日志过滤：级别下限 + scope 白名单（写入前过滤；历史需清除） */
export async function cmdConfigureLogFilter(): Promise<void> {
  const cur = ExtLog.getFilter();
  const levelPick = await vscode.window.showQuickPick(
    LEVEL_PICKS.map((p) => ({
      label: p.label,
      description: p.level === cur.minLevel ? "当前" : undefined,
      level: p.level,
    })),
    { title: "日志级别下限", placeHolder: `当前：${ExtLog.describeFilter()}` }
  );
  if (!levelPick) return;

  const scopeRaw = await vscode.window.showInputBox({
    title: "scope 白名单（逗号分隔；空=全部）",
    prompt: "例：watch,build,chat — 匹配 ExtLog source / 模块 id",
    value: cur.scopes.join(","),
    placeHolder: "留空显示全部 scope",
  });
  if (scopeRaw === undefined) return;

  const scopes = scopeRaw
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  await ExtLog.setFilter({ minLevel: levelPick.level, scopes });
  ExtLog.info("filter", `已设置：${ExtLog.describeFilter()}（仅新写入生效；可用「清除并应用过滤」）`);
  ExtLog.show(true);
  vscode.window.showInformationMessage(`日志过滤：${ExtLog.describeFilter()}`);
}

/** 清空 Output 并写入当前过滤说明 */
export async function cmdClearAndApplyLogFilter(): Promise<void> {
  ExtLog.clearAndAnnounceFilter();
  ExtLog.show(false);
  vscode.window.showInformationMessage(`已清除 Output；${ExtLog.describeFilter()}`);
}
