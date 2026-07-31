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
import { PlaygroundPanel } from "../playground/PlaygroundPanel.js";
import { PlaygroundHostClient, buildHostNodeArgs, resolveHostEntry } from "../playground/hostClient.js";
import { ExtLog } from "../log.js";

let statusBar: vscode.StatusBarItem | undefined;
let extensionContext: vscode.ExtensionContext | undefined;

/** workspaceState：上次脚本沙箱 / 冒烟绑定的模块根 */
const LAST_SANDBOX_MODULE_KEY = "sfmc.sandbox.lastModuleRoot";

export function setStatusBar(sb: vscode.StatusBarItem): void {
  statusBar = sb;
}

export function setExtensionContext(ctx: vscode.ExtensionContext): void {
  extensionContext = ctx;
}

/** Windows 路径对账用。 */
export function normalizeModuleRootKey(p: string): string {
  return path.resolve(p).replace(/\\/g, "/").toLowerCase();
}

export function getLastSandboxModuleRoot(ctx: vscode.ExtensionContext): string | undefined {
  const last = (ctx.workspaceState.get<string>(LAST_SANDBOX_MODULE_KEY) || "").trim();
  if (last && isValidModuleRoot(last)) return last;
  return undefined;
}

export async function rememberSandboxModuleRoot(
  ctx: vscode.ExtensionContext,
  moduleRoot: string
): Promise<void> {
  await ctx.workspaceState.update(LAST_SANDBOX_MODULE_KEY, moduleRoot);
}

export type SandboxModuleResolve = {
  moduleRoot?: string;
  source: "explicit" | "single" | "pick" | "last" | "engine";
};

async function browseModuleRoot(): Promise<string | undefined> {
  const picked = await vscode.window.showOpenDialog({
    canSelectFolders: true,
    canSelectFiles: false,
    openLabel: "选择模块根",
    title: "选择 SFMC 模块根（含 package.json + sapi/manifest.json）",
  });
  const dir = picked?.[0]?.fsPath;
  if (!dir) return undefined;
  if (!isValidModuleRoot(dir)) {
    vscode.window.showErrorMessage(
      `不是有效模块根（需 package.json + sapi/manifest.json schemaVersion 2）：${dir}`
    );
    return undefined;
  }
  return dir;
}

/**
 * 沙箱与「Run Module Tests」共用的 moduleRoot 解析（DIP：有效根判定走 devkit）。
 * 无选中时提示选择或沿用上次，不静默装错包。
 * @returns null 表示用户取消
 */
