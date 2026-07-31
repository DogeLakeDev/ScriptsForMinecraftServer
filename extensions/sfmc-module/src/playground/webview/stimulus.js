/* SFMC 事件刺激台 — 尽量使用 @vscode-elements/elements */
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
    const el = $("logPre");
    el.textContent += text + "\n";
    const sc = $("logScroll");
    if (sc && typeof sc.scrollTop === "number") {
      /* scrollable 内部滚动由组件管理；再追加后尝试滚到底 */
      requestAnimationFrame(() => {
        try {
          sc.scrollTop = sc.scrollHeight;
        } catch {
          /* ignore */
        }
      });
    }
  }

  function setStatus(text, variant) {
    const b = $("statusBadge");
    b.textContent = text;
    if (variant === "ok") b.setAttribute("variant", "counter");
    else b.removeAttribute("variant");
  }

  function eventPaths() {
    if (!meta?.eventTypes) return [];
    return Object.keys(meta.eventTypes).sort();
  }

  function defaultForType(t) {
    const s = String(t || "");
    if (s === "boolean") return false;
    if (s === "number") return 0;
    if (s === "string") return "";
    if (/^Player\b/.test(s)) return players[0]?.id ? { $ref: players[0].id } : null;
    if (s.includes("[]")) return [];
    return null;
  }

  function defaultPayload(path) {
    const et = meta?.eventTypes?.[path]?.eventType;
    const cls = et && meta.classes[et];
    const o = {};
    if (!cls) return o;
    for (const p of cls.properties) o[p.name] = defaultForType(p.type);
    return o;
  }

  function isPlayerType(t) {
    return /^Player\b/.test(String(t || ""));
  }

  function clearTree(tree) {
    while (tree.firstChild) tree.removeChild(tree.firstChild);
  }

  function renderSceneTree() {
    const tree = $("sceneTree");
    clearTree(tree);
    if (!players.length) {
      const leaf = document.createElement("vscode-tree-item");
      leaf.textContent = "暂无玩家";
      leaf.disabled = true;
      tree.appendChild(leaf);
      return;
    }
    for (const p of players) {
      const item = document.createElement("vscode-tree-item");
      item.dataset.kind = "player";
      item.dataset.id = p.id;
      item.textContent = p.name;
      const desc = document.createElement("span");
      desc.setAttribute("slot", "description");
      desc.textContent = p.id;
      item.appendChild(desc);
      if (active?.type === "player" && active.id === p.id) {
        item.selected = true;
        item.active = true;
      }
      tree.appendChild(item);
    }
  }

  function renderEventTree() {
    const tree = $("eventTree");
    clearTree(tree);
    const q = eventFilter.trim().toLowerCase();
    /** @type {Record<string, string[]>} */
    const byHub = {};
    for (const path of eventPaths()) {
      if (q && !path.toLowerCase().includes(q)) continue;
      const parts = path.split(".");
      const hub = `${parts[0]}.${parts[1]}`;
      const sig = parts[2];
      if (!byHub[hub]) byHub[hub] = [];
      byHub[hub].push(sig);
    }
    for (const hub of Object.keys(byHub).sort()) {
      const branch = document.createElement("vscode-tree-item");
      branch.branch = true;
      branch.open = true;
      branch.textContent = hub;
      for (const sig of byHub[hub]) {
        const path = `${hub}.${sig}`;
        const leaf = document.createElement("vscode-tree-item");
        leaf.dataset.kind = "event";
        leaf.dataset.path = path;
        leaf.textContent = sig;
        const et = meta?.eventTypes?.[path]?.eventType;
        if (et) {
          const desc = document.createElement("span");
          desc.setAttribute("slot", "description");
          desc.textContent = et;
          leaf.appendChild(desc);
        }
        if (active?.type === "event" && active.path === path) {
          leaf.selected = true;
          leaf.active = true;
        }
        branch.appendChild(leaf);
      }
      tree.appendChild(branch);
    }
  }

  function makeFormGroup(labelText, control, helper) {
    const g = document.createElement("vscode-form-group");
    g.variant = "vertical";
    const lab = document.createElement("vscode-label");
    lab.textContent = labelText;
    g.appendChild(lab);
    g.appendChild(control);
    if (helper) {
      const h = document.createElement("vscode-form-helper");
      h.textContent = helper;
      g.appendChild(h);
    }
    return g;
  }

  function fillSingleSelect(sel, options, value) {
    clearTree(sel);
    for (const opt of options) {
      const o = document.createElement("vscode-option");
      o.value = opt.value;
      o.textContent = opt.label;
      if (opt.description) o.description = opt.description;
      if (opt.value === value) o.selected = true;
      sel.appendChild(o);
    }
    if (value != null) sel.value = value;
  }

  function renderProps() {
    const title = $("propsHeading");
    const body = $("propsBody");
    body.innerHTML = "";
    $("btnEmit").disabled = true;

    if (!started) {
      title.textContent = "属性";
      body.appendChild(Object.assign(document.createElement("p"), { className: "muted", textContent: "先启动会话" }));
      return;
    }
    if (!active) {
      title.textContent = "属性";
      body.appendChild(
        Object.assign(document.createElement("p"), {
          className: "muted",
          textContent: "在大纲中选中玩家或事件",
        })
      );
      return;
    }

    if (active.type === "player") {
      const p = players.find((x) => x.id === active.id);
      title.textContent = `Player · ${p?.name ?? active.id}`;
      body.appendChild(
        makeFormGroup(
          "id",
          Object.assign(document.createElement("vscode-textfield"), { value: active.id, disabled: true })
        )
      );
      body.appendChild(
        Object.assign(document.createElement("vscode-form-helper"), {
          textContent: "聊天糖后置；Event 的 Player 字段可从此场景选择。",
        })
      );
      return;
    }

    const path = active.path;
    const et = meta?.eventTypes?.[path]?.eventType ?? "?";
    title.textContent = et;
    $("btnEmit").disabled = false;
    const cls = meta.classes[et];
    if (!cls?.properties?.length) {
      body.appendChild(
        Object.assign(document.createElement("p"), {
          className: "muted",
          textContent: "无字段，可直接 Emit",
        })
      );
      return;
    }

    for (const prop of cls.properties) {
      const key = prop.name;
      const helper = prop.readonly ? "readonly（沙箱仍可填）" : prop.type;

      if (prop.type === "boolean") {
        const cb = document.createElement("vscode-checkbox");
        cb.textContent = prop.name;
        if (formValues[key]) cb.checked = true;
        cb.addEventListener("change", () => {
          formValues[key] = Boolean(cb.checked);
        });
        body.appendChild(makeFormGroup(prop.name, cb, helper));
        continue;
      }

      if (isPlayerType(prop.type)) {
        const sel = document.createElement("vscode-single-select");
        const cur = formValues[key]?.$ref || "";
        fillSingleSelect(
          sel,
          [{ value: "", label: "（未绑定）" }, ...players.map((pl) => ({ value: pl.id, label: pl.name, description: pl.id }))],
          cur
        );
        sel.addEventListener("change", () => {
          formValues[key] = sel.value ? { $ref: sel.value } : null;
        });
        body.appendChild(makeFormGroup(prop.name, sel, helper));
        continue;
      }

      if (prop.type === "number") {
        const inp = document.createElement("vscode-textfield");
        inp.type = "number";
        inp.value = String(formValues[key] ?? 0);
        inp.addEventListener("input", () => {
          formValues[key] = Number(inp.value);
        });
        body.appendChild(makeFormGroup(prop.name, inp, helper));
        continue;
      }

      const inp = document.createElement("vscode-textfield");
      const v = formValues[key];
      inp.value = v == null || typeof v === "object" ? "" : String(v);
      inp.addEventListener("input", () => {
        formValues[key] = inp.value;
      });
      body.appendChild(makeFormGroup(prop.name, inp, helper));
    }
  }

  function renderAll() {
    renderSceneTree();
    renderEventTree();
    renderProps();
  }

  function onTreeSelect(e) {
    const items = e.detail?.selectedItems || [];
    const item = items[0];
    if (!item) return;
    if (item.dataset.kind === "player") {
      active = { type: "player", id: item.dataset.id };
      formValues = {};
      renderAll();
      return;
    }
    if (item.dataset.kind === "event") {
      active = { type: "event", path: item.dataset.path };
      formValues = defaultPayload(item.dataset.path);
      renderAll();
    }
  }

  function fillLabKinds() {
    const sel = $("labKind");
    clearTree(sel);
    if (!meta) return;
    const engine = ["Player", "Entity", "ItemStack", "Block"];
    const events = Object.keys(meta.classes)
      .filter((k) => meta.classes[k].kind === "event")
      .sort();
    fillSingleSelect(
      sel,
      [...engine, ...events].map((n) => ({ value: n, label: n })),
      "Player"
    );
    fillSingleSelect(
      $("labEventPath"),
      eventPaths().map((p) => ({ value: p, label: p })),
      eventPaths()[0] || ""
    );
  }

  function refreshState() {
    post({ cmd: "sceneSummary" });
  }

  function setProgress(fraction, label) {
    const row = $("progressRow");
    const bar = $("progressBar");
    if (fraction == null) {
      row.classList.add("hidden");
      return;
    }
    row.classList.remove("hidden");
    bar.value = Math.round(fraction * 100);
    $("progressLabel").textContent = label || "";
  }

  // —— 绑定 ——
  $("btnStart").addEventListener("click", () => post({ cmd: "start" }));
  $("btnStop").addEventListener("click", () => post({ cmd: "stop" }));
  $("btnTick").addEventListener("click", () => post({ cmd: "tick", n: 1 }));
  $("btnAddPlayer").addEventListener("click", () => {
    const name = $("playerName").value || "player";
    const opEl = $("playerOp");
    const op = Boolean(opEl.checked);
    post({ cmd: "create", kind: "Player", props: { name, op } });
  });
  $("btnEmit").addEventListener("click", () => {
    if (!active || active.type !== "event") return;
    lastEmitPath = active.path;
    post({ cmd: "emit", path: active.path, payload: formValues });
  });
  $("eventSearch").addEventListener("input", (e) => {
    eventFilter = e.target.value || "";
    renderEventTree();
  });
  $("sceneTree").addEventListener("vsc-tree-select", onTreeSelect);
  $("eventTree").addEventListener("vsc-tree-select", onTreeSelect);

  $("viewportTabs").addEventListener("vsc-tabs-select", () => {
    if ($("viewportTabs").selectedIndex === 1) refreshState();
  });

  $("btnLabCreate").addEventListener("click", () => {
    let props = {};
    try {
      props = JSON.parse($("labProps").value || "{}");
    } catch {
      logLine("[lab] props JSON 无效");
      return;
    }
    post({ cmd: "create", kind: $("labKind").value, props });
  });
  $("btnLabCall").addEventListener("click", () => {
    let args = [];
    try {
      args = JSON.parse($("labArgs").value || "[]");
    } catch {
      logLine("[lab] args JSON 无效");
      return;
    }
    post({ cmd: "call", id: $("labObjectId").value, method: $("labMethod").value, args });
  });
  $("btnLabEmit").addEventListener("click", () => {
    let payload = {};
    try {
      payload = JSON.parse($("labPayload").value || "{}");
    } catch {
      logLine("[lab] payload JSON 无效");
      return;
    }
    post({ cmd: "emit", path: $("labEventPath").value, payload });
  });
  $("labObjects").addEventListener("change", () => {
    $("labObjectId").value = $("labObjects").value;
  });

  let progressStep = 0;
  const PROGRESS_TOTAL = 13;

  window.addEventListener("message", (e) => {
    const msg = e.data;
    if (msg.type === "hostEvent") {
      if (msg.name === "log" && msg.payload?.text) logLine(msg.payload.text);
      if (msg.name === "progress") {
        const p = msg.payload || {};
        if (p.status === "running") progressStep = (p.id ?? progressStep) + 1;
        setProgress(Math.min(1, progressStep / PROGRESS_TOTAL), `[${p.layer || ""}] ${p.label || ""}`);
        if (p.status === "done" && p.id === 12) setProgress(1, "就绪");
      }
      return;
    }
    if (msg.type === "started") {
      meta = msg.meta;
      started = true;
      progressStep = PROGRESS_TOTAL;
      setProgress(1, "就绪");
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
      progressStep = 0;
      setProgress(null);
      setStatus("已销毁");
      renderAll();
      logLine("[stopped]");
      return;
    }
    if (msg.type === "created") {
      if (msg.result?.kind === "Player") {
        players = players.filter((p) => p.id !== msg.result.id);
        players.push({
          id: msg.result.id,
          name: msg.props?.name || msg.result.id,
          kind: "Player",
        });
      }
      const labSel = $("labObjects");
      const o = document.createElement("vscode-option");
      o.value = msg.result.id;
      o.textContent = `${msg.result.kind} ${msg.result.id}`;
      labSel.appendChild(o);
      $("labObjectId").value = msg.result.id;
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
      $("statePre").textContent = [
        `started: ${s.started}`,
        `players: ${s.playerCount ?? 0}`,
        ...(s.players || []).map((p) => `  - ${p.name} (${p.id})`),
        `objects: ${s.objectCount ?? 0}`,
        `eventPaths: ${s.eventPathCount ?? 0}`,
        `lastEmit: ${s.lastEmit ? `${s.lastEmit.path} @ ${new Date(s.lastEmit.at).toISOString()}` : "(none)"}`,
        `note: ${s.note || ""}`,
        `uiLastEmit: ${lastEmitPath || "(none)"}`,
      ].join("\n");
      if (Array.isArray(s.players)) {
        players = s.players.map((p) => ({ id: p.id, name: p.name, kind: p.kind || "Player" }));
        renderSceneTree();
      }
    }
  });

  setStatus("未启动");
  setProgress(null);
  logLine("事件刺激台就绪 · 控件基于 VS Code Elements");
  logLine("规格：docs/superpowers/specs/2026-07-31-sfmc-playground-stimulus-ux-design.md");
})();
