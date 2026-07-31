/**
 * SFMC 脚本沙箱（sapi-sandbox）Webview — xyflow + Radix，无 Elements
 */

import * as vscode from "vscode";
import path from "node:path";
import { PlaygroundHostClient } from "./hostClient.js";
import { ExtLog } from "../log.js";

type Meta = {
  classes: Record<
    string,
    { properties: { name: string; readonly?: boolean; type?: string }[]; methods: { name: string }[]; kind?: string }
  >;
  events: Record<string, string[]>;
  eventTypes: Record<string, { eventType: string; signalType: string }>;
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

function normalizeRootKey(p: string): string {
  return path.resolve(p).replace(/\\/g, "/").toLowerCase();
}

/** 与手动保存同一 schema：schemaVersion + nodes + edges */
type SandboxScript = {
  schemaVersion: number;
  nodes: unknown[];
  edges: unknown[];
};

function isSandboxScript(v: unknown): v is SandboxScript {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return Array.isArray(o.nodes) && Array.isArray(o.edges);
}

export class PlaygroundPanel {
  static current: PlaygroundPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly host: PlaygroundHostClient;
  private readonly extensionUri: vscode.Uri;
  private readonly context: vscode.ExtensionContext;
  private readonly moduleRoot?: string;
  private meta: Meta | null = null;
  private disposed = false;

  /**
   * 打开脚本沙箱并绑定 moduleRoot。
   * 已开面板且根不同 → 关闭后重建（避免静默装错包）。
   */
  static show(context: vscode.ExtensionContext, moduleRoot?: string): void {
    const nextKey = moduleRoot ? normalizeRootKey(moduleRoot) : "";
    if (PlaygroundPanel.current) {
      const curKey = PlaygroundPanel.current.moduleRoot
        ? normalizeRootKey(PlaygroundPanel.current.moduleRoot)
        : "";
      if (curKey === nextKey) {
        PlaygroundPanel.current.panel.reveal(vscode.ViewColumn.Active, false);
        ExtLog.info("sandbox", `moduleRoot=${moduleRoot ?? "(engine only)"}（已打开，复用）`);
        return;
      }
      ExtLog.info(
        "sandbox",
        `切换模块 ${curKey || "(engine)"} → ${nextKey || "(engine)"}，重建面板`
      );
      PlaygroundPanel.current.panel.dispose();
    }
    // 在当前编辑器组打开为新标签页（占满该组，避免 Beside 半屏过窄）
    const panel = vscode.window.createWebviewPanel(
      "sfmcPlayground",
      moduleRoot
        ? `脚本沙箱 · ${path.basename(moduleRoot)}`
        : "SFMC 脚本沙箱",
      { viewColumn: vscode.ViewColumn.Active, preserveFocus: false },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "dist", "webview")],
      }
    );
    PlaygroundPanel.current = new PlaygroundPanel(panel, context, moduleRoot);
  }

  /** 扩展 deactivate 时停宿主。 */
  static disposeCurrent(): void {
    PlaygroundPanel.current?.dispose();
  }

  /** 当前面板绑定的模块根（供冒烟对齐）。 */
  static boundModuleRoot(): string | undefined {
    return PlaygroundPanel.current?.moduleRoot;
  }

  /**
   * 冒烟结束后：若沙箱已开且同 moduleRoot，重置场景再装同一模块（保持绑定）。
   */
  static async alignAfterSmoke(moduleRoot: string): Promise<void> {
    const cur = PlaygroundPanel.current;
    if (!cur?.moduleRoot) return;
    if (normalizeRootKey(cur.moduleRoot) !== normalizeRootKey(moduleRoot)) return;
    ExtLog.info("sandbox", `冒烟对齐：保持 moduleRoot=${moduleRoot} 并重置场景`);
    try {
      await cur.bootSandbox({ includeScript: false });
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e);
      ExtLog.warn("sandbox", `冒烟后刷新场景失败: ${text}`);
    }
  }

  private constructor(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
    moduleRoot?: string
  ) {
    this.panel = panel;
    this.context = context;
    this.extensionUri = context.extensionUri;
    this.moduleRoot = moduleRoot;
    this.host = new PlaygroundHostClient((ev) => {
      void this.panel.webview.postMessage({ type: "hostEvent", ...ev });
      if (ev.name === "log") {
        const p = ev.payload as { text?: string };
        if (p?.text) ExtLog.info("playground", p.text);
      } else if (ev.name === "progress") {
        const p = ev.payload as { layer?: string; label?: string; status?: string };
        ExtLog.debug("playground", `${p.layer ?? ""} ${p.label ?? ""} — ${p.status ?? ""}`);
      }
    }, moduleRoot);
    this.panel.webview.html = this.html(moduleRoot);
    this.panel.onDidDispose(() => this.dispose());
    this.panel.webview.onDidReceiveMessage(async (msg) => {
      try {
        await this.onMessage(msg);
      } catch (e) {
        const text = e instanceof Error ? e.message : String(e);
        ExtLog.error("playground", text);
        if (msg?.requestId) {
          void this.panel.webview.postMessage({
            type: "rpcResult",
            requestId: msg.requestId,
            error: text,
          });
        }
        void this.panel.webview.postMessage({
          type: "hostEvent",
          name: "log",
          payload: { channel: "system", text: `[ui] ${text}` },
        });
      }
    });
    ExtLog.info("sandbox", `moduleRoot=${moduleRoot ?? "(engine only)"}`);
    ExtLog.info("playground", moduleRoot ? `面板打开 ${moduleRoot}` : "面板打开（engine only）");
    ExtLog.show(true);
    void this.bootSandbox({ includeScript: true }).catch((e) => {
      const text = e instanceof Error ? e.message : String(e);
      ExtLog.error("playground", `自动启动失败: ${text}`);
    });
  }

  /** workspaceState 分 key，按模块根隔离。 */
  private scriptStateKey(): string {
    const root = this.moduleRoot?.replace(/\\/g, "/").toLowerCase() ?? "engine";
    return `sfmc.sandbox.script:${root}`;
  }

  /** 模块根下 `.sfmc/sandbox-script.json`；无模块根则仅用 workspaceState。 */
  private scriptFileUri(): vscode.Uri | undefined {
    if (!this.moduleRoot) return undefined;
    return vscode.Uri.joinPath(vscode.Uri.file(this.moduleRoot), ".sfmc", "sandbox-script.json");
  }

  private async loadPersistedScript(): Promise<SandboxScript | undefined> {
    const fileUri = this.scriptFileUri();
    if (fileUri) {
      try {
        const buf = await vscode.workspace.fs.readFile(fileUri);
        const parsed: unknown = JSON.parse(Buffer.from(buf).toString("utf8"));
        if (isSandboxScript(parsed)) return parsed;
      } catch {
        // 无文件或损坏则回退 workspaceState
      }
    }
    const fromState = this.context.workspaceState.get<unknown>(this.scriptStateKey());
    return isSandboxScript(fromState) ? fromState : undefined;
  }

  private async persistScript(script: unknown): Promise<void> {
    if (!isSandboxScript(script)) return;
    const normalized: SandboxScript = {
      schemaVersion: typeof script.schemaVersion === "number" ? script.schemaVersion : 1,
      nodes: script.nodes,
      edges: script.edges,
    };
    await this.context.workspaceState.update(this.scriptStateKey(), normalized);
    const fileUri = this.scriptFileUri();
    if (!fileUri) return;
    const dir = vscode.Uri.joinPath(vscode.Uri.file(this.moduleRoot!), ".sfmc");
    try {
      await vscode.workspace.fs.createDirectory(dir);
    } catch {
      // 目录已存在
    }
    await vscode.workspace.fs.writeFile(
      fileUri,
      Buffer.from(`${JSON.stringify(normalized, null, 2)}\n`, "utf8")
    );
  }

  private reply(requestId: unknown, result: unknown): void {
    if (requestId == null) return;
    void this.panel.webview.postMessage({ type: "rpcResult", requestId, result });
  }

  /**
   * @param includeScript 仅首次打开恢复剧本；重置场景时勿带 script，避免覆盖未落盘编辑。
   * 重置场景仍传入同一 moduleRoot（保持模块绑定）。
   */
  private async bootSandbox(options?: { includeScript?: boolean }): Promise<void> {
    const startParams: Record<string, unknown> = {};
    if (this.moduleRoot) startParams.moduleRoot = this.moduleRoot;
    ExtLog.info("sandbox", `boot moduleRoot=${this.moduleRoot ?? "(engine only)"}`);
    const result = (await this.host.request("start", startParams)) as {
      module?: {
        id?: string;
        version?: string | null;
        enabled?: boolean | null;
        root?: string;
      } | null;
      moduleBinding?: Record<string, unknown>;
      subscribedEvents?: { path: string; listeners: number }[];
    };
    const mid = result.module?.id;
    if (mid) {
      ExtLog.info(
        "sandbox",
        `已装 DESCRIPTOR id=${mid} version=${result.module?.version ?? "?"} enabled=${result.module?.enabled ?? "?"}`
      );
    } else {
      ExtLog.info("sandbox", "engine only（未装 DESCRIPTOR）");
    }
    const subs = result.subscribedEvents ?? [];
    if (subs.length > 0) {
      ExtLog.info(
        "sandbox",
        `subscribed=[${subs.map((e) => `${e.path}×${e.listeners}`).join(", ")}]`
      );
    } else if (mid) {
      ExtLog.info("sandbox", "事件由模块 registerEvents 注册；当前无已订阅 path（或仅宿主桥）");
    }
    this.meta = (await this.host.request("meta")) as Meta;
    const summary = await this.host.request("scene.summary");
    const payload: Record<string, unknown> = {
      type: "started",
      result,
      meta: this.meta,
      summary,
      moduleBinding: result.moduleBinding ?? {
        moduleRoot: this.moduleRoot ?? null,
        id: mid ?? null,
        version: result.module?.version ?? null,
        enabled: result.module?.enabled ?? null,
        status: mid ? "loaded" : "engine-only",
        subscribedEvents: subs,
      },
    };
    if (options?.includeScript) {
      const script = await this.loadPersistedScript();
      if (script) payload.script = script;
    }
    void this.panel.webview.postMessage(payload);
  }

  private async onMessage(msg: {
    cmd?: string;
    requestId?: string;
    [k: string]: unknown;
  }): Promise<void> {
    const cmd = msg.cmd;
    if (!cmd) return;
    const rid = msg.requestId;

    if (cmd === "start") {
      await this.bootSandbox({ includeScript: true });
      this.reply(rid, { ok: true });
      return;
    }
    if (cmd === "reset") {
      // 保持同一 moduleRoot 再装载
      await this.bootSandbox({ includeScript: false });
      this.reply(rid, { ok: true });
      return;
    }
    if (cmd === "smoke") {
      this.reply(rid, await this.host.request("smoke.run", {}));
      return;
    }
    if (cmd === "create") {
      const result = await this.host.request("objects.create", {
        kind: msg.kind,
        props: (msg.props as Record<string, unknown>) ?? {},
      });
      this.reply(rid, result);
      return;
    }
    if (cmd === "emit") {
      const result = await this.host.request("events.emit", {
        path: msg.path,
        payload: msg.payload ?? {},
      });
      this.reply(rid, result);
      return;
    }
    if (cmd === "tick") {
      this.reply(rid, await this.host.request("tick", { n: msg.n ?? 1 }));
      return;
    }
    if (cmd === "call") {
      this.reply(
        rid,
        await this.host.request("objects.call", {
          id: msg.id,
          method: msg.method,
          args: msg.args ?? [],
        })
      );
      return;
    }
    if (cmd === "inspect") {
      this.reply(rid, await this.host.request("objects.inspect", { id: msg.id }));
      return;
    }
    if (cmd === "sceneSummary") {
      this.reply(rid, await this.host.request("scene.summary"));
      return;
    }
    if (cmd === "showOutput") {
      ExtLog.show(false);
      this.reply(rid, { ok: true });
      return;
    }
    if (cmd === "uiLog") {
      const level = String(msg.level ?? "info");
      const text = String(msg.text ?? "");
      const lv =
        level === "error" || level === "warn" || level === "debug" || level === "success"
          ? level
          : "info";
      ExtLog.write("sandbox", text, lv);
      this.reply(rid, { ok: true });
      return;
    }
    if (cmd === "persistScript") {
      await this.persistScript(msg.script);
      this.reply(rid, { ok: true });
      return;
    }
    if (cmd === "saveScript") {
      const uri = await vscode.window.showSaveDialog({
        filters: { JSON: ["json"] },
        saveLabel: "保存沙箱脚本",
        defaultUri: this.scriptFileUri() ?? vscode.Uri.file("sandbox-script.json"),
      });
      if (uri) {
        await vscode.workspace.fs.writeFile(
          uri,
          Buffer.from(`${JSON.stringify(msg.script ?? {}, null, 2)}\n`, "utf8")
        );
        // 手动另存时同步自动存档，格式一致
        await this.persistScript(msg.script);
        ExtLog.info("playground", `已保存 ${uri.fsPath}`);
      }
      this.reply(rid, { ok: Boolean(uri) });
      return;
    }
    if (cmd === "openScript") {
      const picked = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: { JSON: ["json"] },
        openLabel: "打开沙箱脚本",
      });
      if (picked?.[0]) {
        const buf = await vscode.workspace.fs.readFile(picked[0]);
        const script = JSON.parse(Buffer.from(buf).toString("utf8"));
        void this.panel.webview.postMessage({ type: "scriptLoaded", script });
        // 打开后写入自动存档，下次面板恢复同一剧本
        await this.persistScript(script);
      }
      this.reply(rid, { ok: Boolean(picked?.[0]) });
      return;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.host.dispose();
    PlaygroundPanel.current = undefined;
  }

  private html(moduleRoot?: string): string {
    const nonce = String(Date.now()) + Math.random().toString(36).slice(2);
    const wv = this.panel.webview;
    const jsUri = wv.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "dist", "webview", "graph.js")
    );
    const cssUri = wv.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "dist", "webview", "graph.css")
    );
    const codiconCssUri = wv.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "dist", "webview", "codicon.css")
    );
    const rootLabel = moduleRoot ? moduleRoot.replace(/\\/g, "/") : "(engine only)";
    const csp = [
      `default-src 'none'`,
      `style-src ${wv.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}' ${wv.cspSource}`,
      `font-src ${wv.cspSource}`,
    ].join("; ");

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="${csp}" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link rel="stylesheet" href="${codiconCssUri}" />
<link rel="stylesheet" href="${cssUri}" />
<title>脚本沙箱</title>
</head>
<body data-module="${escapeHtml(rootLabel)}" data-module-status="pending">
<div id="root"></div>
<script type="module" nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
  }
}