export async function resolveSandboxModuleRoot(
  ctx: vscode.ExtensionContext,
  opts?: { explicit?: string; requireModule?: boolean }
): Promise<SandboxModuleResolve | null> {
  const explicit = opts?.explicit?.trim();
  if (explicit) {
    if (!isValidModuleRoot(explicit)) {
      vscode.window.showErrorMessage(`不是有效模块根: ${explicit}`);
      ExtLog.error("sandbox", `无效 moduleRoot=${explicit}`);
      return null;
    }
    await rememberSandboxModuleRoot(ctx, explicit);
    return { moduleRoot: explicit, source: "explicit" };
  }

  const roots = findAllModuleRoots();
  const last = getLastSandboxModuleRoot(ctx);

  if (roots.length === 1) {
    const only = roots[0]!;
    await rememberSandboxModuleRoot(ctx, only);
    return { moduleRoot: only, source: "single" };
  }

  if (roots.length > 1) {
    type PickItem = vscode.QuickPickItem & { modRoot?: string; kind?: "last" | "root" };
    const picks: PickItem[] = [];
    if (last && roots.some((r) => normalizeModuleRootKey(r) === normalizeModuleRootKey(last))) {
      const info = readModuleRootInfo(last);
      picks.push({
        label: `$(history) 沿用上次：${info?.id ?? path.basename(last)}`,
        description: last,
        detail: "上次脚本沙箱 / 冒烟使用的模块",
        modRoot: last,
        kind: "last",
      });
    }
    for (const r of roots) {
      const info = readModuleRootInfo(r);
      picks.push({
        label: info?.id ?? path.basename(r),
        description: r,
        modRoot: r,
        kind: "root",
      });
    }
    const pick = await vscode.window.showQuickPick(picks, {
      placeHolder: "选择要装入沙箱的模块（请确认，勿静默装错包）",
    });
    if (!pick?.modRoot) return null;
    await rememberSandboxModuleRoot(ctx, pick.modRoot);
    return {
      moduleRoot: pick.modRoot,
      source: pick.kind === "last" ? "last" : "pick",
    };
  }

  // 零模块：提示选择 / 沿用上次 / 仅引擎
  if (last) {
    type ZeroPick = vscode.QuickPickItem & { id: "last" | "browse" | "engine" };
    const items: ZeroPick[] = [
      {
        label: `$(history) 沿用上次：${path.basename(last)}`,
        description: last,
        id: "last",
      },
      { label: "打开文件夹选择模块根…", id: "browse" },
    ];
    if (!opts?.requireModule) {
      items.push({ label: "仅引擎（不装模块）", id: "engine" });
    }
    const choice = await vscode.window.showQuickPick(items, {
      placeHolder: "未检测到模块工作区 — 请选择模块或沿用上次",
    });
    if (!choice) return null;
    if (choice.id === "last") return { moduleRoot: last, source: "last" };
    if (choice.id === "engine") return { moduleRoot: undefined, source: "engine" };
    const browsed = await browseModuleRoot();
    if (!browsed) return null;
    await rememberSandboxModuleRoot(ctx, browsed);
    return { moduleRoot: browsed, source: "pick" };
  }

  if (opts?.requireModule) {
    const open = "打开模块根目录";
    const choice = await vscode.window.showInformationMessage(
      "未检测到 SFMC 模块（需 package.json + sapi/manifest.json schemaVersion 2）",
      open
    );
    if (choice === open) {
      const browsed = await browseModuleRoot();
      if (!browsed) return null;
      await rememberSandboxModuleRoot(ctx, browsed);
      return { moduleRoot: browsed, source: "pick" };
    }
    return null;
  }

  const choice = await vscode.window.showQuickPick(
    [
      { label: "打开文件夹选择模块根…", id: "browse" as const },
      { label: "仅引擎（不装模块）", id: "engine" as const },
    ],
    { placeHolder: "未检测到模块 — 请选择模块根或仅引擎" }
  );
  if (!choice) return null;
  if (choice.id === "engine") return { moduleRoot: undefined, source: "engine" };
  const browsed = await browseModuleRoot();
  if (!browsed) return null;
  await rememberSandboxModuleRoot(ctx, browsed);
  return { moduleRoot: browsed, source: "pick" };
}

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

/** 打开 1:1 脚本沙箱；与冒烟共用 resolveSandboxModuleRoot。 */
export async function cmdOpenPlayground(modRootArg?: unknown): Promise<void> {
  if (!extensionContext) {
    vscode.window.showErrorMessage("扩展上下文未就绪");
    return;
  }
  const explicit = coerceModRoot(modRootArg);
  const resolved = await resolveSandboxModuleRoot(extensionContext, { explicit });
  if (!resolved) return;
  const label = resolved.moduleRoot ?? "(engine only)";
  ExtLog.info("sandbox", `moduleRoot=${label} source=${resolved.source}`);
  PlaygroundPanel.show(extensionContext, resolved.moduleRoot);
}

/**
 * 冒烟：装载模块 → 对已注册命令走 !name + chatSend。
 * 不 spawn npm test；不直接 triggerCommand。
 * moduleRoot 解析与脚本沙箱同源。
 */
