/**
 * SFMC 事件刺激台 Webview — 大纲 / 属性 / 视口 + 实验室
 */

import * as vscode from "vscode";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
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

function resolveElementsMain(): string {
  const require = createRequire(__filename);
  try {
    return require.resolve("@vscode-elements/elements/dist/main.js");
  } catch {
    const candidate = path.resolve(
      __dirname,
      "../../../../node_modules/@vscode-elements/elements/dist/main.js"
    );
    if (fs.existsSync(candidate)) return candidate;
    throw new Error("找不到 @vscode-elements/elements；请在仓库根 npm install");
  }
}

export class PlaygroundPanel {
  static current: PlaygroundPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly host: PlaygroundHostClient;
  private readonly extensionUri: vscode.Uri;
  private meta: Meta | null = null;
  private disposed = false;

  static show(context: vscode.ExtensionContext, moduleRoot?: string): void {
    if (PlaygroundPanel.current) {
      PlaygroundPanel.current.panel.reveal();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      "sfmcPlayground",
      "SFMC 事件刺激台",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, "dist", "webview"),
          vscode.Uri.joinPath(context.extensionUri, "src", "playground", "webview"),
        ],
      }
    );
    PlaygroundPanel.current = new PlaygroundPanel(panel, context, moduleRoot);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
    moduleRoot?: string
  ) {
    this.panel = panel;
    this.extensionUri = context.extensionUri;
    this.host = new PlaygroundHostClient((ev) => {
      void this.panel.webview.postMessage({ type: "hostEvent", ...ev });
      if (ev.name === "log") {
        const p = ev.payload as { text?: string };
        if (p?.text) ExtLog.info("playground", p.text);
      } else if (ev.name === "progress") {
        const p = ev.payload as { layer?: string; label?: string; status?: string };
        ExtLog.debug("playground", `${p.layer ?? ""} ${p.label ?? ""} — ${p.status ?? ""}`);
      }
    });
    this.panel.webview.html = this.html(moduleRoot);
    this.panel.onDidDispose(() => this.dispose());
    this.panel.webview.onDidReceiveMessage(async (msg) => {
      try {
        await this.onMessage(msg);
      } catch (e) {
        const text = e instanceof Error ? e.message : String(e);
        ExtLog.error("playground", text);
        void this.panel.webview.postMessage({
          type: "hostEvent",
          name: "log",
          payload: { channel: "system", text: `[ui] ${text}` },
        });
      }
    });
    ExtLog.info("playground", moduleRoot ? `面板打开 ${moduleRoot}` : "面板打开（engine only）");
  }

  private async onMessage(msg: { cmd?: string; [k: string]: unknown }): Promise<void> {
    const cmd = msg.cmd;
    if (!cmd) return;

    if (cmd === "start") {
      const result = await this.host.request("start");
      this.meta = (await this.host.request("meta")) as Meta;
      const summary = (await this.host.request("scene.summary")) as {
        players?: { id: string; name: string; kind: string }[];
      };
      void this.panel.webview.postMessage({
        type: "started",
        result,
        meta: this.meta,
        players: summary.players ?? [],
      });
      return;
    }
    if (cmd === "stop") {
      await this.host.request("stop");
      void this.panel.webview.postMessage({ type: "stopped" });
      return;
    }
    if (cmd === "create") {
      const props = (msg.props as Record<string, unknown>) ?? {};
      const result = await this.host.request("objects.create", {
        kind: msg.kind,
        props,
      });
      void this.panel.webview.postMessage({ type: "created", result, props });
      return;
    }
    if (cmd === "call") {
      const result = await this.host.request("objects.call", {
        id: msg.id,
        method: msg.method,
        args: msg.args ?? [],
      });
      void this.panel.webview.postMessage({ type: "called", result });
      return;
    }
    if (cmd === "emit") {
      await this.host.request("events.emit", { path: msg.path, payload: msg.payload ?? {} });
      void this.panel.webview.postMessage({ type: "emitted", path: msg.path });
      return;
    }
    if (cmd === "tick") {
      await this.host.request("tick", { n: msg.n ?? 1 });
      return;
    }
    if (cmd === "sceneSummary") {
      const summary = await this.host.request("scene.summary");
      void this.panel.webview.postMessage({ type: "scene", summary });
      return;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.host.dispose();
    PlaygroundPanel.current = undefined;
  }

  private webviewUri(...segments: string[]): vscode.Uri {
    const dist = vscode.Uri.joinPath(this.extensionUri, "dist", "webview", ...segments);
    const distFs = dist.fsPath;
    if (fs.existsSync(distFs)) {
      return this.panel.webview.asWebviewUri(dist);
    }
    const src = vscode.Uri.joinPath(this.extensionUri, "src", "playground", "webview", ...segments);
    return this.panel.webview.asWebviewUri(src);
  }

  private html(moduleRoot?: string): string {
    const nonce = String(Date.now()) + Math.random().toString(36).slice(2);
    const wv = this.panel.webview;
    const vendored = vscode.Uri.joinPath(
      this.extensionUri,
      "dist",
      "webview",
      "vendor",
      "elements-dist",
      "main.js"
    );
    const elementsUri = fs.existsSync(vendored.fsPath)
      ? wv.asWebviewUri(vendored)
      : wv.asWebviewUri(vscode.Uri.file(resolveElementsMain()));
    const cssUri = this.webviewUri("stimulus.css");
    const jsUri = this.webviewUri("stimulus.js");
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
<link rel="stylesheet" href="${cssUri}" />
<script type="module" nonce="${nonce}" src="${elementsUri}"></script>
</head>
<body>
  <div class="topbar">
    <vscode-button id="btnStart">启动</vscode-button>
    <vscode-button id="btnStop" secondary>销毁</vscode-button>
    <vscode-button id="btnTick" secondary>Tick 1</vscode-button>
    <span id="statusText" class="muted">未启动</span>
    <span class="grow"></span>
    <span id="progress" class="progress muted"></span>
    <div class="views">
      <vscode-button id="btnViewStimulus">刺激台</vscode-button>
      <vscode-button id="btnViewLab" secondary>实验室</vscode-button>
    </div>
  </div>
  <div class="muted" style="padding:4px 8px;font-size:11px">模块：${escapeHtml(rootLabel)} · 事件刺激台（非假 BDS）</div>

  <div id="stimulusRoot" class="main">
    <div class="col">
      <h2>大纲</h2>
      <div class="section-label">场景</div>
      <div style="display:flex;gap:4px;margin-bottom:4px;align-items:center">
        <vscode-textfield id="playerName" placeholder="玩家名" value="alice" style="flex:1"></vscode-textfield>
        <vscode-checkbox id="playerOp" checked>OP</vscode-checkbox>
        <vscode-button id="btnAddPlayer" secondary>+ 玩家</vscode-button>
      </div>
      <div id="sceneTree" class="tree" style="flex:0 0 auto;max-height:30%"></div>
      <div class="section-label">事件</div>
      <vscode-textfield id="eventSearch" placeholder="搜索信号…" style="margin-bottom:4px"></vscode-textfield>
      <div id="eventTree" class="tree"></div>
    </div>
    <div class="col">
      <h2 id="propsTitle">属性</h2>
      <div id="propsBody" class="props"></div>
      <div class="actions">
        <vscode-button id="btnEmit" disabled>Emit</vscode-button>
      </div>
    </div>
    <div class="col">
      <h2>视口</h2>
      <div class="viewport-tabs">
        <vscode-button id="btnTabLog">日志</vscode-button>
        <vscode-button id="btnTabState" secondary>状态</vscode-button>
      </div>
      <div id="logView"></div>
      <div id="stateView" class="hidden"></div>
    </div>
  </div>

  <div id="lab" class="hidden">
    <div class="lab-col">
      <h2>构造</h2>
      <label>kind</label>
      <select id="labKind" class="native"></select>
      <label>props JSON</label>
      <textarea id="labProps" class="raw">{"name":"alice","op":true}</textarea>
      <vscode-button id="btnLabCreate">create</vscode-button>
    </div>
    <div class="lab-col">
      <h2>操作</h2>
      <label>object id</label>
      <input id="labObjectId" class="native" />
      <label>实例</label>
      <select id="labObjects" class="native"></select>
      <label>method</label>
      <input id="labMethod" class="native" value="sendMessage" />
      <label>args JSON</label>
      <textarea id="labArgs" class="raw">["hello"]</textarea>
      <vscode-button id="btnLabCall">call</vscode-button>
    </div>
    <div class="lab-col">
      <h2>事件 JSON</h2>
      <label>path</label>
      <select id="labEventPath" class="native"></select>
      <label>payload</label>
      <textarea id="labPayload" class="raw">{}</textarea>
      <vscode-button id="btnLabEmit">emit</vscode-button>
    </div>
  </div>

  <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
