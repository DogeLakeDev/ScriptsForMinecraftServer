/**
 * SFMC Playground Webview — 构造 / 操作 / 事件 三栏（1:1 meta）
 */

import * as vscode from "vscode";
import { PlaygroundHostClient } from "./hostClient.js";
import { ExtLog } from "../log.js";

type Meta = {
  classes: Record<string, { properties: { name: string; readonly?: boolean }[]; methods: { name: string }[] }>;
  events: Record<string, string[]>;
};

export class PlaygroundPanel {
  static current: PlaygroundPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly host: PlaygroundHostClient;
  private meta: Meta | null = null;
  private disposed = false;

  static show(context: vscode.ExtensionContext, moduleRoot?: string): void {
    if (PlaygroundPanel.current) {
      PlaygroundPanel.current.panel.reveal();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      "sfmcPlayground",
      "SFMC Playground",
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    PlaygroundPanel.current = new PlaygroundPanel(panel, context, moduleRoot);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    _context: vscode.ExtensionContext,
    moduleRoot?: string
  ) {
    this.panel = panel;
    this.host = new PlaygroundHostClient((ev) => {
      void this.panel.webview.postMessage({ type: "hostEvent", ...ev });
      // 镜像系统频道到扩展日志（排查无 Webview 时）
      if (ev.name === "log") {
        const p = ev.payload as { channel?: string; text?: string };
        if (p?.text) ExtLog.info("playground", p.text);
      } else if (ev.name === "progress") {
        const p = ev.payload as { layer?: string; label?: string; status?: string };
        ExtLog.debug("playground", `${p.layer ?? ""} ${p.label ?? ""} — ${p.status ?? ""}`);
      }
    });
    ExtLog.info("playground", moduleRoot ? `面板打开 ${moduleRoot}` : "面板打开（engine only）");
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
  }

  private async onMessage(msg: { cmd?: string; [k: string]: unknown }): Promise<void> {
    const cmd = msg.cmd;
    if (!cmd) return;
    if (cmd === "start") {
      const result = await this.host.request("start");
      this.meta = (await this.host.request("meta")) as Meta;
      void this.panel.webview.postMessage({ type: "started", result, meta: this.meta });
      return;
    }
    if (cmd === "stop") {
      await this.host.request("stop");
      void this.panel.webview.postMessage({ type: "stopped" });
      return;
    }
    if (cmd === "create") {
      const result = await this.host.request("objects.create", {
        kind: msg.kind,
        props: msg.props ?? {},
      });
      void this.panel.webview.postMessage({ type: "created", result });
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
    if (cmd === "listObjects") {
      const list = await this.host.request("objects.list");
      void this.panel.webview.postMessage({ type: "objects", list });
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
    const rootLabel = moduleRoot ? moduleRoot.replace(/\\/g, "/") : "(engine only)";
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
<style>
  :root { color-scheme: light dark; font-family: var(--vscode-font-family); font-size: 12px; }
  body { margin: 0; padding: 8px; color: var(--vscode-foreground); background: var(--vscode-editor-background); }
  h1 { font-size: 14px; margin: 0 0 8px; }
  .toolbar { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; align-items: center; }
  button { cursor: pointer; }
  .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; min-height: 280px; }
  .col { border: 1px solid var(--vscode-panel-border); padding: 8px; overflow: auto; }
  .col h2 { font-size: 12px; margin: 0 0 6px; }
  label { display: block; margin: 4px 0 2px; opacity: 0.85; }
  input, select, textarea { width: 100%; box-sizing: border-box; }
  #log { height: 140px; overflow: auto; white-space: pre-wrap; border: 1px solid var(--vscode-panel-border); padding: 6px; margin-top: 8px; font-family: var(--vscode-editor-font-family); }
  #progress { margin: 4px 0 8px; font-size: 11px; opacity: 0.9; }
  .muted { opacity: 0.7; }
</style>
</head>
<body>
  <h1>SFMC Playground <span class="muted">${escapeHtml(rootLabel)}</span></h1>
  <div class="toolbar">
    <button id="btnStart">启动</button>
    <button id="btnStop">销毁</button>
    <button id="btnTick">tick 1</button>
    <span id="status" class="muted">未启动</span>
  </div>
  <div id="progress"></div>
  <div class="grid">
    <div class="col">
      <h2>构造对象</h2>
      <label>kind（含 Event）</label>
      <select id="kind"></select>
      <label>props JSON（嵌套对象可用 {"$ref":"实例id"}）</label>
      <textarea id="props" rows="6">{"name":"alice","op":true}</textarea>
      <button id="btnCreate">create</button>
      <label>实例</label>
      <select id="objects"></select>
    </div>
    <div class="col">
      <h2>操作对象</h2>
      <label>method</label>
      <select id="method"></select>
      <label>args JSON 数组</label>
      <textarea id="args" rows="4">["hello"]</textarea>
      <button id="btnCall">call</button>
    </div>
    <div class="col">
      <h2>事件触发</h2>
      <label>path</label>
      <select id="eventPath"></select>
      <div id="eventTypeLabel" class="muted"></div>
      <label>payload JSON（字段来自 Event 类型）</label>
      <textarea id="payload" rows="4">{}</textarea>
      <button id="btnFillPayload">按类型填模板</button>
      <button id="btnEmit">emit</button>
    </div>
  </div>
  <div id="log"></div>
<script>
  const vscode = acquireVsCodeApi();
  const logEl = document.getElementById('log');
  const statusEl = document.getElementById('status');
  const progressEl = document.getElementById('progress');
  let meta = null;

  function log(text) {
    logEl.textContent += text + '\\n';
    logEl.scrollTop = logEl.scrollHeight;
  }

  function parseJson(text, fallback) {
    try { return JSON.parse(text); } catch { return fallback; }
  }

  function defaultForType(t) {
    const s = String(t || '');
    if (s === 'boolean') return false;
    if (s === 'number') return 0;
    if (s === 'string') return '';
    if (s.indexOf('[]') >= 0) return [];
    if (/^Player\\b/.test(s) || /^Entity\\b/.test(s) || /^ItemStack\\b/.test(s) || /^Block\\b/.test(s)) {
      return { $ref: '' };
    }
    return null;
  }

  function propsTemplate(kind) {
    const cls = meta && meta.classes[kind];
    if (!cls) return {};
    const o = {};
    for (const p of cls.properties) {
      o[p.name] = defaultForType(p.type);
    }
    if (kind === 'Player') return { name: 'alice', op: true };
    if (kind === 'ItemStack') return { typeId: 'minecraft:apple', amount: 1 };
    if (kind === 'Entity') return { typeId: 'minecraft:cow', location: { x: 0, y: 64, z: 0 } };
    if (kind === 'Block') return { typeId: 'minecraft:stone', location: { x: 0, y: 64, z: 0 } };
    return o;
  }

  function fillKinds() {
    const sel = document.getElementById('kind');
    sel.innerHTML = '';
    if (!meta) return;
    const engine = ['Player', 'Entity', 'ItemStack', 'Block'];
    const events = Object.keys(meta.classes).filter((k) => meta.classes[k].kind === 'event').sort();
    const optGroup = (label, names) => {
      const g = document.createElement('optgroup');
      g.label = label;
      for (const n of names) {
        const o = document.createElement('option');
        o.value = n; o.textContent = n;
        g.appendChild(o);
      }
      sel.appendChild(g);
    };
    optGroup('对象', engine);
    optGroup('事件', events);
  }

  function fillMethods(kind) {
    const sel = document.getElementById('method');
    sel.innerHTML = '';
    const methods = (meta && meta.classes[kind] && meta.classes[kind].methods) || [];
    for (const m of methods) {
      const o = document.createElement('option');
      o.value = m.name; o.textContent = m.name;
      sel.appendChild(o);
    }
  }

  function fillEvents() {
    const sel = document.getElementById('eventPath');
    sel.innerHTML = '';
    if (!meta) return;
    const paths = Object.keys(meta.eventTypes || {}).sort();
    for (const p of paths) {
      const o = document.createElement('option');
      o.value = p; o.textContent = p;
      sel.appendChild(o);
    }
    onEventPathChange();
  }

  function onEventPathChange() {
    const path = document.getElementById('eventPath').value;
    const info = meta && meta.eventTypes && meta.eventTypes[path];
    const et = info ? info.eventType : '';
    document.getElementById('eventTypeLabel').textContent = et ? ('Event: ' + et) : '';
    if (et) {
      document.getElementById('payload').value = JSON.stringify(propsTemplate(et), null, 2);
    }
  }

  document.getElementById('btnStart').onclick = () => vscode.postMessage({ cmd: 'start' });
  document.getElementById('btnStop').onclick = () => vscode.postMessage({ cmd: 'stop' });
  document.getElementById('btnTick').onclick = () => vscode.postMessage({ cmd: 'tick', n: 1 });
  document.getElementById('btnCreate').onclick = () => {
    vscode.postMessage({
      cmd: 'create',
      kind: document.getElementById('kind').value,
      props: parseJson(document.getElementById('props').value, {}),
    });
  };
  document.getElementById('btnCall').onclick = () => {
    const id = document.getElementById('objects').value;
    if (!id) { log('无实例'); return; }
    vscode.postMessage({
      cmd: 'call',
      id,
      method: document.getElementById('method').value,
      args: parseJson(document.getElementById('args').value, []),
    });
  };
  document.getElementById('btnEmit').onclick = () => {
    vscode.postMessage({
      cmd: 'emit',
      path: document.getElementById('eventPath').value,
      payload: parseJson(document.getElementById('payload').value, {}),
    });
  };
  document.getElementById('btnFillPayload').onclick = () => onEventPathChange();
  document.getElementById('kind').onchange = () => {
    const kind = document.getElementById('kind').value;
    fillMethods(kind);
    document.getElementById('props').value = JSON.stringify(propsTemplate(kind), null, 2);
  };
  document.getElementById('eventPath').onchange = () => onEventPathChange();

  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (msg.type === 'hostEvent') {
      if (msg.name === 'log' && msg.payload && msg.payload.text) log(msg.payload.text);
      if (msg.name === 'progress') {
        const p = msg.payload || {};
        progressEl.textContent = '[' + (p.layer || '') + '] ' + (p.label || '') + ' — ' + (p.status || '');
      }
      return;
    }
    if (msg.type === 'started') {
      meta = msg.meta;
      statusEl.textContent = '已启动';
      fillKinds();
      fillMethods(document.getElementById('kind').value);
      document.getElementById('props').value = JSON.stringify(propsTemplate(document.getElementById('kind').value), null, 2);
      fillEvents();
      log(JSON.stringify(msg.result));
      return;
    }
    if (msg.type === 'stopped') {
      statusEl.textContent = '已销毁';
      log('[stopped]');
      return;
    }
    if (msg.type === 'created') {
      const o = document.createElement('option');
      o.value = msg.result.id;
      o.textContent = msg.result.kind + ' ' + msg.result.id;
      document.getElementById('objects').appendChild(o);
      document.getElementById('objects').value = msg.result.id;
      fillMethods(msg.result.kind);
      log('[created] ' + msg.result.id);
      return;
    }
    if (msg.type === 'called') log('[call] ' + JSON.stringify(msg.result));
    if (msg.type === 'emitted') log('[emit] ' + msg.path);
  });
</script>
</body>
</html>`;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
