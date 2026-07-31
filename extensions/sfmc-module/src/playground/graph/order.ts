/**
 * 脚本沙箱执行顺序：整图拓扑 / 从选中 BFS / 仅选中 / 上游（含终点）
 */

export type GraphEdge = { source: string; target: string };
export type GraphNode = { id: string; kind?: string };
/** upstream：以 selectedId 为终点，含可达祖先与自身，不含下游（边菜单「运行上游 / 到此边前」） */
export type RunMode = "graph" | "from" | "only" | "upstream";

function topoOrder(nodes: GraphNode[], edges: GraphEdge[], skip: Set<string>): string[] {
  const indeg = new Map<string, number>();
  const out = new Map<string, string[]>();
  for (const n of nodes) {
    indeg.set(n.id, 0);
    out.set(n.id, []);
  }
  for (const e of edges) {
    if (!indeg.has(e.target) || !out.has(e.source)) continue;
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
    out.get(e.source)!.push(e.target);
  }
  const q = [...indeg.entries()].filter(([, d]) => d === 0).map(([id]) => id).sort();
  const order: string[] = [];
  while (q.length) {
    const id = q.shift()!;
    if (!skip.has(id)) order.push(id);
    const next = [...(out.get(id) ?? [])].sort();
    for (const t of next) {
      const d = (indeg.get(t) ?? 1) - 1;
      indeg.set(t, d);
      if (d === 0) q.push(t);
      q.sort();
    }
  }
  return order;
}

export function orderNodes(
  nodes: GraphNode[],
  edges: GraphEdge[],
  mode: RunMode,
  selectedId: string | null
): string[] {
  const skip = new Set(nodes.filter((n) => n.kind === "note").map((n) => n.id));

  if (mode === "only") {
    if (!selectedId || skip.has(selectedId)) return [];
    return [selectedId];
  }

  if (mode === "from") {
    if (!selectedId) return [];
    const out = new Map<string, string[]>();
    for (const e of edges) {
      if (!out.has(e.source)) out.set(e.source, []);
      out.get(e.source)!.push(e.target);
    }
    const seen = new Set<string>();
    const q = [selectedId];
    const order: string[] = [];
    while (q.length) {
      const id = q.shift()!;
      if (seen.has(id)) continue;
      seen.add(id);
      if (!skip.has(id)) order.push(id);
      for (const t of out.get(id) ?? []) q.push(t);
    }
    return order;
  }

  if (mode === "upstream") {
    if (!selectedId) return [];
    const incoming = new Map<string, string[]>();
    for (const e of edges) {
      if (!incoming.has(e.target)) incoming.set(e.target, []);
      incoming.get(e.target)!.push(e.source);
    }
    const keep = new Set<string>();
    const q = [selectedId];
    while (q.length) {
      const id = q.shift()!;
      if (keep.has(id)) continue;
      keep.add(id);
      for (const s of incoming.get(id) ?? []) q.push(s);
    }
    const subNodes = nodes.filter((n) => keep.has(n.id));
    const subEdges = edges.filter((e) => keep.has(e.source) && keep.has(e.target));
    return topoOrder(subNodes, subEdges, skip);
  }

  return topoOrder(nodes, edges, skip);
}
