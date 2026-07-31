import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  reconnectEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type NodeTypes,
  type ReactFlowInstance,
  BackgroundVariant,
} from "@xyflow/react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  StimulusNode,
  clipRunSummary,
  formatCallDetail,
  type StimulusFlowNode,
  type StimulusKind,
  type StimulusNodeData,
} from "./StimulusNode";
import { vscodeApi } from "./vscodeApi";
import {
  assertInspectIds,
  assertTitle,
  evaluateAssert,
  formatAssertDetail,
  migrateAssertConfig,
  normalizeAssertKind,
} from "../graph/assert";
import {
  hasFailOutEdges,
  normalizeEdgeKind,
  orderAssertBranch,
  orderNodes,
  type EdgeKind,
  type RunMode,
} from "../graph/order";
import {
  bindCreateObjectId,
  clearCreateObjectIds,
  createApiKind,
  createPayloadForKind,
  isCreateStimulusKind,
  preferredEntityObjectId,
  preferredItemObjectId,
  preferredPlayerObjectId,
  type CreateStimulusKind,
} from "../graph/materialize";
import { useGraphHistory, useLayoutPrefs, type PanelId } from "./layoutPrefs";
import { Codicon } from "./Codicon";
import { DockPanel } from "./DockPanel";
import { HotkeysPanelBody, PropsPanelBody } from "./PropsPanelBody";
import { SceneDock } from "./SceneDock";
import { FixturePanel, type FixtureSnapshot } from "./FixturePanel";
import { ScrollArea } from "./ScrollArea";
import {
  entityCreateProps,
  eventProps,
  itemCreateProps,
  playerCreateProps,
  seedProps,
  type ModuleBinding,
  type PlaygroundMeta,
  type SceneSummary,
} from "./metaForm";

type Meta = PlaygroundMeta;

const nodeTypes: NodeTypes = { stimulus: StimulusNode };

const KIND_MINIMAP: Record<StimulusKind, string> = {
  player: "#4ec9b0",
  entity: "#569cd6",
  item: "#ce9178",
  emit: "#569cd6",
  call: "#4fc1ff",
  tick: "#dcdcaa",
  assert: "#ce9178",
  note: "#808080",
};

/** 画布点阵 / 小地图 mask 跟亮暗 */
function useCanvasChrome() {
  const [light, setLight] = useState(() =>
    typeof document !== "undefined"
      ? document.body.classList.contains("vscode-light") ||
        document.body.classList.contains("vscode-high-contrast-light")
      : false
  );
  useEffect(() => {
    const sync = () => {
      setLight(
        document.body.classList.contains("vscode-light") ||
          document.body.classList.contains("vscode-high-contrast-light")
      );
    };
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return useMemo(
    () => ({
      dot: light ? "#c8c8c8" : "#333",
      minimapBg: "var(--vscode-sideBar-background)",
      mask: light ? "rgb(255 255 255 / 55%)" : "rgb(0 0 0 / 50%)",
    }),
    [light]
  );
}

/** 默认示例玩家的稳定 registry id（与 FakePlayer 默认 player-${name} 一致） */
const DEMO_PLAYER_ID = preferredPlayerObjectId({ name: "alice" });

const initialNodes: StimulusFlowNode[] = [
  {
    id: "n1",
    type: "stimulus",
    position: { x: 40, y: 120 },
    data: {
      kind: "player",
      title: "alice",
      detail: "op · overworld",
      props: {
        id: DEMO_PLAYER_ID,
        name: "alice",
        op: true,
        dimensionId: "minecraft:overworld",
        location: { x: 0, y: 64, z: 0 },
      },
    },
  },
  {
    id: "n2",
    type: "stimulus",
    position: { x: 300, y: 60 },
    data: {
      kind: "emit",
      title: "playerJoin",
      detail: "world.afterEvents.playerJoin",
      path: "world.afterEvents.playerJoin",
      props: { playerName: "alice", playerId: DEMO_PLAYER_ID },
    },
  },
  {
    id: "n3",
    type: "stimulus",
    position: { x: 300, y: 200 },
    data: {
      kind: "emit",
      title: "chatSend",
      detail: "world.beforeEvents.chatSend",
      path: "world.beforeEvents.chatSend",
      props: {
        message: "!help",
        cancel: false,
        sender: { $ref: DEMO_PLAYER_ID },
      },
    },
  },
  {
    id: "n4",
    type: "stimulus",
    position: { x: 580, y: 130 },
    data: { kind: "tick", title: "Tick ×5", detail: "n = 5", n: 5 },
  },
  {
    id: "n5",
    type: "stimulus",
    position: { x: 820, y: 130 },
    data: {
      kind: "assert",
      assertKind: "sceneExists",
      title: "场景存在",
      detail: `Player · name=alice`,
      targetKind: "Player",
      targetName: "alice",
    },
  },
];

const initialEdges: Edge[] = [
  { id: "e1-2", source: "n1", target: "n2" },
  { id: "e1-3", source: "n1", target: "n3" },
  { id: "e2-4", source: "n2", target: "n4" },
  { id: "e3-4", source: "n3", target: "n4" },
  { id: "e4-5", source: "n4", target: "n5" },
];

/** 与手动保存 / host 自动存档同一 schema */
type SandboxScript = {
  schemaVersion: number;
  nodes: StimulusFlowNode[];
  edges: Edge[];
};

type WebviewPersisted = {
  layout?: unknown;
  script?: SandboxScript;
};

function migrateScriptNodes(nodes: StimulusFlowNode[]): StimulusFlowNode[] {
  return nodes.map((n) => {
    if (n.data?.kind !== "assert") return n;
    const cfg = migrateAssertConfig(n.data);
    const assertKind = normalizeAssertKind(cfg.assertKind);
    return {
      ...n,
      data: {
        ...n.data,
        ...cfg,
        assertKind,
        title: assertTitle(assertKind),
        detail: formatAssertDetail({ ...cfg, assertKind }),
      },
    };
  });
}

function migrateScriptEdges(edges: Edge[]): Edge[] {
  return edges.map((e) => {
    const prev = typeof e.data === "object" && e.data ? { ...(e.data as Record<string, unknown>) } : {};
    let kind = normalizeEdgeKind(prev.kind);
    const rawLabel = typeof e.label === "string" ? e.label.trim() : "";
    const rawNote = String(prev.note ?? "").trim();
    let note = rawNote || rawLabel;
    // 旧剧本把「失败」写在 label 上时推断为失败边
    if (prev.kind == null && (rawLabel === "失败" || rawLabel.startsWith("失败 · "))) {
      kind = "fail";
      note = rawLabel === "失败" ? "" : rawLabel.replace(/^失败 ·\s*/, "");
    }
    if (note === "通过" || note === "失败") note = "";
    return {
      ...e,
      label: note || undefined,
      data: { ...prev, kind, note: note || undefined },
    };
  });
}

/** 画布展示用：失败边红虚线；断言出边标「通过/失败」 */
function decorateFlowEdges(edges: Edge[], nodes: StimulusFlowNode[]): Edge[] {
  const assertIds = new Set(nodes.filter((n) => n.data.kind === "assert").map((n) => n.id));
  return edges.map((e) => {
    const kind = normalizeEdgeKind((e.data as { kind?: string } | undefined)?.kind);
    const note =
      String((e.data as { note?: string } | undefined)?.note ?? "").trim() ||
      (typeof e.label === "string" ? e.label.trim() : "");
    const fromAssert = assertIds.has(e.source);
    let label: string | undefined;
    if (kind === "fail") label = note ? `失败 · ${note}` : "失败";
    else if (fromAssert) label = note ? `通过 · ${note}` : "通过";
    else label = note || undefined;
    return {
      ...e,
      label,
      className: kind === "fail" ? "edge-fail" : fromAssert ? "edge-pass" : undefined,
      data: {
        ...(typeof e.data === "object" && e.data ? e.data : {}),
        kind,
        note: note || undefined,
      },
    };
  });
}

function readScriptFromWebviewState(): SandboxScript | undefined {
  const st = vscodeApi().getState() as WebviewPersisted | undefined;
  const s = st?.script;
  if (!s || !Array.isArray(s.nodes) || !Array.isArray(s.edges)) return undefined;
  return {
    schemaVersion: typeof s.schemaVersion === "number" ? s.schemaVersion : 1,
    nodes: migrateScriptNodes(s.nodes),
    edges: migrateScriptEdges(s.edges),
  };
}

function buildScript(nodes: StimulusFlowNode[], edges: Edge[]): SandboxScript {
  return { schemaVersion: 1, nodes, edges };
}

function writeScriptToWebviewState(script: SandboxScript): void {
  const prev = (vscodeApi().getState() as WebviewPersisted | undefined) ?? {};
  vscodeApi().setState({ ...prev, script });
}

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = IS_MAC ? "⌘" : "Ctrl";

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable;
}

const INSERT_ITEMS = [
  ["player", "Player", "1"],
  ["entity", "Entity", "2"],
  ["item", "ItemStack", "3"],
  ["emit", "Emit", "4"],
  ["call", "Call", "5"],
  ["tick", "Tick", "6"],
  ["assert", "断言", "7"],
  ["note", "注释", "8"],
] as const;

function MenuKbd({ children }: { children: string }) {
  return <span className="rdx-kbd">{children}</span>;
}

function InsertMenuItems({ onInsert }: { onInsert: (kind: StimulusKind) => void }) {
  return (
    <>
      {INSERT_ITEMS.map(([kind, title, num]) => (
        <DropdownMenu.Item key={kind} className="rdx-item" onSelect={() => onInsert(kind)}>
          <span className="rdx-item-main">{title}</span>
          <MenuKbd>
            {MOD}+{num}
          </MenuKbd>
        </DropdownMenu.Item>
      ))}
    </>
  );
}

function InsertSubmenu({ onInsert }: { onInsert: (kind: StimulusKind) => void }) {
  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger className="rdx-item rdx-sub-trigger">
        <span className="rdx-item-main">插入…</span>
        <Codicon name="chevron-right" className="rdx-chevron" />
      </DropdownMenu.SubTrigger>
      <DropdownMenu.Portal>
        <DropdownMenu.SubContent className="rdx-content" sideOffset={4} alignOffset={-4}>
          <InsertMenuItems onInsert={onInsert} />
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Sub>
  );
}

