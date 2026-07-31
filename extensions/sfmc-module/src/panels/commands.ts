/**
 * panels/commands.ts — QuickPick / InputBox 命令实现（供 TreeView 调用）
 */

import * as vscode from "vscode";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  scaffoldModule,
  isValidModuleRoot,
  findModuleRootFromFile,
  readModuleRootInfo,
} from "@sfmc-bds/devkit";
import { applyLockEnabled, type ModuleLock } from "./lock.js";
import { PlaygroundPanel } from "../playground/PlaygroundPanel.js";
import { ExtLog } from "../log.js";

let statusBar: vscode.StatusBarItem | undefined;
let extensionContext: vscode.ExtensionContext | undefined;

export function setStatusBar(sb: vscode.StatusBarItem): void {
  statusBar = sb;
}

export function setExtensionContext(ctx: vscode.ExtensionContext): void {
  extensionContext = ctx;
}

/** 读取 sfmc.root；未配置返回空字符串（不猜工作区）。 */
export function getSfmcRootConfigured(): string {
  return (vscode.workspace.getConfiguration("sfmc").get<string>("root") || "").trim();
}

/** 获取 SFMC 根目录；缺失时弹目录选择并写入 Workspace 设置。取消返回 null。 */
export async function ensureSfmcRoot(): Promise<string | null> {
  const existing = getSfmcRootConfigured();
  if (existing && fs.existsSync(existing)) return existing;
  const picked = await vscode.window.showOpenDialog({
    canSelectFolders: true,
    canSelectFiles: false,
    openLabel: "选择 SFMC 主仓根目录",
  });
  if (!picked?.[0]) return null;
  const root = picked[0].fsPath;
  await vscode.workspace
    .getConfiguration("sfmc")
    .update("root", root, vscode.ConfigurationTarget.Workspace);
  return root;
}

/** 同步读取：已配置优先；否则工作区第一项（仅兼容旧调用，Watch 请用 ensureSfmcRoot）。 */
export function getSfmcRoot(): string {
  return getSfmcRootConfigured() || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
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

function readLogicalId(modRoot: string): string {
  return readModuleRootInfo(modRoot)?.id ?? path.basename(modRoot);
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

/** 打开 1:1 Playground（无模块根也可 engine-only）。 */
export async function cmdOpenPlayground(): Promise<void> {
  if (!extensionContext) {
    vscode.window.showErrorMessage("扩展上下文未就绪");
    return;
  }
  const roots = findAllModuleRoots();
  const modRoot = roots.length === 1 ? roots[0] : roots.length > 1 ? await pickModuleRoot() : undefined;
  ExtLog.info("playground", modRoot ? `打开 ${modRoot}` : "打开（engine only）");
  PlaygroundPanel.show(extensionContext, modRoot);
}

export async function cmdRunTests(modRoot?: string): Promise<void> {
  if (!modRoot) {
    modRoot = await pickModuleRoot();
    if (!modRoot) return;
  }

  // 第一版：打开 Playground 作为验证主路径；手写 npm test 仍可在终端跑
  if (!extensionContext) {
    vscode.window.showErrorMessage("扩展上下文未就绪");
    return;
  }
  PlaygroundPanel.show(extensionContext, modRoot);
  ExtLog.info("playground", `已打开；手写 npm test 请在终端运行。模块: ${modRoot}`);
  if (statusBar) statusBar.text = "SFMC playground";
}

export async function cmdEnable(modRoot: string): Promise<void> {
  writeLock(modRoot, true);
}

export async function cmdDisable(modRoot: string): Promise<void> {
  writeLock(modRoot, false);
}

function writeLock(modRoot: string, enabled: boolean): void {
  const logicalId = readLogicalId(modRoot);
  const sfmcRoot = getSfmcRoot();
  const lockPath = path.join(sfmcRoot, "modules", "module-lock.json");
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });

  let lock: ModuleLock = { version: 1, modules: {} };
  if (fs.existsSync(lockPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(lockPath, "utf8")) as ModuleLock;
      if (parsed && typeof parsed === "object") lock = parsed;
    } catch {
      /* 损坏的 lock 由 sfmc CLI / db-server 修复 */
    }
  }

  applyLockEnabled(lock, logicalId, enabled);
  fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`, "utf8");

  vscode.window.showInformationMessage(`${enabled ? "已启用" : "已禁用"}: ${logicalId}`);
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

/** 可选：仍支持 spawn npm test（调试用）。 */
export async function cmdNpmTest(modRoot: string): Promise<void> {
  ExtLog.show();
  ExtLog.info("npmTest", modRoot);
  const isWin = process.platform === "win32";
  const cmd = isWin ? "cmd.exe" : "npm";
  const args = isWin ? ["/c", "npm", "test"] : ["test"];
  if (statusBar) statusBar.text = "SFMC $(sync~spin) test";
  await new Promise<void>((resolve) => {
    const proc = spawn(cmd, args, { cwd: modRoot, env: process.env });
    proc.stdout?.on("data", (d) => ExtLog.raw("npmTest", d.toString()));
    proc.stderr?.on("data", (d) => ExtLog.raw("npmTest", d.toString()));
    proc.on("exit", (code) => {
      ExtLog.info("npmTest", `exit ${code ?? "?"}`);
      if (statusBar) statusBar.text = code === 0 ? "SFMC $(check)" : "SFMC $(error)";
      resolve();
    });
    proc.on("error", (e) => {
      ExtLog.error("npmTest", e.message);
      if (statusBar) statusBar.text = "SFMC $(error)";
      resolve();
    });
  });
}
