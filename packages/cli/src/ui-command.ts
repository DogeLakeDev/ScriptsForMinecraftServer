/**
 * ui-command.ts — sfmc ui 命令：UI Studio 声明式界面可视化编辑器。
 *
 * - `sfmc ui studio`：启动本地 Studio 服务并打开浏览器；
 *   argv 模式下进程驻留，Ctrl+C 停止；REPL 模式下后台运行，用 `/ui stop` 停止。
 * - `sfmc ui stop`：停止当前进程内运行的 Studio 服务。
 *
 * Studio 是项目化的纯浏览器应用：工程存于浏览器 IndexedDB，
 * 通过 zip 导入导出，不依赖磁盘上的真实模块目录。
 * 服务实现为 @sfmc-bds/sdk/ui-studio 的纯静态托管，本文件只负责命令行装配。
 */
import { spawn } from "node:child_process";
import {
  startUiStudioServer,
  type UiStudioServerHandle,
} from "@sfmc-bds/sdk/ui-studio";
import { t } from "./i18n/index.js";
import { c } from "./theme.js";

/** 当前进程内运行的 Studio 服务（同一时刻只允许一个实例）。 */
let running: UiStudioServerHandle | null = null;

export interface CmdUiOptions {
  /** argv 模式为 true：启动后驻留进程直到 Ctrl+C；REPL 模式为 false：立即返回。 */
  block: boolean;
}

export async function cmdUi(args: string[], options: CmdUiOptions): Promise<string> {
  const [sub] = args;
  switch (sub) {
    case "studio":
      return cmdUiStudio(options);
    case "stop":
      return cmdUiStop();
    default:
      return c.yellow(t("ui.usage"));
  }
}

async function cmdUiStudio(options: CmdUiOptions): Promise<string> {
  if (running) {
    return c.yellow(t("ui.studio.already", { url: running.url }));
  }
  let handle: UiStudioServerHandle;
  try {
    handle = await startUiStudioServer();
  } catch (error) {
    return c.yellow(
      t("ui.studio.failed", { message: (error as Error).message }),
    );
  }
  running = handle;

  const started = t("ui.studio.started", { url: handle.url });
  openBrowser(handle.url);

  if (!options.block) {
    // REPL：后台运行，返回启动信息由 REPL 打印。
    return started;
  }

  // argv：打印启动信息后驻留，直到 Ctrl+C / SIGTERM。
  console.log(started);
  console.log(c.dim(t("ui.studio.hint")));
  await new Promise<void>((resolve) => {
    const done = () => resolve();
    process.once("SIGINT", done);
    process.once("SIGTERM", done);
  });
  await stopRunning();
  return c.dim(t("ui.studio.stopped"));
}

async function cmdUiStop(): Promise<string> {
  if (!running) return c.yellow(t("ui.studio.notRunning"));
  await stopRunning();
  return t("ui.studio.stopped");
}

async function stopRunning(): Promise<void> {
  const handle = running;
  running = null;
  if (handle) await handle.close();
}

/** 用系统默认浏览器打开地址；失败不阻断（用户可手动复制 URL）。 */
function openBrowser(url: string): void {
  try {
    const [cmd, args] =
      process.platform === "win32"
        ? ["cmd", ["/c", "start", '""', url]]
        : process.platform === "darwin"
          ? ["open", [url]]
          : ["xdg-open", [url]];
    const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
    child.unref();
  } catch {
    // 忽略：无图形环境或缺少 xdg-open 时仅打印 URL。
  }
}
