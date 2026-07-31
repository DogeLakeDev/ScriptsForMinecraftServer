/**
 * 图上的「新建 Player」等节点只是刺激定义；须 objects.create 后才进入场景 registry。
 */

export type CreateNodeLike = {
  id: string;
  data: {
    kind: string;
    title?: string;
    objectId?: string;
    props?: Record<string, unknown>;
  };
};

/** 与 FakePlayer 默认 id（player-${name}）对齐的稳定登记 id */
export function preferredPlayerObjectId(
  props: Record<string, unknown> | undefined,
  title?: string
): string {
  if (props && typeof props.id === "string" && props.id.trim()) {
    return props.id.trim();
  }
  const name = String(props?.name ?? title ?? "player").trim() || "player";
  return `player-${name}`;
}

/** 供 objects.create('Player') 的属性袋（保证带稳定 id） */
export function playerCreatePayload(
  data: CreateNodeLike["data"]
): Record<string, unknown> {
  const base = { ...(data.props ?? {}) };
  if (base.name == null && data.title) base.name = data.title;
  const id = preferredPlayerObjectId(base, data.title);
  base.id = id;
  return base;
}

/** 重置世界后清空图节点上的实例绑定（避免脏 objectId） */
export function clearCreateObjectIds<T extends CreateNodeLike>(nodes: T[]): T[] {
  return nodes.map((n) => {
    if (n.data.kind !== "player" || n.data.objectId == null) return n;
    const { objectId: _drop, ...rest } = n.data;
    return { ...n, data: { ...rest } };
  });
}

/** 把 create 结果写回节点 */
export function bindCreateObjectId<T extends CreateNodeLike>(
  nodes: T[],
  nodeId: string,
  objectId: string
): T[] {
  return nodes.map((n) => {
    if (n.id !== nodeId) return n;
    const props = { ...(n.data.props ?? {}), id: objectId };
    return {
      ...n,
      data: {
        ...n.data,
        objectId,
        props,
      },
    };
  });
}

export function isPlayerInstantiated(data: {
  kind: string;
  objectId?: string;
}): boolean {
  return data.kind === "player" && typeof data.objectId === "string" && data.objectId.length > 0;
}