function TopMenu({
  label,
  children,
  disabled,
}: {
  label: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button type="button" className="menu-btn" disabled={disabled}>
          {label}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="rdx-content" sideOffset={4} align="start">
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export default function App() {
  const bootGraph = useMemo(() => {
    const saved = readScriptFromWebviewState();
    return saved
      ? { nodes: saved.nodes, edges: saved.edges, fromWebview: true as const }
      : { nodes: initialNodes, edges: initialEdges, fromWebview: false as const };
  }, []);
  const [nodes, setNodes, onNodesChangeBase] = useNodesState(bootGraph.nodes);
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState(bootGraph.edges);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef(edges);
  edgesRef.current = edges;
  const rfRef = useRef<ReactFlowInstance | null>(null);
  /** 已从 webview state 恢复时，started 不再用 host 文件覆盖（防抖窗口内重载） */
  const skipHostScript = useRef(bootGraph.fromWebview);
  /** 收到 started（含可选 host 恢复）后再防抖写盘，避免用内置示例覆盖存档 */
  const [canPersist, setCanPersist] = useState(false);
  const { push: pushHistory, pushBurst, undo, redo, canUndo, canRedo } = useGraphHistory(
    nodes,
    edges,
    setNodes,
    setEdges
  );
  const { prefs, setPanel, togglePanel, setDockWidth, resetLayout } = useLayoutPrefs();
  const [selectedId, setSelectedId] = useState<string | null>(() => bootGraph.nodes[0]?.id ?? null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [status, setStatus] = useState("装载沙箱…");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [scene, setScene] = useState<SceneSummary | null>(null);
  const [moduleBinding, setModuleBinding] = useState<ModuleBinding>(() => ({
    moduleRoot: typeof document !== "undefined" ? document.body.dataset.module ?? null : null,
    id: null,
    version: null,
    enabled: null,
    status: "pending",
    subscribedEvents: [],
  }));
  const [sideFocus, setSideFocus] = useState<"graph" | "scene">("graph");
  const [sceneObjectId, setSceneObjectId] = useState<string | null>(null);
  const [inspect, setInspect] = useState<{
    id: string;
    kind: string;
    props: Record<string, unknown>;
  } | null>(null);
  const [hotkeysOpen, setHotkeysOpen] = useState(false);
  const [fixture, setFixture] = useState<FixtureSnapshot | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    nodeId: string | null;
    edgeId: string | null;
  } | null>(null);
  const pending = useMemo(() => new Map<string, Pending>(), []);
  /** 仅供断言匹配；展示走 VS Code Output */
  const logRef = useRef<string[]>(["脚本沙箱 · sapi-sandbox"]);

  const selected = useMemo(() => nodes.find((n) => n.id === selectedId) ?? null, [nodes, selectedId]);
  const selectedEdge = useMemo(
    () => edges.find((e) => e.id === selectedEdgeId) ?? null,
    [edges, selectedEdgeId]
  );
  const flowEdges = useMemo(() => decorateFlowEdges(edges, nodes), [edges, nodes]);
  const failedNodeId = useMemo(
    () => nodes.find((n) => n.data.runState === "failed")?.id ?? null,
    [nodes]
  );

  const appendLog = useCallback((line: string, level: "info" | "warn" | "error" | "debug" = "info") => {
    logRef.current = [...logRef.current.slice(-400), line];
    vscodeApi().postMessage({ cmd: "uiLog", text: line, level });
  }, []);

  const request = useCallback(
    (cmd: string, body: Record<string, unknown> = {}) =>
      new Promise<unknown>((resolve, reject) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        pending.set(id, { resolve, reject });
        vscodeApi().postMessage({ cmd, requestId: id, ...body });
        setTimeout(() => {
          if (pending.has(id)) {
            pending.delete(id);
            reject(new Error(`超时: ${cmd}`));
          }
        }, 60000);
      }),
    [pending]
  );

  const refreshScene = useCallback(async () => {
    try {
      const summary = (await request("sceneSummary")) as SceneSummary;
      setScene(summary);
    } catch (e) {
      appendLog(`[scene] ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [appendLog, request]);

  const refreshFixture = useCallback(async () => {
    try {
      const snap = (await request("fixtureGet")) as FixtureSnapshot;
      setFixture(snap);
      if (snap.module?.id || snap.enabled != null) {
        setModuleBinding((prev) => ({
          ...prev,
          id: snap.module?.id ?? prev.id,
          moduleRoot: snap.moduleRoot ?? prev.moduleRoot,
          enabled: snap.enabled,
          status: snap.module?.id ? "loaded" : prev.status,
        }));
      }
    } catch (e) {
      appendLog(`[fixture] ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [appendLog, request]);

  const applyFixture = useCallback(
    async (intent: FixtureSnapshot["intent"]) => {
      try {
        const snap = (await request("fixtureApply", { fixture: intent })) as FixtureSnapshot;
        setFixture(snap);
        appendLog(
          `[fixture] applied settings=${Object.keys(intent.settings ?? {}).length} enabled=${intent.enabled ?? "—"}`
        );
        await refreshScene();
      } catch (e) {
        appendLog(`[fixture] ${e instanceof Error ? e.message : String(e)}`, "error");
        throw e;
      }
    },
    [appendLog, refreshScene, request]
  );

  const clearFixtureDb = useCallback(async () => {
    try {
      const snap = (await request("fixtureClearDb")) as FixtureSnapshot;
      setFixture(snap);
      appendLog("[fixture] fake-db cleared");
    } catch (e) {
      appendLog(`[fixture] ${e instanceof Error ? e.message : String(e)}`, "error");
      throw e;
    }
  }, [appendLog, request]);

  /**
   * 将图上未实例化的 Player / Entity / ItemStack 节点 objects.create 进 registry，并回写 objectId。
   * 打开/重置沙箱后调用；运行节点时也可复用。
   */
  const materializeCreateNodes = useCallback(
    async (source: StimulusFlowNode[]): Promise<StimulusFlowNode[]> => {
      const creates = source.filter((n) => isCreateStimulusKind(n.data.kind));
      if (!creates.length) return source;
      let next = source;
      const createdByKind: Record<string, number> = {};
      for (const n of creates) {
        const stimKind = n.data.kind as CreateStimulusKind;
        const props = createPayloadForKind(stimKind, n.data);
        const wantId = String(props.id);
        if (n.data.objectId === wantId) {
          try {
            await request("inspect", { id: wantId });
            continue;
          } catch {
            /* 场景已丢，重新 create */
          }
        }
        const result = (await request("create", {
          kind: createApiKind(stimKind),
          props,
        })) as { id: string; kind: string };
        next = bindCreateObjectId(next, n.id, result.id);
        createdByKind[stimKind] = (createdByKind[stimKind] ?? 0) + 1;
      }
      setNodes(next);
      await refreshScene();
      const parts = Object.entries(createdByKind).map(([k, n]) => `${n} 个 ${createApiKind(k as CreateStimulusKind)}`);
      if (parts.length > 0) {
        appendLog(`[scene] 已登记 ${parts.join("、")}（图节点 → objects.create）`);
      }
      return next;
    },
    [appendLog, refreshScene, request, setNodes]
  );

  const selectSceneObject = useCallback(
    async (objectId: string) => {
      setSideFocus("scene");
      setSceneObjectId(objectId);
      try {
        const snap = (await request("inspect", { id: objectId })) as {
          id: string;
          kind: string;
          props: Record<string, unknown>;
        };
        setInspect(snap);
      } catch (e) {
        setInspect(null);
        appendLog(`[inspect] ${e instanceof Error ? e.message : String(e)}`);
      }
    },
    [appendLog, request]
  );

  const selectGraphNode = useCallback((nodeId: string | null) => {
    setSideFocus("graph");
    setSelectedId(nodeId);
    setSelectedEdgeId(null);
    setSceneObjectId(null);
    setInspect(null);
  }, []);

  const selectGraphEdge = useCallback((edgeId: string | null) => {
    setSideFocus("graph");
    setSelectedEdgeId(edgeId);
    setSelectedId(null);
    setSceneObjectId(null);
    setInspect(null);
  }, []);

  const applyScript = useCallback(
    (raw: { nodes?: StimulusFlowNode[]; edges?: Edge[] }, logLine: string) => {
      let nextNodes: StimulusFlowNode[] | null = null;
      if (Array.isArray(raw.nodes)) {
        nextNodes = clearCreateObjectIds(migrateScriptNodes(raw.nodes));
        setNodes(nextNodes);
        setSelectedId(raw.nodes[0]?.id ?? null);
        setSelectedEdgeId(null);
      }
      if (Array.isArray(raw.edges)) setEdges(migrateScriptEdges(raw.edges));
      appendLog(logLine);
      return nextNodes;
    },
    [appendLog, setEdges, setNodes]
  );

  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      const msg = ev.data;
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "rpcResult" && msg.requestId) {
        const p = pending.get(msg.requestId);
        if (!p) return;
        pending.delete(msg.requestId);
        if (msg.error) p.reject(new Error(String(msg.error)));
        else p.resolve(msg.result);
        return;
      }
      if (msg.type === "hostEvent" && msg.name === "log" && msg.payload?.text) {
        const text = String(msg.payload.text);
        logRef.current = [...logRef.current.slice(-400), text];
        return;
      }
      if (msg.type === "started") {
        setMeta(msg.meta ?? null);
        setScene((msg.summary as SceneSummary) ?? null);
        const binding = (msg.moduleBinding ??
          (msg.summary as SceneSummary | undefined)?.moduleBinding ??
          msg.result?.moduleBinding) as ModuleBinding | undefined;
        if (binding) {
          setModuleBinding(binding);
          if (typeof document !== "undefined") {
            document.body.dataset.moduleStatus = binding.status ?? "loaded";
            if (binding.id) document.body.dataset.moduleId = binding.id;
          }
        }
        setReady(true);
        setStatus(
          binding?.id
            ? `已装载 ${binding.id}${binding.version ? `@${binding.version}` : ""}`
            : "就绪（engine only）"
        );
        setInspect(null);
        setSceneObjectId(null);
        // host 带 script：跨会话权威；若本轮已从 getState 恢复则跳过，避免覆盖未落盘编辑
        let graphForMaterialize: StimulusFlowNode[] | null = null;
        if (msg.script && Array.isArray(msg.script.nodes) && !skipHostScript.current) {
          graphForMaterialize = applyScript(
            msg.script as SandboxScript,
            "[script] 已恢复自动保存的剧本"
          );
        } else {
          // 重置世界后清空脏 objectId，再重新登记
          graphForMaterialize = clearCreateObjectIds(nodesRef.current);
          setNodes(graphForMaterialize);
        }
        skipHostScript.current = false;
        setCanPersist(true);
        appendLog(JSON.stringify(msg.result ?? { ok: true }));
        if (binding?.id) {
          appendLog(
            `[module] id=${binding.id} version=${binding.version ?? "?"} enabled=${binding.enabled ?? "?"} root=${binding.moduleRoot ?? ""}`
          );
        }
        const subs = binding?.subscribedEvents ?? [];
        if (subs.length > 0) {
          appendLog(
            `[module] subscribed=[${subs.map((e) => `${e.path}×${e.listeners}`).join(", ")}]`
          );
        }
        const fixtureFromStart = (msg.result as { fixture?: FixtureSnapshot } | undefined)?.fixture;
        if (fixtureFromStart) {
          setFixture(fixtureFromStart);
        } else {
          void refreshFixture();
        }
        if (graphForMaterialize) {
          void materializeCreateNodes(graphForMaterialize).catch((e) => {
            appendLog(`[scene] 自动登记失败: ${e instanceof Error ? e.message : String(e)}`);
          });
        }
        return;
      }
      if (msg.type === "scriptLoaded" && msg.script) {
        const next = applyScript(msg.script as SandboxScript, "[script] 已打开剧本");
        setCanPersist(true);
        if (next) {
          void materializeCreateNodes(next).catch((e) => {
            appendLog(`[scene] 自动登记失败: ${e instanceof Error ? e.message : String(e)}`);
          });
        }
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [appendLog, applyScript, materializeCreateNodes, pending, refreshFixture, setEdges, setNodes]);

  // 防抖自动保存：webview state + host 文件 / workspaceState
  useEffect(() => {
    if (!canPersist) return;
    const script = buildScript(nodes, edges);
    const timer = window.setTimeout(() => {
      writeScriptToWebviewState(script);
      vscodeApi().postMessage({ cmd: "persistScript", script });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [nodes, edges, canPersist]);

  const onNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChangeBase>[0]) => {
      if (changes.some((c) => c.type === "remove")) pushHistory();
      onNodesChangeBase(changes);
    },
    [onNodesChangeBase, pushHistory]
  );

  const onEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChangeBase>[0]) => {
      if (changes.some((c) => c.type === "remove")) {
        pushHistory();
        const removed = new Set(
          changes.filter((c): c is { type: "remove"; id: string } => c.type === "remove").map((c) => c.id)
        );
        if (selectedEdgeId && removed.has(selectedEdgeId)) setSelectedEdgeId(null);
      }
      onEdgesChangeBase(changes);
    },
    [onEdgesChangeBase, pushHistory, selectedEdgeId]
  );

  const onConnect = useCallback(
    (c: Connection) => {
      pushHistory();
      setEdges((eds) =>
        addEdge({ ...c, id: `e-${c.source}-${c.target}`, data: { kind: "pass" as EdgeKind } }, eds)
      );
    },
    [pushHistory, setEdges]
  );

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      pushHistory();
      setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds));
      appendLog(`[edit] 重连边 ${oldEdge.id} → ${newConnection.source}→${newConnection.target}`);
    },
    [appendLog, pushHistory, setEdges]
  );

  const patchEdgeLabel = useCallback(
    (id: string, label: string) => {
      pushBurst();
      const trimmed = label.trim();
      setEdges((es) =>
        es.map((e) =>
          e.id === id
            ? {
                ...e,
                label: trimmed || undefined,
                data: {
                  ...(e.data as Record<string, unknown> | undefined),
                  kind: normalizeEdgeKind((e.data as { kind?: string } | undefined)?.kind),
                  note: trimmed || undefined,
                },
              }
            : e
        )
      );
    },
    [pushBurst, setEdges]
  );

  const patchEdgeKind = useCallback(
    (id: string, kind: EdgeKind) => {
      pushHistory();
      setEdges((es) =>
        es.map((e) =>
          e.id === id
            ? {
                ...e,
                data: {
                  ...(e.data as Record<string, unknown> | undefined),
                  kind,
                  note: (e.data as { note?: string } | undefined)?.note,
                },
              }
            : e
        )
      );
      appendLog(`[edit] 边 ${id} → ${kind === "fail" ? "失败边" : "通过边"}`);
    },
    [appendLog, pushHistory, setEdges]
  );

  const deleteEdgesByIds = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      pushHistory();
      const drop = new Set(ids);
      setEdges((es) => es.filter((e) => !drop.has(e.id)));
      if (selectedEdgeId && drop.has(selectedEdgeId)) setSelectedEdgeId(null);
      appendLog(`[edit] 删除边 ${ids.join(", ")}`);
    },
    [appendLog, pushHistory, selectedEdgeId, setEdges]
  );

  const patchNodeData = useCallback(
    (id: string, patch: Partial<StimulusNodeData>) => {
      pushBurst();
      setNodes((ns) =>
        ns.map((n) => {
          if (n.id !== id) return n;
          const data = { ...n.data, ...patch };
          if (data.kind === "player" && patch.title != null) {
            data.props = { ...data.props, name: patch.title };
            data.objectId = undefined;
          }
          if (isCreateStimulusKind(data.kind) && patch.props != null) {
            data.objectId = undefined;
          }
          if (data.kind === "emit" && patch.path) {
            data.title = patch.path.split(".").pop() ?? patch.path;
            data.detail = patch.path;
          }
          if (data.kind === "tick" && patch.n != null) {
            data.title = `Tick ×${patch.n}`;
            data.detail = `n = ${patch.n}`;
          }
          if (data.kind === "call") {
            if (patch.title == null) data.title = data.method || "Call";
            if (patch.detail == null) data.detail = formatCallDetail(data);
          }
          if (data.kind === "assert") {
            const assertKind = normalizeAssertKind(data.assertKind);
            data.assertKind = assertKind;
            if (patch.title == null) data.title = assertTitle(assertKind);
            if (patch.detail == null) data.detail = formatAssertDetail(data);
          }
          return { ...n, data };
        })
      );
    },
    [pushBurst, setNodes]
  );

  const setRunState = useCallback(
    (id: string, runState: StimulusNodeData["runState"], runSummary?: string) => {
      setNodes((ns) =>
        ns.map((n) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  runState,
                  ...(runSummary !== undefined ? { runSummary } : {}),
                },
              }
            : n
        )
      );
    },
    [setNodes]
  );

  const locateFailedNode = useCallback(() => {
    const id = nodesRef.current.find((n) => n.data.runState === "failed")?.id;
    if (!id) {
      appendLog("[run] 无失败节点可定位");
      return;
    }
    selectGraphNode(id);
    rfRef.current?.fitView({ nodes: [{ id }], padding: 0.45, duration: 280 });
    setStatus(`已定位失败节点 ${id}`);
  }, [appendLog, selectGraphNode]);

  const run = useCallback(
    async (mode: RunMode, focusId?: string | null) => {
      if (busy || !ready) return;
      const sel = focusId !== undefined ? focusId : selectedId;
      if ((mode === "from" || mode === "only" || mode === "upstream") && !sel) {
        appendLog("[run] 请先选中节点或边");
        return;
      }
      setBusy(true);
      const label =
        mode === "graph"
          ? "运行整图"
          : mode === "from"
            ? "从选中运行"
            : mode === "only"
              ? "仅运行选中"
              : "运行上游";
      setStatus(`${label}…`);
      appendLog(`[run] ${label}`);
      setNodes((ns) =>
        ns.map((n) => ({
          ...n,
          data: { ...n.data, runState: "idle" as const, runSummary: undefined },
        }))
      );

      const graphEdges = edgesRef.current.map((e) => ({
        source: e.source,
        target: e.target,
        kind: normalizeEdgeKind((e.data as { kind?: string } | undefined)?.kind),
      }));
      let order = orderNodes(
        nodesRef.current.map((n) => ({ id: n.id, kind: n.data.kind })),
        graphEdges,
        mode,
        sel
      );

      let failed = false;
      let divertedFail = false;
      const doneIds = new Set<string>();
      for (let i = 0; i < order.length; i++) {
        const id = order[i]!;
        if (doneIds.has(id)) continue;
        const n = nodesRef.current.find((x) => x.id === id);
        if (!n) continue;
        setSelectedId(id);
        setRunState(id, "running");
        appendLog(`[run] → ${n.data.kind} ${n.data.title}`);
        try {
          if (isCreateStimulusKind(n.data.kind)) {
            const stimKind = n.data.kind as CreateStimulusKind;
            const props = createPayloadForKind(stimKind, n.data);
            const wantId = String(props.id);
            let objectId = n.data.objectId;
            if (objectId === wantId) {
              try {
                await request("inspect", { id: objectId });
              } catch {
                objectId = undefined;
              }
            } else {
              objectId = undefined;
            }
            if (!objectId) {
              const result = (await request("create", {
                kind: createApiKind(stimKind),
                props,
              })) as { id: string; kind: string };
              objectId = result.id;
              setNodes((ns) => bindCreateObjectId(ns, n.id, result.id));
            }
            await refreshScene();
            setRunState(id, "done", clipRunSummary(`ok · ${objectId}`));
          } else if (n.data.kind === "emit") {
            const emitResult = (await request("emit", {
              path: n.data.path ?? n.data.detail,
              payload: n.data.props ?? {},
            })) as { listeners?: number; errors?: { message: string }[] };
            const nListen = emitResult?.listeners ?? 0;
            const nErr = emitResult?.errors?.length ?? 0;
            appendLog(
              `[emit] ${n.data.path ?? n.data.detail} → ${nListen} listener(s)` +
                (nErr ? ` · ${nErr} error(s)` : "")
            );
            await refreshScene();
            const path = n.data.path ?? n.data.detail ?? "emit";
            setRunState(
              id,
              "done",
              clipRunSummary(`lastEmit · ${path}${nErr ? ` · ${nErr}err` : ""}`)
            );
          } else if (n.data.kind === "call") {
            let args: unknown[] = [];
            try {
              const parsed = JSON.parse(n.data.argsJson || "[]");
              if (!Array.isArray(parsed)) throw new Error("args 须为 JSON 数组");
              args = parsed;
            } catch (e) {
              throw new Error(`Call args JSON 无效: ${e instanceof Error ? e.message : String(e)}`);
            }
            if (!n.data.targetId) throw new Error("Call 未选择目标对象");
            if (!n.data.method) throw new Error("Call 未指定 method");
            await request("call", {
              id: n.data.targetId,
              method: n.data.method,
              args,
            });
            await refreshScene();
            setRunState(
              id,
              "done",
              clipRunSummary(`lastCall · ${n.data.targetId}.${n.data.method}`)
            );
          } else if (n.data.kind === "tick") {
            const ticks = n.data.n ?? 1;
            await request("tick", { n: ticks });
            setRunState(id, "done", clipRunSummary(`ok · ×${ticks}`));
          } else if (n.data.kind === "assert") {
            await new Promise((r) => setTimeout(r, 80));
            const cfg = migrateAssertConfig(n.data);
            const assertKind = normalizeAssertKind(cfg.assertKind);
            const summary = (await request("sceneSummary")) as SceneSummary;
            setScene(summary);
            const refs: Record<string, { id: string; kind: string; props: Record<string, unknown> }> =
              {};
            for (const oid of assertInspectIds({ ...cfg, assertKind })) {
              try {
                const snap = (await request("inspect", { id: oid })) as {
                  id: string;
                  kind: string;
                  props: Record<string, unknown>;
                };
                refs[snap.id] = snap;
              } catch {
                /* 缺失由求值报错 */
              }
            }
            const target = cfg.targetId ? refs[cfg.targetId] ?? null : null;
            const result = evaluateAssert(
              { ...cfg, assertKind },
              { logs: logRef.current, scene: summary, target, refs }
            );
            if (!result.ok) {
              setRunState(id, "failed", clipRunSummary(`失败 · ${result.message}`));
              appendLog(`[assert] 失败: ${result.message}`);
              doneIds.add(id);
              if (mode !== "only" && hasFailOutEdges(graphEdges, id)) {
                const branch = orderAssertBranch(
                  nodesRef.current.map((x) => ({ id: x.id, kind: x.data.kind })),
                  graphEdges,
                  id,
                  "fail"
                ).filter((nid) => !doneIds.has(nid));
                appendLog(`[assert] 转向失败边 → ${branch.join(" → ") || "(无下游)"}`);
                divertedFail = true;
                order = [...order.slice(0, i + 1), ...branch];
                continue;
              }
              failed = true;
              break;
            }
            appendLog(`[assert] ok: ${result.message}`);
            setRunState(id, "done", clipRunSummary(`ok · ${result.message}`));
          } else {
            setRunState(id, "done", "ok");
          }
          doneIds.add(id);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          setRunState(id, "failed", clipRunSummary(`错误 · ${msg}`));
          appendLog(`[error] ${msg}`);
          failed = true;
          break;
        }
      }
      setStatus(
        failed ? "已停止（失败）" : divertedFail ? "就绪（曾走失败边）" : "就绪"
      );
      setBusy(false);
    },
    [
      appendLog,
      busy,
      ready,
      refreshScene,
      request,
      selectedId,
      setNodes,
      setRunState,
      setScene,
    ]
  );

  const runUpstreamFromEdge = useCallback(
    (edgeId: string) => {
      const edge = edges.find((e) => e.id === edgeId);
      if (!edge) {
        appendLog("[run] 边不存在");
        return;
      }
      selectGraphEdge(edgeId);
      void run("upstream", edge.source);
    },
    [appendLog, edges, run, selectGraphEdge]
  );

  const addNode = useCallback(
    (kind: StimulusKind) => {
      pushHistory();
      const id = `n${Date.now()}`;
      const playerFields = playerCreateProps(meta);
      const entityFields = entityCreateProps(meta);
      const itemFields = itemCreateProps(meta);
      const defaults: Record<StimulusKind, StimulusNodeData> = {
        player: {
          kind: "player",
          title: "bob",
          detail: "op · overworld",
          props: seedProps(playerFields, {
            id: preferredPlayerObjectId({ name: "bob" }),
            name: "bob",
            op: true,
            dimensionId: "minecraft:overworld",
            location: { x: 0, y: 64, z: 0 },
          }),
        },
        entity: {
          kind: "entity",
          title: "cow",
          detail: "overworld · 0,64,0",
          props: seedProps(entityFields, {
            id: preferredEntityObjectId({ typeId: "minecraft:cow" }),
            typeId: "minecraft:cow",
            dimensionId: "minecraft:overworld",
            location: { x: 0, y: 64, z: 0 },
          }),
        },
        item: {
          kind: "item",
          title: "apple",
          detail: "×1",
          props: seedProps(itemFields, {
            id: preferredItemObjectId({ typeId: "minecraft:apple" }),
            typeId: "minecraft:apple",
            amount: 1,
          }),
        },
        emit: {
          kind: "emit",
          title: "chatSend",
          detail: "world.beforeEvents.chatSend",
          path: "world.beforeEvents.chatSend",
          props: seedProps(eventProps(meta, "world.beforeEvents.chatSend"), {
            message: "hello",
            cancel: false,
          }),
        },
        call: {
          kind: "call",
          title: "sendMessage",
          detail: "?.sendMessage(0)",
          method: "sendMessage",
          argsJson: '["hello"]',
        },
        tick: { kind: "tick", title: "Tick ×1", detail: "n = 1", n: 1 },
        assert: {
          kind: "assert",
          assertKind: "log",
          title: "日志包含",
          detail: "ok",
          pattern: "ok",
        },
        note: { kind: "note", title: "注释", detail: "…" },
      };
      setNodes((ns) => [
        ...ns,
        {
          id,
          type: "stimulus",
          position: { x: 100 + Math.random() * 60, y: 40 + Math.random() * 60 },
          data: defaults[kind],
        },
      ]);
      selectGraphNode(id);
    },
    [meta, pushHistory, selectGraphNode, setNodes]
  );

  /** 从已订阅事件插入 Emit 节点草稿 */
  const addEmitFromSubscribed = useCallback(
    (eventPath: string) => {
      pushHistory();
      const id = `n${Date.now()}`;
      const short = eventPath.split(".").pop() ?? eventPath;
      setNodes((ns) => [
        ...ns,
        {
          id,
          type: "stimulus",
          position: { x: 120 + Math.random() * 40, y: 60 + Math.random() * 40 },
          data: {
            kind: "emit",
            title: short,
            detail: eventPath,
            path: eventPath,
            props: seedProps(eventProps(meta, eventPath), {}),
          },
        },
      ]);
      selectGraphNode(id);
      appendLog(`[insert] Emit ← subscribed ${eventPath}`);
    },
    [appendLog, meta, pushHistory, selectGraphNode, setNodes]
  );

  const saveScript = useCallback(() => {
    const script = buildScript(nodes, edges);
    writeScriptToWebviewState(script);
    vscodeApi().postMessage({ cmd: "saveScript", script });
    appendLog("[script] 已请求保存");
  }, [appendLog, edges, nodes]);

  const openScript = useCallback(() => {
    vscodeApi().postMessage({ cmd: "openScript" });
  }, []);

  /** 仅重置沙箱世界，不清空图 */
  const resetScene = useCallback(() => {
    if (busy) return;
    setReady(false);
    setStatus("重置中…");
    vscodeApi().postMessage({ cmd: "reset" });
  }, [busy]);

  /** 清空剧本（与「重置场景」分离）；可撤回，随后自动保存空图 */
  const clearScript = useCallback(() => {
    if (!window.confirm("清空当前剧本图？此操作可撤回；自动保存会写入空剧本。")) return;
    pushHistory();
    setNodes([]);
    setEdges([]);
    selectGraphNode(null);
    setSelectedEdgeId(null);
    appendLog("[script] 已清空剧本");
  }, [appendLog, pushHistory, selectGraphNode, setEdges, setNodes]);

  const deleteNodesByIds = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      pushHistory();
      const drop = new Set(ids);
      setNodes((ns) => ns.filter((n) => !drop.has(n.id)));
      setEdges((es) => es.filter((e) => !drop.has(e.source) && !drop.has(e.target)));
      if (selectedId && drop.has(selectedId)) setSelectedId(null);
      appendLog(`[edit] 删除节点 ${ids.join(", ")}`);
    },
    [appendLog, pushHistory, selectedId, setEdges, setNodes]
  );

  const duplicateNode = useCallback(
    (id: string) => {
      const src = nodes.find((n) => n.id === id);
      if (!src) return;
      pushHistory();
      const nid = `n${Date.now()}`;
      setNodes((ns) => [
        ...ns,
        {
          ...src,
          id: nid,
          position: { x: src.position.x + 40, y: src.position.y + 40 },
          selected: false,
          data: { ...src.data, runState: "idle" },
        },
      ]);
      appendLog(`[edit] 复制节点 → ${nid}`);
      selectGraphNode(nid);
    },
    [appendLog, nodes, pushHistory, selectGraphNode, setNodes]
  );

  const hotkeys = useRef({
    run,
    saveScript,
    openScript,
    resetScene,
    clearScript,
    addNode,
    duplicateNode,
    deleteNodesByIds,
    undo,
    redo,
    selectedId,
    busy,
    ready,
  });
  hotkeys.current = {
    run,
    saveScript,
    openScript,
    resetScene,
    clearScript,
    addNode,
    duplicateNode,
    deleteNodesByIds,
    undo,
    redo,
    selectedId,
    busy,
    ready,
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setHotkeysOpen(false);
        return;
      }
      if (isTypingTarget(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      const h = hotkeys.current;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

      if (!mod && !e.shiftKey && !e.altKey && key === "?") {
        e.preventDefault();
        setHotkeysOpen(true);
        return;
      }
      if (mod && key === "z" && !e.shiftKey) {
        e.preventDefault();
        h.undo();
        return;
      }
      if (mod && (key === "y" || (key === "z" && e.shiftKey))) {
        e.preventDefault();
        h.redo();
        return;
      }
      if (mod && key === "s") {
        e.preventDefault();
        h.saveScript();
        return;
      }
      if (mod && key === "o") {
        e.preventDefault();
        h.openScript();
        return;
      }
      if (mod && key === "d") {
        e.preventDefault();
        if (h.selectedId) h.duplicateNode(h.selectedId);
        return;
      }
      if (mod && e.shiftKey && key === "r") {
        e.preventDefault();
        h.resetScene();
        return;
      }
      if (key === "F5" && !mod && !e.shiftKey) {
        e.preventDefault();
        void h.run("graph");
        return;
      }
      if (key === "F5" && mod && !e.shiftKey) {
        e.preventDefault();
        void h.run("from");
        return;
      }
      if (mod && key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void h.run("only");
        return;
      }
      if (mod && !e.shiftKey && key >= "1" && key <= "8") {
        e.preventDefault();
        const kinds: StimulusKind[] = [
          "player",
          "entity",
          "item",
          "emit",
          "call",
          "tick",
          "assert",
          "note",
        ];
        h.addNode(kinds[Number(key) - 1]!);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const eventPaths = meta ? Object.keys(meta.eventTypes).sort() : [];
  const chrome = useCanvasChrome();
  const canRun = ready && !busy;
  const playerFields = useMemo(() => playerCreateProps(meta), [meta]);
  const entityFields = useMemo(() => entityCreateProps(meta), [meta]);
  const itemFields = useMemo(() => itemCreateProps(meta), [meta]);
  const emitFields = useMemo(() => {
    if (!selected || selected.data.kind !== "emit") return [];
    return eventProps(meta, selected.data.path ?? "");
  }, [meta, selected]);
  const sceneFields = useMemo(() => {
    if (!inspect) return [];
    return meta?.classes[inspect.kind]?.properties ?? [];
  }, [inspect, meta]);

  const panelTitle: Record<PanelId, string> = {
    tools: "工具",
    props: "属性",
    fixture: "夹具",
  };

  const dockOrder: PanelId[] = ["tools", "props", "fixture"];

  const renderDocked = (id: PanelId) => (
    <DockPanel
      key={id}
      title={panelTitle[id]}
      layout={prefs.panels[id]}
      onChange={(patch) => setPanel(id, patch)}
    >
      {id === "tools" ? (
        <div className="tools-stack">
          <div className="insert-toolbar">
            <div className="insert-toolbar-label">插入</div>
            <div className="insert-grid">
              {INSERT_ITEMS.map(([kind, title, num]) => (
                <button
                  key={kind}
                  type="button"
                  className="insert-chip"
                  data-kind={kind}
                  title={`${title}（${MOD}+${num}）`}
                  onClick={() => addNode(kind)}
                >
                  <span className="dot" />
                  <span>{title}</span>
                </button>
              ))}
            </div>
          </div>
          <SceneDock
            scene={scene}
            selectedId={sideFocus === "scene" ? sceneObjectId : null}
            onSelect={(oid) => void selectSceneObject(oid)}
          />
        </div>
      ) : id === "fixture" ? (
        <FixturePanel
          ready={ready}
          busy={busy}
          moduleBinding={moduleBinding}
          fixture={fixture}
          onApply={applyFixture}
          onClearDb={clearFixtureDb}
          onRefresh={refreshFixture}
        />
      ) : (
        <PropsPanelBody
          meta={meta}
          scene={scene}
          sideFocus={sideFocus}
          selected={selected}
          selectedEdge={selectedEdge}
          inspect={inspect}
          eventPaths={eventPaths}
          playerFields={playerFields}
          entityFields={entityFields}
          itemFields={itemFields}
          emitFields={emitFields}
          sceneFields={sceneFields}
          patchNodeData={patchNodeData}
          patchEdgeLabel={patchEdgeLabel}
          patchEdgeKind={patchEdgeKind}
          deleteNodesByIds={deleteNodesByIds}
          deleteEdgesByIds={deleteEdgesByIds}
        />
      )}
    </DockPanel>
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <span className="brand">脚本沙箱</span>
        <span className="muted text-xs">sapi-sandbox</span>
        <nav className="menubar" aria-label="主菜单">
          <TopMenu label="文件">
            <DropdownMenu.Item className="rdx-item" onSelect={openScript}>
              <span className="rdx-item-main">打开沙箱脚本…</span>
              <MenuKbd>{MOD}+O</MenuKbd>
            </DropdownMenu.Item>
            <DropdownMenu.Item className="rdx-item" onSelect={saveScript}>
              <span className="rdx-item-main">保存沙箱脚本…</span>
              <MenuKbd>{MOD}+S</MenuKbd>
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="rdx-sep" />
            <DropdownMenu.Item className="rdx-item" onSelect={() => setHotkeysOpen(true)}>
              <span className="rdx-item-main">快捷键…</span>
              <MenuKbd>?</MenuKbd>
            </DropdownMenu.Item>
          </TopMenu>
          <TopMenu label="编辑">
            <DropdownMenu.Item className="rdx-item" disabled={!canUndo} onSelect={undo}>
              <span className="rdx-item-main">撤回</span>
              <MenuKbd>{MOD}+Z</MenuKbd>
            </DropdownMenu.Item>
            <DropdownMenu.Item className="rdx-item" disabled={!canRedo} onSelect={redo}>
              <span className="rdx-item-main">重做</span>
              <MenuKbd>{MOD}+Y</MenuKbd>
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="rdx-sep" />
            <DropdownMenu.Item
              className="rdx-item"
              disabled={!selectedId}
              onSelect={() => selectedId && duplicateNode(selectedId)}
            >
              <span className="rdx-item-main">复制节点</span>
              <MenuKbd>{MOD}+D</MenuKbd>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className="rdx-item danger"
              disabled={!selectedId}
              onSelect={() => selectedId && deleteNodesByIds([selectedId])}
            >
              <span className="rdx-item-main">删除节点</span>
              <MenuKbd>Del</MenuKbd>
            </DropdownMenu.Item>
          </TopMenu>
          <TopMenu label="视图">
            <DropdownMenu.Item className="rdx-item" onSelect={() => togglePanel("tools")}>
              <span className="rdx-item-main">
                {prefs.panels.tools.visible ? "隐藏" : "显示"}工具
              </span>
            </DropdownMenu.Item>
            <DropdownMenu.Item className="rdx-item" onSelect={() => togglePanel("props")}>
              <span className="rdx-item-main">
                {prefs.panels.props.visible ? "隐藏" : "显示"}属性
              </span>
            </DropdownMenu.Item>
            <DropdownMenu.Item className="rdx-item" onSelect={() => togglePanel("fixture")}>
              <span className="rdx-item-main">
                {prefs.panels.fixture.visible ? "隐藏" : "显示"}夹具
              </span>
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="rdx-sep" />
            <DropdownMenu.Item className="rdx-item" onSelect={resetLayout}>
              <span className="rdx-item-main">复位面板布局</span>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className="rdx-item"
              onSelect={() => vscodeApi().postMessage({ cmd: "showOutput" })}
            >
              <span className="rdx-item-main">打开 Output 日志</span>
            </DropdownMenu.Item>
          </TopMenu>
          <TopMenu label="插入">
            <InsertMenuItems onInsert={addNode} />
            {(moduleBinding.subscribedEvents?.length ?? 0) > 0 ? (
              <>
                <DropdownMenu.Separator className="rdx-sep" />
                <DropdownMenu.Label className="rdx-label">已订阅事件 → Emit</DropdownMenu.Label>
                {(moduleBinding.subscribedEvents ?? []).slice(0, 12).map((e) => (
                  <DropdownMenu.Item
                    key={e.path}
                    className="rdx-item"
                    onSelect={() => addEmitFromSubscribed(e.path)}
                  >
                    <span className="rdx-item-main">
                      {e.path.split(".").pop()}
                      <span className="sub">×{e.listeners}</span>
                    </span>
                  </DropdownMenu.Item>
                ))}
              </>
            ) : null}
          </TopMenu>
          <TopMenu label="运行" disabled={!canRun && !busy}>
            <DropdownMenu.Item
              className="rdx-item"
              disabled={!canRun}
              onSelect={() => void run("graph")}
            >
              <span className="rdx-item-main">
                运行整图
                <span className="sub">拓扑序</span>
              </span>
              <MenuKbd>F5</MenuKbd>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className="rdx-item"
              disabled={!canRun || !selectedId}
              onSelect={() => void run("from")}
            >
              <span className="rdx-item-main">
                从选中运行
                <span className="sub">路径重试</span>
              </span>
              <MenuKbd>{MOD}+F5</MenuKbd>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className="rdx-item"
              disabled={!canRun || !selectedId}
              onSelect={() => void run("only")}
            >
              <span className="rdx-item-main">
                仅运行选中
                <span className="sub">单步</span>
              </span>
              <MenuKbd>{MOD}+Enter</MenuKbd>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className="rdx-item"
              disabled={!canRun || !selectedEdgeId}
              onSelect={() => selectedEdgeId && runUpstreamFromEdge(selectedEdgeId)}
            >
              <span className="rdx-item-main">
                运行上游
                <span className="sub">选中边 · 到 source</span>
              </span>
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="rdx-sep" />
            <DropdownMenu.Item className="rdx-item" disabled={busy} onSelect={resetScene}>
              <span className="rdx-item-main">重置场景</span>
              <MenuKbd>{MOD}+Shift+R</MenuKbd>
            </DropdownMenu.Item>
          </TopMenu>
        </nav>
        <button type="button" className="btn" disabled={!canRun} onClick={() => void run("graph")}>
          运行整图
        </button>
        <button type="button" className="btn-secondary" disabled={busy} onClick={resetScene}>
          重置
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={!failedNodeId}
          title="选中失败节点并 fitView"
          onClick={locateFailedNode}
        >
          定位失败
        </button>
        <button
          type="button"
          className="btn-secondary hotkeys-help-btn"
          title="快捷键"
          aria-label="快捷键"
          onClick={() => setHotkeysOpen(true)}
        >
          <Codicon name="question" />
        </button>
        <span className="grow" />
        <div
          className="module-chip"
          title={[
            moduleBinding.moduleRoot ?? "(engine only)",
            moduleBinding.eventNote,
            (moduleBinding.subscribedEvents ?? [])
              .map((e) => `${e.path}×${e.listeners}`)
              .join(", "),
          ]
            .filter(Boolean)
            .join("\n")}
        >
          <span className="module-chip-label">当前模块</span>
          <span className="module-chip-id">
            {moduleBinding.id ?? (moduleBinding.status === "pending" ? "…" : "engine")}
            {moduleBinding.version ? (
              <span className="muted">@{moduleBinding.version}</span>
            ) : null}
          </span>
          <span className="module-chip-status">
            {moduleBinding.status === "loaded"
              ? moduleBinding.enabled === false
                ? "已装·未启用"
                : "已装载"
              : moduleBinding.status === "pending"
                ? "装载中"
                : "仅引擎"}
          </span>
          {moduleBinding.moduleRoot && moduleBinding.moduleRoot !== "(engine only)" ? (
            <span className="module-chip-path muted">
              {moduleBinding.moduleRoot.replace(/\\/g, "/").split("/").slice(-2).join("/")}
            </span>
          ) : null}
        </div>
        <span className="badge">{status}</span>
      </header>

      <div className="workspace">
        {dockOrder.some((id) => prefs.panels[id].visible && prefs.panels[id].dock === "left") ? (
          <>
            <div className="dock-column" style={{ width: prefs.leftWidth }}>
              {dockOrder
                .filter((id) => prefs.panels[id].visible && prefs.panels[id].dock === "left")
                .map((id) => renderDocked(id))}
            </div>
            <div
              className="splitter"
              role="separator"
              onMouseDown={(e) => {
                e.preventDefault();
                const startX = e.clientX;
                const startW = prefs.leftWidth;
                const onMove = (ev: MouseEvent) => {
                  setDockWidth("left", Math.min(420, Math.max(160, startW + (ev.clientX - startX))));
                };
                const onUp = () => {
                  window.removeEventListener("mousemove", onMove);
                  window.removeEventListener("mouseup", onUp);
                };
                window.addEventListener("mousemove", onMove);
                window.addEventListener("mouseup", onUp);
              }}
            />
          </>
        ) : null}

        <div className="canvas-wrap">
          <ReactFlow
            nodes={nodes}
            edges={flowEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onReconnect={onReconnect}
            edgesReconnectable
            onInit={(inst) => {
              rfRef.current = inst;
            }}
            onNodeDragStart={() => pushHistory()}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode={["Backspace", "Delete"]}
            defaultEdgeOptions={{
              labelStyle: { fill: "var(--vs-muted)", fontSize: 11 },
              labelBgStyle: { fill: "var(--vs-side)" },
              labelBgPadding: [4, 2] as [number, number],
              labelBgBorderRadius: 2,
            }}
            onNodeContextMenu={(e, node) => {
              e.preventDefault();
              selectGraphNode(node.id);
              setCtxMenu({ x: e.clientX, y: e.clientY, nodeId: node.id, edgeId: null });
            }}
            onEdgeContextMenu={(e, edge) => {
              e.preventDefault();
              selectGraphEdge(edge.id);
              setCtxMenu({ x: e.clientX, y: e.clientY, nodeId: null, edgeId: edge.id });
            }}
            onPaneContextMenu={(e) => {
              e.preventDefault();
              setCtxMenu({ x: e.clientX, y: e.clientY, nodeId: null, edgeId: null });
            }}
            onSelectionChange={({ nodes: sel, edges: selEdges }) => {
              if (sel[0]) selectGraphNode(sel[0].id);
              else if (selEdges[0]) selectGraphEdge(selEdges[0].id);
            }}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={18} size={1} color={chrome.dot} />
            <Controls />
            <MiniMap
              pannable
              zoomable
              style={{ background: chrome.minimapBg }}
              maskColor={chrome.mask}
              nodeColor={(n) => {
                const k = (n.data as StimulusNodeData | undefined)?.kind;
                return (k && KIND_MINIMAP[k]) || "#808080";
              }}
            />
          </ReactFlow>
          {dockOrder
            .filter((id) => prefs.panels[id].visible && prefs.panels[id].dock === "float")
            .map((id) => renderDocked(id))}
          {ctxMenu ? (
            <DropdownMenu.Root
              modal={false}
              open
              onOpenChange={(open) => {
                if (!open) setCtxMenu(null);
              }}
            >
              <DropdownMenu.Trigger asChild>
                <span className="ctx-anchor" style={{ left: ctxMenu.x, top: ctxMenu.y }} />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className="rdx-content" sideOffset={2} align="start">
                  {ctxMenu.edgeId ? (
                    <>
                      <DropdownMenu.Item
                        className="rdx-item"
                        disabled={!canRun}
                        onSelect={() => runUpstreamFromEdge(ctxMenu.edgeId!)}
                      >
                        <span className="rdx-item-main">
                          运行上游
                          <span className="sub">含 source，不含 target</span>
                        </span>
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        className="rdx-item"
                        disabled={!canRun}
                        onSelect={() => runUpstreamFromEdge(ctxMenu.edgeId!)}
                      >
                        <span className="rdx-item-main">
                          运行到此边前
                          <span className="sub">同运行上游</span>
                        </span>
                      </DropdownMenu.Item>
                      <DropdownMenu.Separator className="rdx-sep" />
                      <DropdownMenu.Item
                        className="rdx-item"
                        onSelect={() => patchEdgeKind(ctxMenu.edgeId!, "pass")}
                      >
                        <span className="rdx-item-main">
                          设为通过边
                          <span className="sub">断言成功走此边</span>
                        </span>
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        className="rdx-item"
                        onSelect={() => patchEdgeKind(ctxMenu.edgeId!, "fail")}
                      >
                        <span className="rdx-item-main">
                          设为失败边
                          <span className="sub">断言失败走此边</span>
                        </span>
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        className="rdx-item"
                        onSelect={() => {
                          const id = ctxMenu.edgeId!;
                          selectGraphEdge(id);
                          const cur = String(
                            (edges.find((e) => e.id === id)?.data as { note?: string } | undefined)
                              ?.note ?? ""
                          ).trim();
                          const next = window.prompt("边备注（空则清除）", cur);
                          if (next == null) return;
                          patchEdgeLabel(id, next);
                        }}
                      >
                        <span className="rdx-item-main">编辑备注</span>
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        className="rdx-item"
                        onSelect={() => {
                          selectGraphEdge(ctxMenu.edgeId!);
                          setStatus("拖动边终点到目标节点以重新连接");
                          appendLog("[edit] 拖动边的端点到新节点即可换连（可撤回）");
                        }}
                      >
                        <span className="rdx-item-main">
                          重新连接到…
                          <span className="sub">拖终点换节点</span>
                        </span>
                      </DropdownMenu.Item>
                      <DropdownMenu.Separator className="rdx-sep" />
                      <DropdownMenu.Item
                        className="rdx-item danger"
                        onSelect={() => deleteEdgesByIds([ctxMenu.edgeId!])}
                      >
                        <span className="rdx-item-main">删除边</span>
                        <MenuKbd>Del</MenuKbd>
                      </DropdownMenu.Item>
                    </>
                  ) : (
                    <>
                      <InsertSubmenu onInsert={addNode} />
                      <DropdownMenu.Separator className="rdx-sep" />
                      {ctxMenu.nodeId ? (
                        <>
                          <DropdownMenu.Item
                            className="rdx-item"
                            disabled={!canRun}
                            onSelect={() => {
                              setSelectedId(ctxMenu.nodeId);
                              void run("only", ctxMenu.nodeId);
                            }}
                          >
                            <span className="rdx-item-main">仅运行此节点</span>
                            <MenuKbd>{MOD}+Enter</MenuKbd>
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className="rdx-item"
                            disabled={!canRun}
                            onSelect={() => {
                              setSelectedId(ctxMenu.nodeId);
                              void run("from", ctxMenu.nodeId);
                            }}
                          >
                            <span className="rdx-item-main">从此处运行</span>
                            <MenuKbd>{MOD}+F5</MenuKbd>
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className="rdx-item"
                            onSelect={() => duplicateNode(ctxMenu.nodeId!)}
                          >
                            <span className="rdx-item-main">复制节点</span>
                            <MenuKbd>{MOD}+D</MenuKbd>
                          </DropdownMenu.Item>
                          <DropdownMenu.Separator className="rdx-sep" />
                          <DropdownMenu.Item
                            className="rdx-item danger"
                            onSelect={() => deleteNodesByIds([ctxMenu.nodeId!])}
                          >
                            <span className="rdx-item-main">删除</span>
                            <MenuKbd>Del</MenuKbd>
                          </DropdownMenu.Item>
                        </>
                      ) : (
                        <DropdownMenu.Item
                          className="rdx-item danger"
                          disabled={!selectedId && !selectedEdgeId}
                          onSelect={() => {
                            if (selectedEdgeId) deleteEdgesByIds([selectedEdgeId]);
                            else if (selectedId) deleteNodesByIds([selectedId]);
                          }}
                        >
                          <span className="rdx-item-main">
                            {selectedEdgeId ? "删除选中边" : "删除选中节点"}
                          </span>
                          <MenuKbd>Del</MenuKbd>
                        </DropdownMenu.Item>
                      )}
                    </>
                  )}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          ) : null}
        </div>

        {dockOrder.some((id) => prefs.panels[id].visible && prefs.panels[id].dock === "right") ? (
          <>
            <div
              className="splitter"
              role="separator"
              onMouseDown={(e) => {
                e.preventDefault();
                const startX = e.clientX;
                const startW = prefs.rightWidth;
                const onMove = (ev: MouseEvent) => {
                  setDockWidth("right", Math.min(560, Math.max(220, startW - (ev.clientX - startX))));
                };
                const onUp = () => {
                  window.removeEventListener("mousemove", onMove);
                  window.removeEventListener("mouseup", onUp);
                };
                window.addEventListener("mousemove", onMove);
                window.addEventListener("mouseup", onUp);
              }}
            />
            <div className="dock-column" style={{ width: prefs.rightWidth }}>
              {dockOrder
                .filter((id) => prefs.panels[id].visible && prefs.panels[id].dock === "right")
                .map((id) => renderDocked(id))}
            </div>
          </>
        ) : null}
      </div>

      {hotkeysOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setHotkeysOpen(false);
          }}
        >
          <div className="modal-dialog" role="dialog" aria-labelledby="hotkeys-title" aria-modal="true">
            <div className="modal-header">
              <h2 id="hotkeys-title">快捷键</h2>
              <button
                type="button"
                className="dock-icon-btn"
                aria-label="关闭"
                title="关闭"
                onClick={() => setHotkeysOpen(false)}
              >
                <Codicon name="close" />
              </button>
            </div>
            <ScrollArea className="modal-body" viewportClassName="modal-body-pad">
              <HotkeysPanelBody mod={MOD} />
            </ScrollArea>
          </div>
        </div>
      ) : null}
    </div>
  );
}
