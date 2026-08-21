/**
 * panels/ModuleTreeProvider.ts — VS Code TreeDataProvider for SFMC Modules
 *
 * Displays all installed modules (from modules dir) and module repos opened as workspaceFolders.
 * Scan priority: modules dir first, then workspaceFolders as fallback.
 */

import * as vscode from "vscode";
import fs from "node:fs";
import path from "node:path";
import {
  findAllModuleRoots,
  getSfmcRoot,
  cmdModuleInfo,
  cmdEnableModule,
  cmdDisableModule,
} from "./commands.js";
import type { ModuleLock } from "./lock.js";

function readLock(sfmcRoot: string): ModuleLock["modules"] {
  const lockPath = path.join(sfmcRoot, "modules", "module-lock.json");
  if (!fs.existsSync(lockPath)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(lockPath, "utf8")) as ModuleLock;
    return parsed?.modules ?? {};
  } catch {
    return {};
  }
}

function readManifest(modRoot: string): { id: string; name: string; schemaVersion?: number } | null {
  const manifestPath = path.join(modRoot, "sapi", "manifest.json");
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { id: string; name: string; schemaVersion?: number };
  } catch {
    return null;
  }
}

function readPackageName(modRoot: string): string | null {
  const pkgPath = path.join(modRoot, "package.json");
  if (!fs.existsSync(pkgPath)) return null;
  try {
    return (JSON.parse(fs.readFileSync(pkgPath, "utf8")) as { name?: string }).name ?? null;
  } catch {
    return null;
  }
}

type TreeNode = ModuleRootNode | ActionNode;

interface ModuleRootNode {
  kind: "root";
  modRoot: string;
  id: string;
  name: string;
  logicalId: string;
  enabled: boolean;
  pkgName: string | null;
}

interface ActionNode {
  kind: "action";
  label: string;
  icon: string;
  command: string;
  modRoot: string;
}

export interface TreeViewCallbacks {
  onWatchStateChange: (active: boolean) => void;
}

function buildActions(modRoot: string, watchActive: boolean): ActionNode[] {
  const items: ActionNode[] = [];
  if (watchActive) {
    items.push({ kind: "action", label: "Stop Watch", icon: "circle-slash", command: "sfmcModule.stopWatch", modRoot });
  } else {
    items.push({ kind: "action", label: "Start Watch", icon: "eye", command: "sfmcModule.startWatch", modRoot });
  }
  items.push(
    { kind: "action", label: "Run Tests", icon: "beaker", command: "sfmcModule.runTests", modRoot },
    { kind: "action", label: "Link to SFMC Root", icon: "link", command: "sfmcModule.linkModule", modRoot },
    { kind: "action", label: "编译模块", icon: "package", command: "sfmcModule.build", modRoot },
    { kind: "action", label: "Reload to BDS", icon: "sync", command: "sfmcModule.reload", modRoot },
    { kind: "action", label: "启用模块", icon: "check", command: "sfmcModule.enable", modRoot },
    { kind: "action", label: "关闭模块", icon: "circle-slash", command: "sfmcModule.disable", modRoot },
    { kind: "action", label: "Publish to npm", icon: "cloud-upload", command: "sfmcModule.publishModule", modRoot },
    { kind: "action", label: "Module Info", icon: "info", command: "sfmcModule.moduleInfoAction", modRoot }
  );
  return items;
}

export class ModuleTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private watchActive = false;
  private callbacks?: TreeViewCallbacks;

  setWatchActive(active: boolean): void {
    this.watchActive = active;
    this.callbacks?.onWatchStateChange(active);
    this._onDidChangeTreeData.fire();
  }

  setCallbacks(cb: TreeViewCallbacks): void {
    this.callbacks = cb;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    if (element.kind === "root") {
      const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.Expanded);
      item.iconPath = new vscode.ThemeIcon(element.enabled ? "circle-filled" : "circle-outline");
      const status = element.enabled ? "已启用" : "已关闭";
      item.description = element.pkgName ? `${status} · ${element.pkgName}` : status;
      item.tooltip = `${element.logicalId}\n${status}`;
      item.contextValue = "sfmcModule";
      return item;
    } else {
      const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
      item.iconPath = new vscode.ThemeIcon(element.icon);
      item.command = {
        command: element.command,
        title: element.label,
        arguments: [element.modRoot],
      };
      return item;
    }
  }

  async getChildren(element?: TreeNode): Promise<TreeNode[]> {
    if (!element) {
      const modRoots = findAllModuleRoots();
      if (modRoots.length === 0) {
        return [
          {
            kind: "root",
            modRoot: "",
            id: "(no module open)",
            name: "未检测到模块工作区",
            logicalId: "",
            enabled: false,
            pkgName: null,
          },
        ];
      }

      const sfmcRoot = getSfmcRoot();
      const lock = readLock(sfmcRoot);

      return modRoots.map((modRoot): ModuleRootNode => {
        const manifest = readManifest(modRoot);
        const pkgName = readPackageName(modRoot);
        const logicalId = manifest?.id ?? path.basename(modRoot);
        return {
          kind: "root",
          modRoot,
          id: path.basename(modRoot),
          name: manifest?.name ?? path.basename(modRoot),
          logicalId,
          enabled: lock[logicalId]?.enabled !== false,
          pkgName,
        };
      });
    }

    if (element.kind === "root") {
      return buildActions(element.modRoot, this.watchActive);
    }

    return [];
  }
}

export function registerTreeView(context: vscode.ExtensionContext, callbacks: TreeViewCallbacks): void {
  const provider = new ModuleTreeProvider();
  provider.setCallbacks(callbacks);
  vscode.window.createTreeView("sfmcModules", { treeDataProvider: provider });

  context.subscriptions.push(
    vscode.commands.registerCommand("sfmcModule.moduleInfoAction", async (modRoot: string) => {
      await cmdModuleInfo(modRoot);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("sfmcModule.refreshTree", () => {
      provider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("sfmcModule.enable", async (arg?: unknown) => {
      const ok = await cmdEnableModule(arg);
      if (ok) provider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("sfmcModule.disable", async (arg?: unknown) => {
      const ok = await cmdDisableModule(arg);
      if (ok) provider.refresh();
    })
  );

  // 当 startWatch 成功时，通知 provider 更新状态
  context.subscriptions.push(
    vscode.commands.registerCommand("sfmcModule.watchStarted", () => {
      provider.setWatchActive(true);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("sfmcModule.watchStopped", () => {
      provider.setWatchActive(false);
    })
  );

  // stopWatch 命令在 extension.ts 注册（清状态 + 触发 sfmcModule.watchStopped，tree 通过监听该命令更新）。

  context.subscriptions.push(provider);
}
