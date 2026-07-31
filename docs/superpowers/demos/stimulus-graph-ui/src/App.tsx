import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { StimulusNode, type StimulusKind, type StimulusNodeData } from "./StimulusNode";

type SNode = Node<StimulusNodeData>;

const initialNodes: SNode[] = [
  {
    id: "n1",
    type: "stimulus",
    position: { x: 40, y: 120 },
    data: {
      kind: "player",
      title: "alice",
      detail: "op · overworld · (0,64,0)",
    },
  },
  {
    id: "n2",
    type: "stimulus",
    position: { x: 280, y: 80 },
    data: {
      kind: "emit",
      title: "world.afterEvents.playerJoin",
      detail: "PlayerJoinAfterEvent",
    },
  },
  {
    id: "n3",
    type: "stimulus",
    position: { x: 280, y: 220 },
    data: {
      kind: "emit",
      title: "world.beforeEvents.chatSend",
      detail: '!land create "家"',
    },
  },
  {
    id: "n4",
    type: "stimulus",
    position: { x: 560, y: 150 },
    data: {
      kind: "tick",
      title: "推进 5 tick",
      detail: "n = 5",
    },
  },
  {
    id: "n5",
    type: "stimulus",
    position: { x: 800, y: 150 },
    data: {
      kind: "assert",
      title: "日志包含",
      detail: "/领地已创建/",
    },
  },
  {
    id: "n6",
    type: "stimulus",
    position: { x: 40, y: 300 },
    data: {
      kind: "note",
      title: "冒烟：领取",
      detail: "改 chat 文案后 → 仅运行选中 n3",
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

const nodeTypes: NodeTypes = { stimulus: StimulusNode };

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedId, setSelectedId] = useState<string | null>("n3");
  const [status, setStatus] = useState("就绪 · 示例剧本");
  const [log, setLog] = useState(
    [
      "[playground] sandbox started (engine only)",
      "[demo] 这是静态 UI 示例：xyflow + Radix + 自绘皮",
      "[demo] 点顶栏「运行」可模拟整图 / 从选中 / 仅选中",
    ].join("\n")
  );
  const [busy, setBusy] = useState(false);

  const selected = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId]
  );

  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge({ ...c, id: `e-${c.source}-${c.target}` }, eds)),
    [setEdges]
  );

  const patchNodeData = useCallback(
    (id: string, patch: Partial<StimulusNodeData>) => {
      setNodes((ns) =>
        ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n))
      );
    },
    [setNodes]
  );

  const setRunState = useCallback(
    (id: string, runState: StimulusNodeData["runState"]) => {
      patchNodeData(id, { runState });
    },
    [patchNodeData]
  );

  const appendLog = useCallback((line: string) => {
    setLog((prev) => `${prev}\n${line}`);
  }, []);

  const orderFrom = useCallback(
    (startId: string | null, mode: "graph" | "from" | "only") => {
      if (mode === "only" && startId) return [startId];
      if (mode === "from" && startId) {
        const out = new Map<string, string[]>();
        for (const e of edges) {
          if (!out.has(e.source)) out.set(e.source, []);
          out.get(e.source)!.push(e.target);
        }
        const seen = new Set<string>();
        const q = [startId];
        const order: string[] = [];
        while (q.length) {
          const id = q.shift()!;
          if (seen.has(id)) continue;
          seen.add(id);
          order.push(id);
          for (const t of out.get(id) ?? []) q.push(t);
        }
        return order;
      }
      // 整图：按当前示例的稳定拓扑近似（入度 Kahn）
      const indeg = new Map<string, number>();
      const out = new Map<string, string[]>();
      for (const n of nodes) {
        indeg.set(n.id, 0);
        out.set(n.id, []);
      }
      for (const e of edges) {
        indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
        out.get(e.source)?.push(e.target);
      }
      const q = [...indeg.entries()].filter(([, d]) => d === 0).map(([id]) => id);
      const order: string[] = [];
      while (q.length) {
        const id = q.shift()!;
        order.push(id);
        for (const t of out.get(id) ?? []) {
          const d = (indeg.get(t) ?? 1) - 1;
          indeg.set(t, d);
          if (d === 0) q.push(t);
        }
      }
      return order.filter((id) => nodes.find((n) => n.id === id)?.data.kind !== "note");
    },
    [edges, nodes]
  );

  const run = async (mode: "graph" | "from" | "only") => {
    if (busy) return;
    if ((mode === "from" || mode === "only") && !selectedId) {
      appendLog("[run] 请先选中一个节点");
      return;
    }
    setBusy(true);
    const label =
      mode === "graph" ? "运行整图" : mode === "from" ? "从选中运行" : "仅运行选中";
    setStatus(`${label}…`);
    appendLog(`[run] ${label}`);
    setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, runState: "idle" } })));

    const order = orderFrom(selectedId, mode);
    for (const id of order) {
      const n = nodes.find((x) => x.id === id);
      if (!n || n.data.kind === "note") continue;
      setRunState(id, "running");
      setSelectedId(id);
      appendLog(`[run] → ${n.data.kind} ${n.data.title}`);
      await sleep(420);
      if (n.data.kind === "assert" && mode === "graph") {
        // 演示失败停住：整图跑到断言时标红一次机会——这里成功
        setRunState(id, "done");
        appendLog(`[assert] ok ${n.data.detail}`);
      } else {
        setRunState(id, "done");
      }
    }
    setStatus("就绪 · 示例剧本");
    setBusy(false);
  };

  const addNode = (kind: StimulusKind) => {
    const id = `n${Date.now()}`;
    const defaults: Record<StimulusKind, Pick<StimulusNodeData, "title" | "detail">> = {
      player: { title: "bob", detail: "op · overworld" },
      emit: { title: "world.afterEvents.playerSpawn", detail: "预填 Event" },
      tick: { title: "推进 1 tick", detail: "n = 1" },
      assert: { title: "日志包含", detail: "/ok/" },
      note: { title: "注释", detail: "说明…" },
    };
    const node: SNode = {
      id,
      type: "stimulus",
      position: { x: 120 + Math.random() * 80, y: 60 + Math.random() * 80 },
      data: { kind, ...defaults[kind] },
    };
    setNodes((ns) => [...ns, node]);
    setSelectedId(id);
  };

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">刺激剧本</span>
        <span className="muted">UI 示例 · xyflow + Radix</span>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="btn" disabled={busy} type="button">
              运行 ▾
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="rdx-content" sideOffset={6} align="start">
              <DropdownMenu.Item className="rdx-item" onSelect={() => void run("graph")}>
                运行整图
                <span className="sub">可选手重置沙箱（示例未接宿主）</span>
              </DropdownMenu.Item>
              <DropdownMenu.Item className="rdx-item" onSelect={() => void run("from")}>
                从选中运行
                <span className="sub">重试一条路径 · 默认保留世界</span>
              </DropdownMenu.Item>
              <DropdownMenu.Item className="rdx-item" onSelect={() => void run("only")}>
                仅运行选中
                <span className="sub">改完字段后单步重试</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <button className="btn secondary" type="button" onClick={() => appendLog("[demo] 重置场景（示意）")}>
          重置场景
        </button>
        <span className="grow" />
        <span className={`badge${busy ? "" : " ok"}`}>{status}</span>
      </header>

      <div className="workspace">
        <div className="canvas-wrap">
          <div className="palette">
            <button className="btn secondary" type="button" onClick={() => addNode("player")}>
              + Player
            </button>
            <button className="btn secondary" type="button" onClick={() => addNode("emit")}>
              + Emit
            </button>
            <button className="btn secondary" type="button" onClick={() => addNode("tick")}>
              + Tick
            </button>
            <button className="btn secondary" type="button" onClick={() => addNode("assert")}>
              + 断言
            </button>
          </div>
          <div className="hint">
            拖节点、拖手柄连线。侧栏跟选中；顶栏「运行」演示局部重试高亮。此页不连 playground-host。
          </div>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            onSelectionChange={({ nodes: sel }) => {
              if (sel[0]) setSelectedId(sel[0].id);
            }}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#333" />
            <Controls />
            <MiniMap
              pannable
              zoomable
              style={{ background: "#252526" }}
              maskColor="rgb(0 0 0 / 50%)"
              nodeColor={(n) => {
                const k = (n.data as StimulusNodeData)?.kind;
                if (k === "player") return "#4ec9b0";
                if (k === "emit") return "#569cd6";
                if (k === "tick") return "#dcdcaa";
                if (k === "assert") return "#ce9178";
                return "#808080";
              }}
            />
          </ReactFlow>
        </div>

        <aside className="side">
          <div className="side-section">
            <h2>属性</h2>
            {!selected ? (
              <p className="muted">选中画布上的节点</p>
            ) : (
              <>
                <div className="field">
                  <label>id</label>
                  <input value={selected.id} readOnly />
                </div>
                <div className="field">
                  <label>类型</label>
                  <input value={selected.data.kind} readOnly />
                </div>
                <div className="field">
                  <label>标题</label>
                  <input
                    value={selected.data.title}
                    onChange={(e) => patchNodeData(selected.id, { title: e.target.value })}
                  />
                </div>
                {selected.data.kind === "emit" && (
                  <>
                    <div className="field">
                      <label>信号 path</label>
                      <input
                        value={selected.data.title}
                        onChange={(e) => patchNodeData(selected.id, { title: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label>message（示意表单）</label>
                      <input
                        value={selected.data.detail.replace(/^!/, "")}
                        onChange={(e) =>
                          patchNodeData(selected.id, { detail: e.target.value.startsWith("!") ? e.target.value : `!${e.target.value}` })
                        }
                      />
                    </div>
                    <div className="field">
                      <label>sender</label>
                      <select defaultValue="alice">
                        <option value="alice">alice（场景）</option>
                        <option value="">（未绑定）</option>
                      </select>
                    </div>
                  </>
                )}
                {selected.data.kind !== "emit" && (
                  <div className="field">
                    <label>详情</label>
                    <textarea
                      rows={3}
                      value={selected.data.detail}
                      onChange={(e) => patchNodeData(selected.id, { detail: e.target.value })}
                    />
                  </div>
                )}
              </>
            )}
          </div>
          <div className="side-section" style={{ borderBottom: "none" }}>
            <h2>说明</h2>
            <p className="muted" style={{ margin: 0, lineHeight: 1.45 }}>
              规格：多步编排、条件分支、可复现剧本；运行范围含整图 / 从选中 / 仅选中。真扩展将接
              playground-host 与 PLAYGROUND_META。
            </p>
          </div>
          <div className="side-section">
            <h2>日志</h2>
            <pre className="log-pre">{log}</pre>
          </div>
        </aside>
      </div>
    </div>
  );
}
