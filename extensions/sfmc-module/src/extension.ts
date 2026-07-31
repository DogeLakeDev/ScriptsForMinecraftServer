/**
 * SFMC Module — VS Code/Cursor 扩展入口
 */

import * as vscode from "vscode";
import { startModuleWatch, rebuildAndDeploy } from "@sfmc-bds/devkit";
import {
  setStatusBar,
  setExtensionContext,
  ensureSfmcRoot,
  cmdNewModule,
  cmdRunTests,
  cmdOpenPlayground,
  pickModuleRoot,
} from "./panels/commands.js";
import { registerTreeView } from "./panels/ModuleTreeProvider.js";
import { ExtLog } from "./log.js";

const WATCH_STATE_KEY = "sfmc:watchActive";

let watchStop: (() => void) | null = null;
let statusBar: vscode.StatusBarItem | undefined;

export function activate(context: vscode.ExtensionContext): void {
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  statusBar.text = "SFMC";
  statusBar.tooltip = "SFMC Module extension";
  statusBar.show();
  context.subscriptions.push(statusBar, ExtLog.channel());

  setStatusBar(statusBar);
  setExtensionContext(context);
  ExtLog.info("activate", "SFMC Module 扩展已激活");

  registerTreeView(context, {
    onWatchStateChange: (active) => {
      if (statusBar) statusBar.text = active ? "SFMC $(eye) watch" : "SFMC";
    },
  });

  context.subscriptions.push(
    vscode.commands.registerCommand("sfmcModule.showLog", () => {
      ExtLog.show(false);
    }),
    vscode.commands.registerCommand("sfmcModule.newModule", async () => {
      await cmdNewModule();
    }),
    vscode.commands.registerCommand("sfmcModule.runTests", async () => {
      await cmdRunTests();
    }),
    vscode.commands.registerCommand("sfmcModule.openPlayground", async () => {
      await cmdOpenPlayground();
    }),
    vscode.commands.registerCommand("sfmcModule.startWatch", async () => {
      const modRoot = await pickModuleRoot();
      if (!modRoot) return;
      if (watchStop) {
        vscode.window.showWarningMessage("Watch 已在运行");
        return;
      }
      const sfmcRoot = await ensureSfmcRoot();
      if (!sfmcRoot) return;
      ExtLog.show();
      ExtLog.info("watch", `启动 module=${modRoot} sfmc.root=${sfmcRoot}`);
      const handle = startModuleWatch({
        moduleRoot: modRoot,
        log: (line) => ExtLog.info("watch", line),
        onRebuild: async () => {
          const r = await rebuildAndDeploy({ sfmcRoot });
          ExtLog.raw("rebuild", r.output);
          return { ok: r.ok, message: r.output.slice(0, 500) };
        },
      });
      watchStop = handle.stop;
      void context.workspaceState.update(WATCH_STATE_KEY, true);
      if (statusBar) statusBar.text = "SFMC $(eye) watch";
      void vscode.commands.executeCommand("sfmcModule.watchStarted");
      vscode.window.showInformationMessage("SFMC Watch 已启动");
    }),
    vscode.commands.registerCommand("sfmcModule.stopWatch", () => {
      if (watchStop) {
        watchStop();
        watchStop = null;
        void context.workspaceState.update(WATCH_STATE_KEY, false);
        ExtLog.info("watch", "已停止");
      }
      if (statusBar) statusBar.text = "SFMC";
      void vscode.commands.executeCommand("sfmcModule.watchStopped");
    }),
    vscode.commands.registerCommand("sfmcModule.reload", async () => {
      const sfmcRoot = await ensureSfmcRoot();
      if (!sfmcRoot) return;
      ExtLog.show();
      ExtLog.info("reload", `SFMC_ROOT=${sfmcRoot}`);
      const r = await rebuildAndDeploy({ sfmcRoot });
      ExtLog.raw("reload", r.output);
      if (r.ok) vscode.window.showInformationMessage("Rebuild/deploy 完成");
      else {
        ExtLog.error("reload", "Rebuild 失败");
        vscode.window.showErrorMessage("Rebuild 失败，见「SFMC 扩展」输出");
      }
    })
  );
}

export function deactivate(): void {
  if (watchStop) watchStop();
  ExtLog.info("deactivate", "扩展停用");
}
