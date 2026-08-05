/**
 * 脚本沙箱执行顺序：整图拓扑 / 从选中 BFS / 仅选中 / 上游（含终点）
 * 断言双出边：kind=pass（缺省）走通过下游；kind=fail 仅在断言失败时切入
 */

export type EdgeKind = "pass" | "fail";

export type GraphEdge = {
  source: string;
  target: string;
  kind?: EdgeKind | string;
  /** 禁用边视作不存在：不进拓扑、不算入边、不参与断言分支 */
  enabled?: boolean;
};
export type GraphNode = { id: string; kind?: string };
/** upstream：以 selectedId 为终点，含可达祖先与自身，不含下游（边菜单「运行上游 / 到此边前」） */
export type RunMode = "graph" | "from" | "only" | "upstream";

export function normalizeEdgeKind(kind: unknown): EdgeKind {
  return kind === "fail" ? "fail" : "pass";
}

function isEdgeEnabled(e: GraphEdge): boolean {
  return e.enabled !== false;
}

function filterEdges(edges: GraphEdge[], follow: EdgeKind | "all"): GraphEdge[] {
  const active = edges.filter(isEdgeEnabled);
  if (follow === "all") return active;
  return active.filter((e) => normalizeEdgeKind(e.kind) === follow);
}

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

/** 控制节点（不出现在主线性序里的位置算子；执行器按位置内联处理）。 */
export const CONTROL_KINDS = new Set(["branch", "repeat"]);

/**
 * 从线性序中切出某个控制节点紧跟其后到下一个控制节点（或线性末端）为止的「子图体」。
 * 重复节点 / 分支节点的执行器依赖该切分。
 */
export function sliceControlBody(
  order: readonly string[],
  controlIdx: number,
  isControl: (id: string) => boolean
): string[] {
  const out: string[] = [];
  for (let i = controlIdx + 1; i < order.length; i++) {
    const id = order[i]!;
    if (isControl(id)) break;
    out.push(id);
  }
  return out;
}

function outMap(edges: GraphEdge[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const e of edges) {
    if (!out.has(e.source)) out.set(e.source, []);
    out.get(e.source)!.push(e.target);
  }
  return out;
}

function passOutMap(edges: GraphEdge[]): Map<string, string[]> {
  return outMap(filterEdges(edges, "pass"));
}

function bfsFrom(
  startIds: string[],
  out: Map<string, string[]>,
  skip: Set<string>,
  exclude?: Set<string>
): string[] {
  const seen = new Set<string>();
  const q = [...startIds].sort();
  const order: string[] = [];
  while (q.length) {
    const id = q.shift()!;
    if (seen.has(id)) continue;
    if (exclude?.has(id)) continue;
    seen.add(id);
    if (!skip.has(id)) order.push(id);
    for (const t of [...(out.get(id) ?? [])].sort()) q.push(t);
  }
  return order;
}

/** 全边入度为 0 的根（失败边也算入边，避免失败支路被当成整图根） */
function rootIds(nodes: GraphNode[], edges: GraphEdge[]): string[] {
  const hasIn = new Set(edges.map((e) => e.target));
  return nodes.map((n) => n.id).filter((id) => !hasIn.has(id)).sort();
}

function reachableFrom(startIds: string[], out: Map<string, string[]>): Set<string> {
  const seen = new Set<string>();
  const q = [...startIds];
  while (q.length) {
    const id = q.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const t of out.get(id) ?? []) q.push(t);
  }
  return seen;
}

/**
 * @param opts.follow 前进模式默认只沿 pass；upstream 默认 all（祖先含失败边）
 */
function skippedNodeIds(nodes: GraphNode[]): Set<string> {
  return new Set(nodes.filter((n) => n.kind === "note" || n.kind === "frame" || n.kind === "viewer").map((n) => n.id));
}

export function orderNodes(
  nodes: GraphNode[],
  edges: GraphEdge[],
  mode: RunMode,
  selectedId: string | null,
  opts?: { follow?: EdgeKind | "all" }
): string[] {
  const skip = skippedNodeIds(nodes);
  const follow = opts?.follow ?? (mode === "upstream" ? "all" : "pass");
  const active = filterEdges(edges, follow);

  if (mode === "only") {
    if (!selectedId || skip.has(selectedId)) return [];
    return [selectedId];
  }

  if (mode === "from") {
    if (!selectedId) return [];
    return bfsFrom([selectedId], outMap(active), skip);
  }

  if (mode === "upstream") {
    if (!selectedId) return [];
    const incoming = new Map<string, string[]>();
    for (const e of active) {
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
    const subEdges = active.filter((e) => keep.has(e.source) && keep.has(e.target));
    return topoOrder(subNodes, subEdges, skip);
  }

  // graph：根按全边入度；前进只沿 follow 边，失败支路不进默认序
  const roots = rootIds(nodes, edges);
  const keep = reachableFrom(roots, outMap(active));
  const subNodes = nodes.filter((n) => keep.has(n.id));
  const subEdges = active.filter((e) => keep.has(e.source) && keep.has(e.target));
  return topoOrder(subNodes, subEdges, skip);
}

/** 断言节点是否挂有失败出边 */
export function hasFailOutEdges(edges: GraphEdge[], assertId: string): boolean {
  return edges.some((e) => e.source === assertId && normalizeEdgeKind(e.kind) === "fail");
}

/**
 * 断言求值后的下游序（不含断言自身）：
 * 先取 outcome 出边目标，再只沿 pass 边 BFS。
 */
export function orderAssertBranch(
  nodes: GraphNode[],
  edges: GraphEdge[],
  assertId: string,
  outcome: EdgeKind
): string[] {
  const skip = skippedNodeIds(nodes);
  const targets = edges
    .filter((e) => e.source === assertId && normalizeEdgeKind(e.kind) === outcome)
    .map((e) => e.target);
  if (!targets.length) return [];
  return bfsFrom(targets, passOutMap(edges), skip, new Set([assertId]));
}
