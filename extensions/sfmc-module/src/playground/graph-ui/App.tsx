import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  reconnectEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type NodeTypes,
  type ReactFlowInstance,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  assertInspectIds,
  assertTitle,
  evaluateAssert,
  formatAssertDetail,
  migrateAssertConfig,
  normalizeAssertKind,
} from "../graph/assert";
import { exprTruthy, resolveExpr } from "../graph/expr";
import {
  formatLogLineWithNode,
  pushLogEvent,
  type StructuredLogEvent,
  type StructuredLogLevel,
} from "../graph/logBuffer";
import {
  bindCreateObjectId,
  clearCreateObjectIds,
  createApiKind,
  createPayloadForKind,
  isCreateStimulusKind,
  preferredEntityObjectId,
  preferredItemObjectId,
  preferredPlayerObjectId,
  preferredScoreboardObjectId,
  type CreateStimulusKind,
} from "../graph/materialize";
import {
  hasFailOutEdges,
  normalizeEdgeKind,
  orderAssertBranch,
  orderNodes,
  sliceControlBody,
  type EdgeKind,
  type RunMode,
} from "../graph/order";
import { Codicon } from "./Codicon";
import { DockPanel } from "./DockPanel";
import { matchesEventLogFilter } from "./EventLogNode";
import { FixturePanel, type FixtureSnapshot } from "./FixturePanel";
import { FrameNode } from "./FrameNode";
import { LoadedPanel } from "./LoadedPanel";
import { NodePalette } from "./NodePalette";
import { HotkeysPanelBody, PropsPanelBody } from "./PropsPanelBody";
import { SceneDock } from "./SceneDock";
import { ScrollArea } from "./ScrollArea";
import {
  NODE_COLOR_PRESETS,
  StimulusNode,
  clipRunSummary,
  formatCallDetail,
  nodeColor,
  type StimulusFlowNode,
  type StimulusKind,
  type StimulusNodeData,
} from "./StimulusNode";
import { ViewerNode } from "./ViewerNode";
import { useGraphHistory, useLayoutPrefs, type PanelId } from "./layoutPrefs";
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
import { vscodeApi } from "./vscodeApi";

type Meta = PlaygroundMeta;

/** 迷你聊天行：玩家说 / 系统对玩家说。最多保留 N 条（默认 50）。 */
type ChatLine = {
  t: number;
  /** "say"：玩家在 QQ/MC 说；"system"：host（系统 / 模块）对该玩家发。 */
  direction: "say" | "system";
  text: string;
};

const CHAT_BUFFER_MAX = 50;

const nodeTypes: NodeTypes = { stimulus: StimulusNode, frame: FrameNode, viewer: ViewerNode };