export async function cmdRunTests(modRootArg?: unknown): Promise<void> {
  if (!extensionContext) {
    vscode.window.showErrorMessage("扩展上下文未就绪");
    return;
  }
  const explicit = coerceModRoot(modRootArg);
  const resolved = await resolveSandboxModuleRoot(extensionContext, {
    explicit,
    requireModule: true,
  });
  if (!resolved?.moduleRoot) return;
  const modRoot = resolved.moduleRoot;

  ExtLog.show();
  ExtLog.info("sandbox", `moduleRoot=${modRoot} source=${resolved.source}（冒烟）`);
  ExtLog.info("smoke", `开始冒烟 ${modRoot}`);
  if (statusBar) statusBar.text = "SFMC $(sync~spin) smoke";

  const client = new PlaygroundHostClient((ev) => {
    if (ev.name === "log") {
      const p = ev.payload as { text?: string };
      if (p?.text) ExtLog.info("smoke", p.text);
    }
  }, modRoot);

  try {
    const startResult = (await client.request("start", { moduleRoot: modRoot })) as {
      module?: { id?: string; version?: string | null; enabled?: boolean | null } | null;
      subscribedEvents?: { path: string; listeners: number }[];
    };
    const mid = startResult.module?.id ?? "?";
    ExtLog.info(
      "smoke",
      `已装 DESCRIPTOR id=${mid} version=${startResult.module?.version ?? "?"} enabled=${startResult.module?.enabled ?? "?"}`
    );
    const subs = startResult.subscribedEvents ?? [];
    if (subs.length > 0) {
      ExtLog.info(
        "smoke",
        `subscribed=[${subs.map((e) => `${e.path}×${e.listeners}`).join(", ")}]`
      );
    }
    const result = (await client.request("smoke.run", {})) as {
      ok: boolean;
      commands: string[];
      results: { name: string; ok: boolean; log: string[] }[];
    };
    const failed = (result.results ?? []).filter((r) => !r.ok);
    for (const r of result.results ?? []) {
      ExtLog.info("smoke", `!${r.name} → ${r.ok ? "ok" : "FAIL"}`);
      if (!r.ok) {
        for (const line of r.log) ExtLog.raw("smoke", line);
      }
    }
    if (result.ok) {
      ExtLog.info("smoke", `通过（${result.commands?.length ?? 0} 条命令）`);
      vscode.window.showInformationMessage(
        `模块冒烟通过（${result.commands?.length ?? 0} 条 ! 命令）· ${mid}`
      );
      if (statusBar) statusBar.text = "SFMC $(check)";
    } else {
      ExtLog.error("smoke", `失败 ${failed.length}/${result.results?.length ?? 0}`);
      vscode.window.showErrorMessage(`模块冒烟失败 ${failed.length} 条，见「SFMC 扩展」输出`);
      if (statusBar) statusBar.text = "SFMC $(error)";
    }
    // 沙箱已开且同 moduleRoot：重置场景以对齐刚冒烟的模块装载
    await PlaygroundPanel.alignAfterSmoke(modRoot);
  } catch (e) {
    const text = e instanceof Error ? e.message : String(e);
    ExtLog.error("smoke", text);
    vscode.window.showErrorMessage(`冒烟失败: ${text}`);
    if (statusBar) statusBar.text = "SFMC $(error)";
  } finally {
    client.dispose();
  }
}

/**
 * 启动并调试：debug.startDebugging → playground-host + source map，
 * 断点目标为模块 sapi/src。
 */
export async function cmdStartDebug(modRootArg?: unknown): Promise<void> {
  if (!extensionContext) {
    vscode.window.showErrorMessage("扩展上下文未就绪");
    return;
  }
  const explicit = coerceModRoot(modRootArg);
  const resolved = await resolveSandboxModuleRoot(extensionContext, {
    explicit,
    requireModule: true,
  });
  if (!resolved?.moduleRoot) return;
  const modRoot = resolved.moduleRoot;
  let entry;
  try {
    entry = resolveHostEntry();
  } catch (e) {
    vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
    return;
  }
  if (!fs.existsSync(entry.hostFs)) {
    vscode.window.showErrorMessage(`playground-host 未构建: ${entry.hostFs}`);
    return;
  }

  const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(modRoot));
  const nodeArgs = buildHostNodeArgs(entry);
  const config: vscode.DebugConfiguration = {
    type: "node",
    request: "launch",
    name: "SFMC 脚本沙箱调试",
    runtimeExecutable: process.execPath,
    runtimeArgs: nodeArgs.slice(0, -1),
    program: entry.hostFs,
    cwd: modRoot,
    env: {
      ...process.env,
      SFMC_PLAYGROUND_MODULE_ROOT: modRoot,
    },
    console: "integratedTerminal",
    sourceMaps: true,
    skipFiles: ["<node_internals>/**"],
  };

  ExtLog.info("sandbox", `moduleRoot=${modRoot} source=${resolved.source}（调试）`);
  ExtLog.info("debug", `启动并调试 module=${modRoot}`);
  ExtLog.show(true);
  const ok = await vscode.debug.startDebugging(folder, config);
  if (!ok) {
    vscode.window.showErrorMessage("启动调试会话失败");
    return;
  }
  vscode.window.showInformationMessage(
    "已启动 playground-host 调试。在 sapi/src 下断点；终端内可对 stdin 发送 JSON-RPC（start / smoke.run）。"
  );
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
