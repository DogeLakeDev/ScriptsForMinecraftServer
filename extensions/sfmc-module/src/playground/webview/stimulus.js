/* SFMC 事件刺激台 — Webview 主逻辑 */
(function () {
  const vscode = acquireVsCodeApi();

  /** @type {any} */
  let meta = null;
  /** @type {{ id: string, name: string, kind: string }[]} */
  let players = [];
  /** @type {{ type: 'player', id: string } | { type: 'event', path: string } | null} */
  let active = null;
  /** @type {Record<string, any>} */
  let formValues = {};
  let eventFilter = "";
  let started = false;
  let lastEmitPath = "";

  const $ = (id) => document.getElementById(id);

  function post(msg) {
    vscode.postMessage(msg);
  }

  function logLine(text) {
    const el = $("logView");
    el.textContent += text + "\n";
    el.scrollTop = el.scrollHeight;
  }

  function setStatus(text) {
    $("statusText").textContent = text;
  }

  function setView(name) {
    const stim = name === "stimulus";
    $("stimulusRoot").classList.toggle("hidden", !stim);
    $("lab").classList.toggle("hidden", stim);
    $("btnViewStimulus").secondary = !stim;
    $("btnViewLab").secondary = stim;
  }

  function setViewport(tab) {
    const log = tab === "log";
    $("logView").classList.toggle("hidden", !log);
    $("stateView").classList.toggle("hidden", log);
    $("btnTabLog").secondary = !log;
    $("btnTabState").secondary = log;
    if (!log) refreshState();
  }

  function eventPaths() {
    if (!meta || !meta.eventTypes) return [];
    return Object.keys(meta.eventTypes).sort();
  }

  function renderScene() {
    const root = $("sceneTree");
    root.innerHTML = "";
    for (const p of players) {
      const div = document.createElement("div");
      div.className = "tree-item" + (active?.type === "player" && active.id === p.id ? " active" : "");
      div.textContent = `${p.name}  (${p.id})`;
      div.onclick = () => {
        active = { type: "player", id: p.id };
        formValues = {};
        renderAll();
      };
      root.appendChild(div);
    }
    if (!players.length) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = "暂无玩家";
      root.appendChild(empty);
    }
  }

  function renderEvents() {
    const root = $("eventTree");
    root.innerHTML = "";
    const q = eventFilter.trim().toLowerCase();
    /** @type {Record<string, string[]>} */
    const byHub = {};
    for (const path of eventPaths()) {
      if (q && !path.toLowerCase().includes(q)) continue;
      const parts = path.split(".");
      const hub = parts.slice(0, 2).join(".");
      const sig = parts[2];
      if (!byHub[hub]) byHub[hub] = [];
      byHub[hub].push(sig);
    }
    for (const hub of Object.keys(byHub).sort()) {
      const h = document.createElement("div");
      h.className = "hub";
      h.textContent = hub;
      root.appendChild(h);
      for (const sig of byHub[hub]) {
        const path = `${hub}.${sig}`;
        const div = document.createElement("div");
        div.className =
          "tree-item indent" + (active?.type === "event" && active.path === path ? " active" : "");
        div.textContent = sig;
        div.title = path;
        div.onclick = () => {
          active = { type: "event", path };
          formValues = defaultPayload(path);
          renderAll();
        };
        root.appendChild(div);
      }
    }
  }

  function defaultForType(t) {
    const s = String(t || "");
    if (s === "boolean") return false;
    if (s === "number") return 0;
    if (s === "string") return "";
    if (/^Player\b/.test(s)) return players[0]?.id ? { $ref: players[0].id } : "";
    if (s.indexOf("[]") >= 0) return [];
    return null;
  }

  function defaultPayload(path) {
    const et = meta?.eventTypes?.[path]?.eventType;
    const cls = et && meta.classes[et];
    const o = {};
    if (!cls) return o;
    for (const p of cls.properties) {
      o[p.name] = defaultForType(p.type);
    }
    return o;
  }

  function isPlayerType(t) {
    return /^Player\b/.test(String(t || ""));
  }

  function renderProps() {
    const title = $("propsTitle");
    const body = $("propsBody");
    body.innerHTML = "";
    if (!started) {
      title.textContent = "属性";
      body.innerHTML = '<p class="muted">先启动会话</p>';
      $("btnEmit").disabled = true;
      return;
    }
    if (!active) {
      title.textContent = "属性";
      body.innerHTML = '<p class="muted">在大纲中选中玩家或事件</p>';
      $("btnEmit").disabled = true;
      return;
    }
    if (active.type === "player") {
      const p = players.find((x) => x.id === active.id);
      title.textContent = `属性 · Player ${p?.name ?? active.id}`;
      body.innerHTML = `<p>id: <code>${active.id}</code></p><p class="muted">聊天糖后置；可将此玩家用于 Event 的 Player 字段下拉。</p>`;
      $("btnEmit").disabled = true;
      return;
    }

    const path = active.path;
    const et = meta?.eventTypes?.[path]?.eventType ?? "?";
    title.textContent = `属性 · ${et}`;
    const cls = meta.classes[et];
    $("btnEmit").disabled = false;

    if (!cls || !cls.properties.length) {
      body.innerHTML = '<p class="muted">无字段；可直接 Emit 空 payload</p>';
      return;
    }

    for (const prop of cls.properties) {
      const wrap = document.createElement("div");
      wrap.className = "field";
      const lab = document.createElement("label");
      lab.textContent = `${prop.name}${prop.readonly ? " (readonly)" : ""} · ${prop.type}`;
      wrap.appendChild(lab);

      const key = prop.name;
      if (prop.type === "boolean") {
        const cb = document.createElement("vscode-checkbox");
        cb.label = prop.name;
        if (formValues[key]) cb.setAttribute("checked", "");
        cb.addEventListener("change", () => {
          formValues[key] = Boolean(cb.checked);
        });
        wrap.appendChild(cb);
      } else if (isPlayerType(prop.type)) {
        const sel = document.createElement("select");
        sel.className = "native";
        const opt0 = document.createElement("option");
        opt0.value = "";
        opt0.textContent = "（未绑定）";
        sel.appendChild(opt0);
        for (const pl of players) {
          const o = document.createElement("option");
          o.value = pl.id;
          o.textContent = `${pl.name} (${pl.id})`;
          sel.appendChild(o);
        }
        const cur = formValues[key];
        sel.value = cur && cur.$ref ? cur.$ref : "";
        sel.onchange = () => {
          formValues[key] = sel.value ? { $ref: sel.value } : null;
        };
        wrap.appendChild(sel);
      } else if (prop.type === "number") {
        const inp = document.createElement("vscode-textfield");
        inp.type = "number";
        inp.value = String(formValues[key] ?? 0);
        inp.addEventListener("input", () => {
          formValues[key] = Number(inp.value);
        });
        wrap.appendChild(inp);
      } else {
        const inp = document.createElement("vscode-textfield");
        const v = formValues[key];
        inp.value = v == null || typeof v === "object" ? "" : String(v);
        inp.addEventListener("input", () => {
          formValues[key] = inp.value;
        });
        wrap.appendChild(inp);
      }
      body.appendChild(wrap);
    }
  }

  function renderAll() {
    renderScene();
    renderEvents();
    renderProps();
  }

  function refreshState() {
    post({ cmd: "sceneSummary" });
  }

  function fillLabKinds() {
    const sel = $("labKind");
    sel.innerHTML = "";
    if (!meta) return;
    const engine = ["Player", "Entity", "ItemStack", "Block"];
    const events = Object.keys(meta.classes)
      .filter((k) => meta.classes[k].kind === "event")
      .sort();
    for (const n of [...engine, ...events]) {
      const o = document.createElement("option");
      o.value = n;
      o.textContent = n;
      sel.appendChild(o);
    }
    const paths = $("labEventPath");
    paths.innerHTML = "";
    for (const p of eventPaths()) {
      const o = document.createElement("option");
      o.value = p;
      o.textContent = p;
      paths.appendChild(o);
    }
  }

  // —— 绑定 ——
  $("btnStart").onclick = () => post({ cmd: "start" });
  $("btnStop").onclick = () => post({ cmd: "stop" });
  $("btnTick").onclick = () => post({ cmd: "tick", n: 1 });
  $("btnAddPlayer").onclick = () => {
    const name = $("playerName").value || "player";
    const opEl = $("playerOp");
    const op = Boolean(opEl.checked ?? opEl.hasAttribute("checked"));
    post({ cmd: "create", kind: "Player", props: { name, op } });
  };
  $("btnEmit").onclick = () => {
    if (!active || active.type !== "event") return;
    lastEmitPath = active.path;
    post({ cmd: "emit", path: active.path, payload: formValues });
  };
  $("eventSearch").addEventListener("input", (e) => {
    eventFilter = e.target.value || "";
    renderEvents();
  });
  $("btnViewStimulus").onclick = () => setView("stimulus");
  $("btnViewLab").onclick = () => setView("lab");
  $("btnTabLog").onclick = () => setViewport("log");
  $("btnTabState").onclick = () => setViewport("state");

  $("btnLabCreate").onclick = () => {
    let props = {};
    try {
      props = JSON.parse($("labProps").value || "{}");
    } catch {
      logLine("[lab] props JSON 无效");
      return;
    }
    post({ cmd: "create", kind: $("labKind").value, props });
  };
  $("btnLabCall").onclick = () => {
    let args = [];
    try {
      args = JSON.parse($("labArgs").value || "[]");
    } catch {
      logLine("[lab] args JSON 无效");
      return;
    }
    post({ cmd: "call", id: $("labObjectId").value, method: $("labMethod").value, args });
  };
  $("btnLabEmit").onclick = () => {
    let payload = {};
    try {
      payload = JSON.parse($("labPayload").value || "{}");
    } catch {
      logLine("[lab] payload JSON 无效");
      return;
    }
    post({ cmd: "emit", path: $("labEventPath").value, payload });
  };
  $("labObjects").onchange = () => {
    $("labObjectId").value = $("labObjects").value;
  };

  window.addEventListener("message", (e) => {
    const msg = e.data;
    if (msg.type === "hostEvent") {
      if (msg.name === "log" && msg.payload?.text) logLine(msg.payload.text);
      if (msg.name === "progress") {
        const p = msg.payload || {};
        $("progress").textContent = `[${p.layer || ""}] ${p.label || ""} — ${p.status || ""}`;
      }
      return;
    }
    if (msg.type === "started") {
      meta = msg.meta;
      started = true;
      setStatus("已启动");
      players = (msg.players || []).map((p) => ({
        id: p.id,
        name: p.name || p.id,
        kind: p.kind || "Player",
      }));
      fillLabKinds();
      renderAll();
      logLine(JSON.stringify(msg.result || {}));
      refreshState();
      return;
    }
    if (msg.type === "stopped") {
      started = false;
      meta = null;
      players = [];
      active = null;
      setStatus("已销毁");
      renderAll();
      logLine("[stopped]");
      return;
    }
    if (msg.type === "created") {
      if (msg.result?.kind === "Player") {
        players.push({
          id: msg.result.id,
          name: msg.props?.name || msg.result.id,
          kind: "Player",
        });
      }
      const sel = $("labObjects");
      if (sel) {
        const o = document.createElement("option");
        o.value = msg.result.id;
        o.textContent = `${msg.result.kind} ${msg.result.id}`;
        sel.appendChild(o);
        $("labObjectId").value = msg.result.id;
      }
      logLine(`[created] ${msg.result.kind} ${msg.result.id}`);
      renderAll();
      refreshState();
      return;
    }
    if (msg.type === "emitted") {
      lastEmitPath = msg.path || lastEmitPath;
      logLine(`[emit] ${msg.path}`);
      refreshState();
      return;
    }
    if (msg.type === "called") {
      logLine(`[call] ${JSON.stringify(msg.result)}`);
      return;
    }
    if (msg.type === "scene") {
      const s = msg.summary || {};
      $("stateView").textContent = [
        `started: ${s.started}`,
        `players: ${s.playerCount ?? 0}`,
        ...(s.players || []).map((p) => `  - ${p.name} (${p.id})`),
        `objects: ${s.objectCount ?? 0}`,
        `eventPaths: ${s.eventPathCount ?? 0}`,
        `lastEmit: ${s.lastEmit ? `${s.lastEmit.path} @ ${new Date(s.lastEmit.at).toISOString()}` : "(none)"}`,
        `note: ${s.note || ""}`,
        `uiLastEmit: ${lastEmitPath || "(none)"}`,
      ].join("\n");
      if (Array.isArray(s.players) && s.players.length) {
        players = s.players.map((p) => ({ id: p.id, name: p.name, kind: p.kind || "Player" }));
        renderScene();
      }
      return;
    }
  });

  setView("stimulus");
  setViewport("log");
  setStatus("未启动");
  logLine("事件刺激台就绪。文档：docs/superpowers/specs/2026-07-31-sfmc-playground-stimulus-ux-design.md");
})();
