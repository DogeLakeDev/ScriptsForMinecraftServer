import { useCallback, useEffect, useRef, useState } from "react";
import { vscodeApi } from "./vscodeApi";

export type PanelId = "tools" | "props";
export type DockMode = "left" | "right" | "float";

export type PanelLayout = {
  visible: boolean;
  dock: DockMode;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type LayoutPrefs = {
  panels: Record<PanelId, PanelLayout>;
  leftWidth: number;
  rightWidth: number;
};

const DEFAULT_PANELS: Record<PanelId, PanelLayout> = {
  tools: { visible: true, dock: "left", x: 16, y: 56, w: 200, h: 420 },
  props: { visible: true, dock: "right", x: 480, y: 56, w: 320, h: 520 },
};

const DEFAULTS: LayoutPrefs = {
  panels: DEFAULT_PANELS,
  leftWidth: 208,
  rightWidth: 320,
};

type Persisted = {
  layout?: Partial<LayoutPrefs> & { panels?: Partial<Record<string, Partial<PanelLayout>>> };
};

function mergePrefs(raw?: Persisted["layout"]): LayoutPrefs {
  const panels = { ...DEFAULT_PANELS };
  if (raw?.panels) {
    for (const id of Object.keys(panels) as PanelId[]) {
      panels[id] = { ...panels[id], ...(raw.panels[id] ?? {}) };
    }
  }
  return {
    leftWidth: raw?.leftWidth ?? DEFAULTS.leftWidth,
    rightWidth: raw?.rightWidth ?? DEFAULTS.rightWidth,
    panels,
  };
}

export function useLayoutPrefs() {
  const [prefs, setPrefs] = useState<LayoutPrefs>(() => {
    const st = vscodeApi().getState() as Persisted | undefined;
    return mergePrefs(st?.layout);
  });

  useEffect(() => {
    const prev = (vscodeApi().getState() as Persisted | undefined) ?? {};
    vscodeApi().setState({ ...prev, layout: prefs });
  }, [prefs]);

  const setPanel = useCallback((id: PanelId, patch: Partial<PanelLayout>) => {
    setPrefs((p) => ({
      ...p,
      panels: { ...p.panels, [id]: { ...p.panels[id], ...patch } },
    }));
  }, []);

  const togglePanel = useCallback((id: PanelId) => {
    setPrefs((p) => ({
      ...p,
      panels: {
        ...p.panels,
        [id]: { ...p.panels[id], visible: !p.panels[id].visible },
      },
    }));
  }, []);

  const setDockWidth = useCallback((side: "left" | "right", width: number) => {
    setPrefs((p) =>
      side === "left" ? { ...p, leftWidth: width } : { ...p, rightWidth: width }
    );
  }, []);

  const resetLayout = useCallback(() => {
    setPrefs(structuredClone(DEFAULTS));
  }, []);

  return { prefs, setPanel, togglePanel, setDockWidth, resetLayout };
}

export type GraphSnap = { nodes: unknown; edges: unknown };

export function useGraphHistory<N, E>(
  nodes: N,
  edges: E,
  setNodes: (n: N | ((prev: N) => N)) => void,
  setEdges: (e: E | ((prev: E) => E)) => void
) {
  const past = useRef<GraphSnap[]>([]);
  const future = useRef<GraphSnap[]>([]);
  const burst = useRef(false);
  const [, bump] = useState(0);

  const clone = useCallback(
    (n: N, e: E): GraphSnap => ({
      nodes: structuredClone(n),
      edges: structuredClone(e),
    }),
    []
  );

  const push = useCallback(() => {
    past.current.push(clone(nodes, edges));
    if (past.current.length > 80) past.current.shift();
    future.current = [];
    bump((x) => x + 1);
  }, [clone, edges, nodes]);

  const pushBurst = useCallback(() => {
    if (burst.current) return;
    burst.current = true;
    push();
    window.setTimeout(() => {
      burst.current = false;
    }, 600);
  }, [push]);

  const undo = useCallback(() => {
    const snap = past.current.pop();
    if (!snap) return;
    future.current.push(clone(nodes, edges));
    setNodes(snap.nodes as N);
    setEdges(snap.edges as E);
    bump((x) => x + 1);
  }, [clone, edges, nodes, setEdges, setNodes]);

  const redo = useCallback(() => {
    const snap = future.current.pop();
    if (!snap) return;
    past.current.push(clone(nodes, edges));
    setNodes(snap.nodes as N);
    setEdges(snap.edges as E);
    bump((x) => x + 1);
  }, [clone, edges, nodes, setEdges, setNodes]);

  return {
    push,
    pushBurst,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