const KIND_MINIMAP: Record<StimulusKind, string> = {
  player: "#4ec9b0",
  entity: "#569cd6",
  item: "#ce9178",
  scoreboard: "#d7ba7d",
  emit: "#569cd6",
  call: "#4fc1ff",
  tick: "#dcdcaa",
  assert: "#ce9178",
  branch: "#c586c0",
  repeat: "#b5cea8",
  frame: "#808080",
  viewer: "#4fc1ff",
  eventlog: "#808080",
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

const INSERT_ITEMS: readonly (readonly [StimulusKind, string, string])[] = [
  ["player", "Player", "1"],
  ["entity", "Entity", "2"],
  ["item", "ItemStack", "3"],
  ["scoreboard", "Scoreboard", "4"],
  ["emit", "Emit", "5"],
  ["call", "Call", "6"],
  ["tick", "Tick", "7"],
  ["assert", "断言", "8"],
  ["branch", "Branch", "B"],
  ["repeat", "Repeat", "R"],
  ["frame", "Frame", "F"],
  ["viewer", "Viewer", "V"],
  ["note", "注释", "N"],
];

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

function TopMenu({ label, children, disabled }: { label: string; children: ReactNode; disabled?: boolean }) {
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
  const {
    push: pushHistory,
    pushBurst,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useGraphHistory(nodes, edges, setNodes, setEdges);
  const { prefs, setPanel, togglePanel, setDockWidth, resetLayout } = useLayoutPrefs();
  const [selectedId, setSelectedId] = useState<string | null>(() => bootGraph.nodes[0]?.id ?? null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [status, setStatus] = useState("装载沙箱…");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [scene, setScene] = useState<SceneSummary | null>(null);
  const [moduleBinding, setModuleBinding] = useState<ModuleBinding>(() => ({
    moduleRoot: typeof document !== "undefined" ? (document.body.dataset.module ?? null) : null,
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
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [fixture, setFixture] = useState<FixtureSnapshot | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    nodeId: string | null;
    edgeId: string | null;
  } | null>(null);
  const pending = useMemo(() => new Map<string, Pending>(), []);
  /** 结构化静默缓冲（断言）；展示走 VS Code Output */
  const logEventsRef = useRef<StructuredLogEvent[]>([
    {
      t: Date.now(),
      level: "info",
      source: "sandbox",
      text: "脚本沙箱 · sapi-sandbox",
    },
  ]);
  const logChannelsRef = useRef(new Map<StructuredLogEvent, string>());
  const eventLogListenersRef = useRef(new Set<(event: StructuredLogEvent) => void>());
  const runSeqRef = useRef(0);
  const currentRunIdRef = useRef<number | undefined>(undefined);
  const lastFailedNodeIdRef = useRef<string | null>(null);
  /**
   * 模块入口 source map（symbol → { file, line, column }）。
   * boot 完成后由扩展侧 PlaygroundPanel 算出并 postMessage 传入；缺省时按空 Map 兜底，UI ⓘ 仍显示失败 message。
   */
  const sourceMapRef = useRef<Map<string, { file: string; line: number; column?: number }>>(new Map());
  /**
   * 上一次 Call 节点的 (id, method)：后续 assert 失败时 evaluateAssert 据此在 sourceMap 反查 @cmd.<method>。
   * 仅在断言求值时透传，不影响 @lastCall 表达式语义。
   */
  useEffect(() => {
    if (!busy) return;
    const listeners = new Map<string, (event: StructuredLogEvent) => void>();
    const refresh = (node: StimulusFlowNode) => {
      if (node.data.kind !== "eventlog") return;
      const maxEntries = Math.max(1, Math.floor(node.data.eventlogMaxEntries ?? 50));
      const snapshot = logEventsRef.current
        .filter((event) => matchesEventLogFilter(event, logChannelsRef.current.get(event), node.data))
        .slice(-maxEntries);
      setNodes((current) =>
        current.map((item) =>
          item.id === node.id ? { ...item, data: { ...item.data, eventlogSnapshot: snapshot } } : item
        )
      );
    };
    for (const node of nodesRef.current) {
      if (node.data.kind !== "eventlog") continue;
      refresh(node);
      const listener = () => refresh(node);
      listeners.set(node.id, listener);
      eventLogListenersRef.current.add(listener);
    }
    return () => {
      for (const listener of listeners.values()) eventLogListenersRef.current.delete(listener);
    };
  }, [busy, setNodes]);
  const lastCallContextRef = useRef<{ id?: string; method?: string }>({});

  /** 跑图期 Call 返回值袋：name → snapshot。@out.<name>[.prop] 解析时按 bag 直接下钻。 */
  const outRef = useRef<Record<string, unknown>>({});
  /** 跑图期 inspect 出来的对象快照袋（与原 refs 等价；key=object id）。 */
  const refsRef = useRef<Record<string, { id: string; kind: string; props: Record<string, unknown> }>>({});
  /** 玩家路由的迷你聊天日志（playerName → 行序列）。host log channel=msg 解析后追加。 */
  const chatByPlayerRef = useRef<Record<string, ChatLine[]>>({});
  const [, bumpChatVersion] = useState(0);

  const selected = useMemo(() => nodes.find((n) => n.id === selectedId) ?? null, [nodes, selectedId]);
  const selectedEdge = useMemo(() => edges.find((e) => e.id === selectedEdgeId) ?? null, [edges, selectedEdgeId]);
  const flowEdges = useMemo(() => decorateFlowEdges(edges, nodes), [edges, nodes]);
  const failedNodeId = useMemo(
    () => nodes.find((n) => n.data.runState === "failed")?.id ?? lastFailedNodeIdRef.current,
    [nodes]
  );

  const appendLog = useCallback(
    (line: string, level: StructuredLogLevel = "info", meta?: { nodeId?: string; source?: string }) => {
      const nodeId = meta?.nodeId;
      const source = meta?.source?.trim() || "sandbox";
      const text = formatLogLineWithNode(line, nodeId);
      const ev: StructuredLogEvent = {
        t: Date.now(),
        level,
        source,
        text,
        ...(nodeId ? { nodeId } : {}),
        ...(currentRunIdRef.current != null ? { runId: currentRunIdRef.current } : {}),
      };
      logEventsRef.current = pushLogEvent(logEventsRef.current, ev, 500);
      logChannelsRef.current.set(ev, "system");
      eventLogListenersRef.current.forEach((listener) => listener(ev));
      vscodeApi().postMessage({
        cmd: "uiLog",
        text,
        level,
        source,
        ...(nodeId ? { nodeId } : {}),
        ...(ev.runId != null ? { runId: ev.runId } : {}),
      });
    },
    []
  );

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
      if (summary.moduleBinding) {
        setModuleBinding(summary.moduleBinding);
      }
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
   * 将图上未实例化的 Player / Entity / ItemStack / Scoreboard 节点 objects.create 进 registry，并回写 objectId。
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
        const source =
          typeof msg.payload.source === "string" && msg.payload.source.trim()
            ? String(msg.payload.source).trim()
            : msg.payload.channel === "module" || msg.payload.channel === "msg"
              ? "module"
              : "playground";
        const rawLv = String(msg.payload.level ?? "info");
        const level: StructuredLogLevel =
          rawLv === "error" || rawLv === "warn" || rawLv === "debug" || rawLv === "success" ? rawLv : "info";
        const event: StructuredLogEvent = {
          t: Date.now(),
          level,
          source,
          text,
          ...(currentRunIdRef.current != null ? { runId: currentRunIdRef.current } : {}),
        };
        logEventsRef.current = pushLogEvent(logEventsRef.current, event, 500);
        logChannelsRef.current.set(
          event,
          msg.payload.channel === "module" ? "module" : msg.payload.channel === "msg" ? "player" : "system"
        );
        eventLogListenersRef.current.forEach((listener) => listener(event));
        // 玩家路由的迷你聊天：msg 通道前缀为 "[Msg] <player>: <text>"。解析后落到该玩家桶。
        if (msg.payload.channel === "msg") {
          const m = /^\[Msg\]\s+([^:]+):\s*(.*)$/.exec(text);
          if (m) {
            const playerName = m[1]!.trim();
            const chatText = m[2] ?? "";
            const bag = chatByPlayerRef.current;
            const list = bag[playerName] ?? [];
            list.push({ t: Date.now(), direction: "system", text: chatText });
            bag[playerName] = list.length > CHAT_BUFFER_MAX ? list.slice(list.length - CHAT_BUFFER_MAX) : list;
            bumpChatVersion((x) => x + 1);
          }
        }
        return;
      }
      if (msg.type === "locateNode" && msg.nodeId) {
        const id = String(msg.nodeId);
        if (nodesRef.current.some((n) => n.id === id)) {
          selectGraphNode(id);
          rfRef.current?.fitView({ nodes: [{ id }], padding: 0.45, duration: 280 });
          setStatus(`已定位节点 ${id}`);
        } else {
          appendLog(`[run] 找不到节点 ${id}`, "warn");
        }
        return;
      }
      // 扩展侧 postMessage：模块 source map（symbol → file/line/column）。
      // boot 完成后写入；空 entries 表示无 source map（UI ⓘ 仅显示 message，无跳转）。
      if (msg.type === "sourceMap" && msg.entries) {
        const next = new Map<string, { file: string; line: number; column?: number }>();
        const entries = msg.entries as Array<[string, { file: string; line: number; column?: number }]>;
        for (const [k, v] of entries) {
          if (typeof k === "string" && v && typeof v.file === "string" && typeof v.line === "number") {
            next.set(k, v);
          }
        }
        sourceMapRef.current = next;
        appendLog(`[sandbox] 已装载 source map（${next.size} 条 symbol → 源码定位）`, "info");
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
        setStatus("就绪");
        setInspect(null);
        setSceneObjectId(null);
        // host 带 script：跨会话权威；若本轮已从 getState 恢复则跳过，避免覆盖未落盘编辑
        let graphForMaterialize: StimulusFlowNode[] | null = null;
        if (msg.script && Array.isArray(msg.script.nodes) && !skipHostScript.current) {
          graphForMaterialize = applyScript(msg.script as SandboxScript, "[script] 已恢复自动保存的剧本");
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
          appendLog(`[module] subscribed=[${subs.map((e) => `${e.path}×${e.listeners}`).join(", ")}]`);
        }
        if (binding?.bootPhase || binding?.commands || binding?.permissions) {
          appendLog(
            `[module] inventory commands=${binding.commands?.items?.length ?? 0} permissions=${binding.permissions?.items?.length ?? 0} boot=${binding.bootPhase?.summary ?? "?"}`
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
  }, [appendLog, applyScript, materializeCreateNodes, pending, refreshFixture, selectGraphNode, setEdges, setNodes]);

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
      setEdges((eds) => addEdge({ ...c, id: `e-${c.source}-${c.target}`, data: { kind: "pass" as EdgeKind } }, eds));
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
                  // 失败时清掉旧 message；成功时一并清掉（重跑后不再残留上次的 ⓘ）
                  ...(runState !== "failed" ? { lastFailure: undefined } : {}),
                },
              }
            : n
        )
      );
    },
    [setNodes]
  );

  /**
   * 断言失败：把 evaluateAssert 结果钉在节点上，供 StimulusNode 渲染 ⓘ + hover 详情。
   * 携带可选 location（来自 source map 反查），ⓘ 点击后向扩展发 revealInModule。
   */
  const setNodeLastFailure = useCallback(
    (id: string, message: string, location?: { file: string; line: number; column?: number }) => {
      setNodes((ns) =>
        ns.map((n) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  lastFailure: { message, ...(location ? { location } : {}) },
                },
              }
            : n
        )
      );
    },
    [setNodes]
  );

  const locateFailedNode = useCallback(() => {
    const id =
      nodesRef.current.find((n) => n.data.runState === "failed")?.id ?? lastFailedNodeIdRef.current ?? undefined;
    if (!id) {
      appendLog("[run] 无失败节点可定位");
      return;
    }
    selectGraphNode(id);
    rfRef.current?.fitView({ nodes: [{ id }], padding: 0.45, duration: 280 });
    setStatus(`已定位失败节点 ${id}`);
  }, [appendLog, selectGraphNode]);

  const markFailedNode = useCallback((id: string) => {
    lastFailedNodeIdRef.current = id;
    vscodeApi().postMessage({ cmd: "reportFailedNode", nodeId: id });
  }, []);

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
        mode === "graph" ? "运行整图" : mode === "from" ? "从选中运行" : mode === "only" ? "仅运行选中" : "运行上游";
      const runId = ++runSeqRef.current;
      currentRunIdRef.current = runId;
      setStatus(`${label}…`);
      appendLog(`--- run #${runId} start --- mode=${mode} · ${label}`);
      setNodes((ns) =>
        ns.map((n) => ({
          ...n,
          data: {
            ...n.data,
            runState: "idle" as const,
            runSummary: undefined,
            lastFailure: undefined,
            repeatCurrent: undefined,
          },
        }))
      );
      // 重置 Call 上下文：本次 run 不复用上次的 (id, method) 反查 source map。
      lastCallContextRef.current = {};
      // 跑图期上下文：Call 返回值袋 + 已 inspect 对象袋，每次 run 重置
      outRef.current = {};
      refsRef.current = {};

      const graphEdges = edgesRef.current.map((e) => ({
        source: e.source,
        target: e.target,
        kind: normalizeEdgeKind((e.data as { kind?: string } | undefined)?.kind),
      }));
      let order = orderNodes(
        nodesRef.current.map((n) => ({
          id: n.id,
          kind: n.data.kind === "eventlog" ? "viewer" : n.data.kind,
        })),
        graphEdges,
        mode,
        sel
      );

      /** 控制节点（Branch / Repeat）执行时影响外层循环：用「线性序 + controlSubsequence」判定。 */
      const isControl = (cid: string) => {
        const k = nodesRef.current.find((x) => x.id === cid)?.data.kind;
        return k === "branch" || k === "repeat";
      };

      let failed = false;
      let divertedFail = false;
      let failedNode: string | null = null;
      const doneIds = new Set<string>();
      /** Repeat 子图体内轮询期间是否要求终止；避免外部点击「终止循环」时被锁死。 */
      const abortRepeatRef = { current: false };
      for (let i = 0; i < order.length; i++) {
        const id = order[i]!;
        if (doneIds.has(id)) continue;
        const n = nodesRef.current.find((x) => x.id === id);
        if (!n) continue;
        setSelectedId(id);
        setRunState(id, "running");
        appendLog(`[run] → ${n.data.kind} ${n.data.title}`, "info", { nodeId: id });
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
              // 把 create 结果也写进 outRef（玩家/实体/物品默认 out_<nodeId>）
              outRef.current[`out_${id}`] = { id: result.id, kind: createApiKind(stimKind) };
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
              `[emit] ${n.data.path ?? n.data.detail} → ${nListen} listener(s)` + (nErr ? ` · ${nErr} error(s)` : ""),
              nErr ? "warn" : "info",
              { nodeId: id }
            );
            await refreshScene();
            const path = n.data.path ?? n.data.detail ?? "emit";
            setRunState(id, "done", clipRunSummary(`lastEmit · ${path}${nErr ? ` · ${nErr}err` : ""}`));
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
            const callResult = (await request("call", {
              id: n.data.targetId,
              method: n.data.method,
              args,
            })) as { result?: unknown };
            await refreshScene();
            // 把返回值 snapshot 写进 outRef；name 为空 / undefined 时用默认 out_<nodeId>
            const outName = (n.data.outName || "").trim() || `out_${id}`;
            const snap = callResult?.result ?? null;
            outRef.current[outName] = snap;
            // 记下最近一次 Call，断言失败时 evaluateAssert 据此反查 source map。
            lastCallContextRef.current = { id: n.data.targetId, method: n.data.method };
            appendLog(`[call] ${n.data.targetId}.${n.data.method} → out.${outName}=${JSON.stringify(snap)}`, "info", {
              nodeId: id,
            });
            setRunState(id, "done", clipRunSummary(`lastCall · ${n.data.targetId}.${n.data.method} → ${outName}`));
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
            // 收集所需对象 inspect 到 refsRef；先前轮次已 inspect 的复用
            const ids = assertInspectIds({ ...cfg, assertKind });
            for (const oid of ids) {
              if (refsRef.current[oid]) continue;
              try {
                const snap = (await request("inspect", { id: oid })) as {
                  id: string;
                  kind: string;
                  props: Record<string, unknown>;
                };
                refsRef.current[snap.id] = snap;
              } catch {
                /* 缺失由求值报错 */
              }
            }
            const target = cfg.targetId ? (refsRef.current[cfg.targetId] ?? null) : null;
            const result = evaluateAssert(
              { ...cfg, assertKind },
              {
                logs: logEventsRef.current,
                scene: summary,
                target,
                refs: refsRef.current,
                out: outRef.current,
                ...(sourceMapRef.current ? { sourceMap: sourceMapRef.current } : {}),
                ...(lastCallContextRef.current ? { callContext: lastCallContextRef.current } : {}),
              }
            );
            if (!result.ok) {
              setRunState(id, "failed", clipRunSummary(`失败 · ${result.message}`));
              setNodeLastFailure(id, result.message, result.location);
              appendLog(`[assert] 失败: ${result.message}`, "error", { nodeId: id });
              markFailedNode(id);
              failedNode = id;
              doneIds.add(id);
              if (mode !== "only" && hasFailOutEdges(graphEdges, id)) {
                const branch = orderAssertBranch(
                  nodesRef.current.map((x) => ({
                    id: x.id,
                    kind: x.data.kind === "eventlog" ? "viewer" : x.data.kind,
                  })),
                  graphEdges,
                  id,
                  "fail"
                ).filter((nid) => !doneIds.has(nid));
                appendLog(`[assert] 转向失败边 → ${branch.join(" → ") || "(无下游)"}`, "warn", {
                  nodeId: id,
                });
                divertedFail = true;
                order = [...order.slice(0, i + 1), ...branch];
                continue;
              }
              failed = true;
              break;
            }
            appendLog(`[assert] ok: ${result.message}`, "info", { nodeId: id });
            setRunState(id, "done", clipRunSummary(`ok · ${result.message}`));
          } else if (n.data.kind === "branch") {
            const cond = (n.data.branchCond ?? "").trim();
            const summary = (await request("sceneSummary")) as SceneSummary;
            setScene(summary);
            const refs: Record<string, { id: string; kind: string; props: Record<string, unknown> }> = {
              ...refsRef.current,
            };
            // cond 引用 $ / @ 时按表达式求值，否则字面量；空 cond 一律视为 false
            let truthy = false;
            let condError: string | null = null;
            if (cond) {
              const r = resolveExpr(cond, {
                scene: {
                  lastEmit: summary.lastEmit ?? null,
                  lastCall: summary.lastCall ?? null,
                },
                refs,
                out: outRef.current,
              });
              if (!r.ok) {
                condError = r.error;
              } else {
                truthy = exprTruthy(r.value);
              }
            }
            if (condError) {
              setRunState(id, "failed", clipRunSummary(`条件错误 · ${condError}`));
              appendLog(`[branch] 条件错误: ${condError}`, "error", { nodeId: id });
              failed = true;
              failedNode = id;
              markFailedNode(id);
              break;
            }
            const outcome: EdgeKind = truthy ? "pass" : "fail";
            appendLog(`[branch] ${cond || "（空）"} → ${outcome}`, "info", { nodeId: id });
            setRunState(id, "done", clipRunSummary(`${outcome} · ${cond || "（空）"}`));
            // 把对侧支路加入 doneIds（跳），保留同侧支路在 order 中
            const other: EdgeKind = truthy ? "fail" : "pass";
            const otherTargets = new Set(
              graphEdges.filter((e) => e.source === id && e.kind === other).map((e) => e.target)
            );
            for (const tid of otherTargets) {
              const bfs = orderAssertBranch(
                nodesRef.current.map((x) => ({ id: x.id, kind: x.data.kind })),
                graphEdges,
                id,
                other
              );
              for (const b of bfs) doneIds.add(b);
            }
          } else if (n.data.kind === "repeat") {
            const times = Math.max(1, Math.floor(n.data.repeatTimes ?? 1));
            const body = sliceControlBody(order, i, isControl);
            abortRepeatRef.current = false;
            appendLog(`[repeat] 入口 body=${body.length} × ${times}`, "info", { nodeId: id });
            setRunState(id, "running", clipRunSummary(`body×${times}`));
            for (let iter = 1; iter <= times; iter++) {
              if (abortRepeatRef.current) {
                appendLog(`[repeat] 轮次 ${iter} 终止（手动中断）`, "warn", { nodeId: id });
                break;
              }
              setNodes((ns) => ns.map((x) => (x.id === id ? { ...x, data: { ...x.data, repeatCurrent: iter } } : x)));
              for (const bodyId of body) {
                if (doneIds.has(bodyId) || abortRepeatRef.current) continue;
                const subIdx = order.indexOf(bodyId);
                if (subIdx < 0) continue;
                // 复用外层循环逻辑：把控制节点（branch/repeat）也按内联处理。
                // 这里仅调用通用 dispatch — 但通用 dispatch 嵌在 loop 里无法直接复用。
                // 简化：内联执行体节点（不含控制节点）；控制节点再走下一轮外层时处理。
                // 当前 body 已被 sliceControlBody 限定为不含控制节点，所以此处安全。
                // 但 body 内可能含 emit/call/assert/tick/create — 需要各自处理。
                const sub = nodesRef.current.find((x) => x.id === bodyId);
                if (!sub) continue;
                setSelectedId(bodyId);
                setRunState(bodyId, "running");
                appendLog(`[run] ↻ ${iter}/${times} → ${sub.data.kind} ${sub.data.title}`, "info", {
                  nodeId: bodyId,
                });
                try {
                  if (sub.data.kind === "tick") {
                    const ticks = sub.data.n ?? 1;
                    await request("tick", { n: ticks });
                    setRunState(bodyId, "done", clipRunSummary(`ok · ×${ticks}`));
                  } else if (sub.data.kind === "emit") {
                    await request("emit", {
                      path: sub.data.path ?? sub.data.detail,
                      payload: sub.data.props ?? {},
                    });
                    await refreshScene();
                    setRunState(bodyId, "done", clipRunSummary("emit · ok"));
                  } else if (sub.data.kind === "call") {
                    let args: unknown[] = [];
                    try {
                      const parsed = JSON.parse(sub.data.argsJson || "[]");
                      if (!Array.isArray(parsed)) throw new Error("args 须为 JSON 数组");
                      args = parsed;
                    } catch (e) {
                      throw new Error(`Call args JSON 无效: ${e instanceof Error ? e.message : String(e)}`);
                    }
                    if (!sub.data.targetId) throw new Error("Call 未选择目标对象");
                    if (!sub.data.method) throw new Error("Call 未指定 method");
                    const subCallResult = (await request("call", {
                      id: sub.data.targetId,
                      method: sub.data.method,
                      args,
                    })) as { result?: unknown };
                    const outName = (sub.data.outName || "").trim() || `out_${bodyId}`;
                    outRef.current[outName] = subCallResult?.result ?? null;
                    // 记下最近一次 Call，断言失败时 evaluateAssert 据此反查 source map。
                    lastCallContextRef.current = { id: sub.data.targetId, method: sub.data.method };
                    setRunState(
                      bodyId,
                      "done",
                      clipRunSummary(`lastCall · ${sub.data.targetId}.${sub.data.method} → ${outName}`)
                    );
                  } else if (isCreateStimulusKind(sub.data.kind)) {
                    const stimKind = sub.data.kind as CreateStimulusKind;
                    const props = createPayloadForKind(stimKind, sub.data);
                    const wantId = String(props.id);
                    let objectId = sub.data.objectId;
                    if (objectId !== wantId) objectId = undefined;
                    if (!objectId) {
                      const result = (await request("create", {
                        kind: createApiKind(stimKind),
                        props,
                      })) as { id: string; kind: string };
                      objectId = result.id;
                      setNodes((ns) => bindCreateObjectId(ns, bodyId, result.id));
                      outRef.current[`out_${bodyId}`] = {
                        id: result.id,
                        kind: createApiKind(stimKind),
                      };
                    }
                    setRunState(bodyId, "done", clipRunSummary(`ok · ${objectId}`));
                  } else if (sub.data.kind === "assert") {
                    const cfg = migrateAssertConfig(sub.data);
                    const assertKind = normalizeAssertKind(cfg.assertKind);
                    const summary = (await request("sceneSummary")) as SceneSummary;
                    setScene(summary);
                    for (const oid of assertInspectIds({ ...cfg, assertKind })) {
                      if (refsRef.current[oid]) continue;
                      try {
                        const snap = (await request("inspect", { id: oid })) as {
                          id: string;
                          kind: string;
                          props: Record<string, unknown>;
                        };
                        refsRef.current[snap.id] = snap;
                      } catch {
                        /* ignore */
                      }
                    }
                    const target = cfg.targetId ? (refsRef.current[cfg.targetId] ?? null) : null;
                    const r = evaluateAssert(
                      { ...cfg, assertKind },
                      {
                        logs: logEventsRef.current,
                        scene: summary,
                        target,
                        refs: refsRef.current,
                        out: outRef.current,
                        ...(sourceMapRef.current ? { sourceMap: sourceMapRef.current } : {}),
                        ...(lastCallContextRef.current ? { callContext: lastCallContextRef.current } : {}),
                      }
                    );
                    if (!r.ok) {
                      setRunState(bodyId, "failed", clipRunSummary(`失败 · ${r.message}`));
                      setNodeLastFailure(bodyId, r.message, r.location);
                      appendLog(`[assert] 失败: ${r.message}`, "error", { nodeId: bodyId });
                      markFailedNode(bodyId);
                      failedNode = bodyId;
                      failed = true;
                      abortRepeatRef.current = true;
                      break;
                    }
                    setRunState(bodyId, "done", clipRunSummary(`ok · ${r.message}`));
                  } else if (sub.data.kind === "branch") {
                    // body 不应包含控制节点；sliceControlBody 已排除；此处兜底跳过
                    appendLog(`[repeat] 嵌套分支未支持，跳过 ${bodyId}`, "warn", { nodeId: bodyId });
                  } else if (sub.data.kind === "repeat") {
                    appendLog(`[repeat] 嵌套 Repeat 未支持，跳过 ${bodyId}`, "warn", { nodeId: bodyId });
                  } else {
                    setRunState(bodyId, "done", "ok");
                  }
                  doneIds.add(bodyId);
                } catch (e) {
                  const msg = e instanceof Error ? e.message : String(e);
                  setRunState(bodyId, "failed", clipRunSummary(`错误 · ${msg}`));
                  appendLog(`[error] ${msg}`, "error", { nodeId: bodyId });
                  failed = true;
                  failedNode = bodyId;
                  markFailedNode(bodyId);
                  abortRepeatRef.current = true;
                  break;
                }
              }
            }
            setNodes((ns) =>
              ns.map((x) => (x.id === id ? { ...x, data: { ...x.data, repeatCurrent: undefined } } : x))
            );
            setRunState(id, failed ? "failed" : "done", clipRunSummary(`× ${times}`));
            // 把 body 节点都标记 done，避免外层继续走；同时跳过 body
            for (const bodyId of body) doneIds.add(bodyId);
            i += body.length;
            continue;
          } else {
            setRunState(id, "done", "ok");
          }
          doneIds.add(id);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          setRunState(id, "failed", clipRunSummary(`错误 · ${msg}`));
          appendLog(`[error] ${msg}`, "error", { nodeId: id });
          failed = true;
          failedNode = id;
          markFailedNode(id);
          break;
        }
      }
      for (const viewer of nodesRef.current.filter((x) => x.data.kind === "viewer")) {
        try {
          const summary = (await request("sceneSummary")) as SceneSummary;
          const rawRef = (viewer.data.targetRef ?? "").trim();
          let objectId = rawRef;
          if (rawRef.startsWith("@out.")) {
            const resolved = resolveExpr(rawRef, {
              scene: { lastEmit: summary.lastEmit, lastCall: summary.lastCall },
              out: outRef.current,
            });
            if (!resolved.ok) throw new Error(resolved.error);
            const value = resolved.value;
            objectId = typeof value === "string" ? value : String((value as { id?: unknown } | null)?.id ?? "");
          }
          if (!objectId) {
            const kind = viewer.data.targetKind ?? "player";
            const candidates =
              kind === "player"
                ? summary.players
                : kind === "entity"
                  ? summary.entities
                  : kind === "item"
                    ? summary.items
                    : kind === "block"
                      ? summary.blocks
                      : kind === "dimension"
                        ? summary.dimensions
                        : kind === "world"
                          ? summary.world
                            ? [summary.world]
                            : []
                          : summary.scoreboard
                            ? [summary.scoreboard]
                            : [];
            objectId = candidates?.[0]?.id ?? "";
          }
          if (!objectId) throw new Error("没有可预览对象");
          const snap = (await request("inspect", { id: objectId })) as {
            id: string;
            kind: string;
            props: Record<string, unknown>;
          };
          setNodes((ns) =>
            ns.map((x) =>
              x.id === viewer.id
                ? {
                    ...x,
                    data: {
                      ...x.data,
                      targetRef: objectId,
                      viewerProps: snap.props,
                      runState: "done",
                      runSummary: clipRunSummary(`inspect · ${objectId}`),
                    },
                  }
                : x
            )
          );
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          setRunState(viewer.id, "failed", clipRunSummary(message));
          appendLog(`[viewer] ${message}`, "warn", { nodeId: viewer.id });
        }
      }
      appendLog(
        `--- run #${runId} end --- ${failed ? "FAIL" : divertedFail ? "ok(fail-edge)" : "ok"}${
          failedNode ? ` failedNode=${failedNode}` : ""
        }`
      );
      currentRunIdRef.current = undefined;
      setStatus(failed ? "已停止（失败）" : divertedFail ? "就绪（曾走失败边）" : "就绪");
      setBusy(false);
    },
    [
      appendLog,
      busy,
      markFailedNode,
      ready,
      refreshScene,
      request,
      selectedId,
      setNodeLastFailure,
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
        scoreboard: {
          kind: "scoreboard",
          title: "scoreboard",
          detail: "world.scoreboard",
          props: {
            id: preferredScoreboardObjectId(undefined, "scoreboard"),
          },
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
          outName: "",
        },
        tick: { kind: "tick", title: "Tick ×1", detail: "n = 1", n: 1 },
        assert: {
          kind: "assert",
          assertKind: "log",
          title: "日志包含",
          detail: "ok",
          pattern: "ok",
        },
        branch: {
          kind: "branch",
          title: "Branch",
          detail: "cond ? pass : fail",
          branchCond: "",
        },
        repeat: {
          kind: "repeat",
          title: "Repeat ×3",
          detail: "body × 3",
          repeatTimes: 3,
        },
        frame: { kind: "frame", title: "Frame", detail: "装饰性分组", color: "violet", width: 360, height: 240 },
        viewer: { kind: "viewer", title: "Viewer", detail: "inspect", targetKind: "player", targetRef: "" },
        note: { kind: "note", title: "注释", detail: "…" },
      };
      setNodes((ns) => [
        ...ns,
        {
          id,
          type: kind === "frame" ? "frame" : kind === "viewer" ? "viewer" : "stimulus",
          position: rfRef.current?.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }) ?? {
            x: 100,
            y: 40,
          },
          ...(kind === "frame" ? { style: { width: 360, height: 240 }, zIndex: -1 } : {}),
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

  const colorSelectedNodes = useCallback(
    (color: keyof typeof NODE_COLOR_PRESETS) => {
      const ids = new Set(nodes.filter((n) => n.selected || n.id === ctxMenu?.nodeId).map((n) => n.id));
      if (!ids.size) return;
      pushHistory();
      setNodes((ns) => ns.map((n) => (ids.has(n.id) ? { ...n, data: { ...n.data, color } } : n)));
    },
    [ctxMenu?.nodeId, nodes, pushHistory, setNodes]
  );

  const frameSelectedNodes = useCallback(() => {
    const selectedNodes = nodes.filter((n) => n.selected && n.data.kind !== "frame");
    if (!selectedNodes.length) return;
    const minX = Math.min(...selectedNodes.map((n) => n.position.x)) - 36;
    const minY = Math.min(...selectedNodes.map((n) => n.position.y)) - 52;
    const maxX = Math.max(...selectedNodes.map((n) => n.position.x + (n.measured?.width ?? 180))) + 36;
    const maxY = Math.max(...selectedNodes.map((n) => n.position.y + (n.measured?.height ?? 100))) + 36;
    const id = `n${Date.now()}`;
    pushHistory();
    setNodes((ns) => [
      ...ns,
      {
        id,
        type: "frame",
        position: { x: minX, y: minY },
        style: { width: maxX - minX, height: maxY - minY },
        zIndex: -1,
        data: {
          kind: "frame",
          title: "Frame",
          detail: "装饰性分组",
          color: "violet",
          width: maxX - minX,
          height: maxY - minY,
        },
      },
    ]);
    selectGraphNode(id);
  }, [nodes, pushHistory, selectGraphNode, setNodes]);

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
        setPaletteOpen(false);
        return;
      }
      if (isTypingTarget(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      const h = hotkeys.current;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

      if (!mod && e.shiftKey && !e.altKey && key === "a") {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
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
      if (mod && !e.shiftKey && key >= "1" && key <= "9") {
        e.preventDefault();
        const kinds: StimulusKind[] = [
          "player",
          "entity",
          "item",
          "scoreboard",
          "emit",
          "call",
          "tick",
          "assert",
          "note",
        ];
        h.addNode(kinds[Number(key) - 1]!);
      }
      if (mod && !e.shiftKey && !e.altKey && (key === "b" || key === "r" || key === "n")) {
        e.preventDefault();
        const map: Record<string, StimulusKind> = { b: "branch", r: "repeat", n: "note" };
        h.addNode(map[key]!);
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
    loaded: "已装载",
  };

  const dockOrder: PanelId[] = ["tools", "props", "fixture", "loaded"];

  /** 顶栏只读状态：就绪/忙碌相位 + 可选模块短名；详情进「视图 → 已装载」 */
  const statusPill = useMemo(() => {
    const modShort = moduleBinding.id ?? (moduleBinding.status === "pending" ? null : ready ? "engine" : null);
    const tip = [
      moduleBinding.moduleRoot && moduleBinding.moduleRoot !== "(engine only)" ? moduleBinding.moduleRoot : null,
      moduleBinding.bootPhase?.summary,
      "详情：视图 → 已装载",
    ]
      .filter(Boolean)
      .join("\n");

    if (!ready) {
      if (moduleBinding.status === "pending" && status === "装载沙箱…") {
        return { text: "装载中…", tip };
      }
      return { text: status, tip: status };
    }
    if (busy || status.endsWith("…")) {
      return { text: status, tip: status };
    }
    if (
      status.startsWith("已停止") ||
      status.startsWith("已定位") ||
      status.includes("拖动") ||
      status.startsWith("就绪（")
    ) {
      const withMod = modShort && status.startsWith("就绪") ? `${status} · ${modShort}` : status;
      return {
        text: withMod,
        tip: status.startsWith("就绪") ? tip : status,
      };
    }
    const enabledNote = moduleBinding.enabled === false ? " · 未启用" : "";
    return {
      text: modShort ? `就绪 · ${modShort}${enabledNote}` : "就绪",
      tip,
    };
  }, [busy, moduleBinding, ready, status]);

  const renderDocked = (id: PanelId) => (
    <DockPanel key={id} title={panelTitle[id]} layout={prefs.panels[id]} onChange={(patch) => setPanel(id, patch)}>
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
            chatByPlayer={chatByPlayerRef.current}
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
      ) : id === "loaded" ? (
        <LoadedPanel binding={moduleBinding} onInsertEmit={addEmitFromSubscribed} />
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
              <span className="rdx-item-main">{prefs.panels.tools.visible ? "隐藏" : "显示"}工具</span>
            </DropdownMenu.Item>
            <DropdownMenu.Item className="rdx-item" onSelect={() => togglePanel("props")}>
              <span className="rdx-item-main">{prefs.panels.props.visible ? "隐藏" : "显示"}属性</span>
            </DropdownMenu.Item>
            <DropdownMenu.Item className="rdx-item" onSelect={() => togglePanel("fixture")}>
              <span className="rdx-item-main">{prefs.panels.fixture.visible ? "隐藏" : "显示"}夹具</span>
            </DropdownMenu.Item>
            <DropdownMenu.Item className="rdx-item" onSelect={() => togglePanel("loaded")}>
              <span className="rdx-item-main">{prefs.panels.loaded.visible ? "隐藏" : "显示"}已装载</span>
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="rdx-sep" />
            <DropdownMenu.Item className="rdx-item" onSelect={resetLayout}>
              <span className="rdx-item-main">复位面板布局</span>
            </DropdownMenu.Item>
            <DropdownMenu.Item className="rdx-item" onSelect={() => vscodeApi().postMessage({ cmd: "showOutput" })}>
              <span className="rdx-item-main">打开 Output 日志</span>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className="rdx-item"
              onSelect={() => vscodeApi().postMessage({ cmd: "configureLogFilter" })}
            >
              <span className="rdx-item-main">日志过滤…</span>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className="rdx-item"
              onSelect={() => vscodeApi().postMessage({ cmd: "clearAndApplyLogFilter" })}
            >
              <span className="rdx-item-main">清除并应用过滤</span>
            </DropdownMenu.Item>
            <DropdownMenu.Item className="rdx-item" onSelect={() => vscodeApi().postMessage({ cmd: "locateLogNode" })}>
              <span className="rdx-item-main">定位日志节点</span>
            </DropdownMenu.Item>
            <DropdownMenu.Item className="rdx-item" disabled={!failedNodeId} onSelect={locateFailedNode}>
              <span className="rdx-item-main">定位失败节点</span>
            </DropdownMenu.Item>
          </TopMenu>
          <TopMenu label="插入">
            <InsertMenuItems onInsert={addNode} />
            {(moduleBinding.subscribedEvents?.length ?? 0) > 0 ? (
              <>
                <DropdownMenu.Separator className="rdx-sep" />
                <DropdownMenu.Label className="rdx-label">已订阅事件 → Emit</DropdownMenu.Label>
                {(moduleBinding.subscribedEvents ?? []).slice(0, 12).map((e) => (
                  <DropdownMenu.Item key={e.path} className="rdx-item" onSelect={() => addEmitFromSubscribed(e.path)}>
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
            <DropdownMenu.Item className="rdx-item" disabled={!canRun} onSelect={() => void run("graph")}>
              <span className="rdx-item-main">
                运行整图
                <span className="sub">拓扑序</span>
              </span>
              <MenuKbd>F5</MenuKbd>
            </DropdownMenu.Item>
            <DropdownMenu.Item className="rdx-item" disabled={!canRun || !selectedId} onSelect={() => void run("from")}>
              <span className="rdx-item-main">
                从选中运行
                <span className="sub">路径重试</span>
              </span>
              <MenuKbd>{MOD}+F5</MenuKbd>
            </DropdownMenu.Item>
            <DropdownMenu.Item className="rdx-item" disabled={!canRun || !selectedId} onSelect={() => void run("only")}>
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
        <span className="grow" />
        <span className="status-pill" title={statusPill.tip}>
          {statusPill.text}
        </span>
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
              position="bottom-right"
              nodeColor={(n) => {
                const data = n.data as StimulusNodeData | undefined;
                return data?.color ? nodeColor({ data }) : (data?.kind && KIND_MINIMAP[data.kind]) || "#808080";
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
                      <DropdownMenu.Item className="rdx-item" onSelect={() => patchEdgeKind(ctxMenu.edgeId!, "pass")}>
                        <span className="rdx-item-main">
                          设为通过边
                          <span className="sub">断言成功走此边</span>
                        </span>
                      </DropdownMenu.Item>
                      <DropdownMenu.Item className="rdx-item" onSelect={() => patchEdgeKind(ctxMenu.edgeId!, "fail")}>
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
                            (edges.find((e) => e.id === id)?.data as { note?: string } | undefined)?.note ?? ""
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
                          <DropdownMenu.Item className="rdx-item" onSelect={() => duplicateNode(ctxMenu.nodeId!)}>
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
                          <span className="rdx-item-main">{selectedEdgeId ? "删除选中边" : "删除选中节点"}</span>
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

      <NodePalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onCreate={addNode} />
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
