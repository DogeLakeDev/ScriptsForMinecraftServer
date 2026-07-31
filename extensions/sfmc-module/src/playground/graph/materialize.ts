/**
 * 图上的「新建 Player / Entity / ItemStack」节点只是刺激定义；须 objects.create 后才进入场景 registry。
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

/** 图上可 objects.create 的刺激 kind */
export const CREATE_STIMULUS_KINDS = ["player", "entity", "item"] as const;
export type CreateStimulusKind = (typeof CREATE_STIMULUS_KINDS)[number];

export function isCreateStimulusKind(kind: string): kind is CreateStimulusKind {
  return (CREATE_STIMULUS_KINDS as readonly string[]).includes(kind);
}

/** 刺激 kind → objects.create 的引擎 kind */
export function createApiKind(kind: CreateStimulusKind): "Player" | "Entity" | "ItemStack" {
  if (kind === "player") return "Player";
  if (kind === "entity") return "Entity";
  return "ItemStack";
}

function shortTypeId(typeId: string, fallback: string): string {
  const s = typeId.trim() || fallback;
  const i = s.indexOf(":");
  return (i >= 0 ? s.slice(i + 1) : s) || fallback;
}

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

/** 与 FakeEntity 可注入 id 对齐的稳定登记 id */
export function preferredEntityObjectId(
  props: Record<string, unknown> | undefined,
  title?: string
): string {
  if (props && typeof props.id === "string" && props.id.trim()) {
    return props.id.trim();
  }
  const typeId = String(props?.typeId ?? title ?? "minecraft:cow").trim() || "minecraft:cow";
  return `entity-${shortTypeId(typeId, "entity")}`;
}

/** ItemStack registry 稳定 id（非引擎原生字段，仅登记用） */
export function preferredItemObjectId(
  props: Record<string, unknown> | undefined,
  title?: string
): string {
  if (props && typeof props.id === "string" && props.id.trim()) {
    return props.id.trim();
  }
  const typeId = String(props?.typeId ?? title ?? "minecraft:apple").trim() || "minecraft:apple";
  return `item-${shortTypeId(typeId, "item")}`;
}

/** 供 objects.create('Player') 的属性袋（保证带稳定 id） */
export function playerCreatePayload(data: CreateNodeLike["data"]): Record<string, unknown> {
  const base = { ...(data.props ?? {}) };
  if (base.name == null && data.title) base.name = data.title;
  const id = preferredPlayerObjectId(base, data.title);
  base.id = id;
  return base;
}

/** 供 objects.create('Entity') 的属性袋（保证带稳定 id） */
export function entityCreatePayload(data: CreateNodeLike["data"]): Record<string, unknown> {
  const base = { ...(data.props ?? {}) };
  if (base.typeId == null && data.title) {
    const t = String(data.title).trim();
    base.typeId = t.includes(":") ? t : `minecraft:${t || "cow"}`;
  }
  const id = preferredEntityObjectId(base, data.title);
  base.id = id;
  return base;
}

/** 供 objects.create('ItemStack') 的属性袋（保证带稳定 registry id） */
export function itemCreatePayload(data: CreateNodeLike["data"]): Record<string, unknown> {
  const base = { ...(data.props ?? {}) };
  if (base.typeId == null && data.title) {
    const t = String(data.title).trim();
    base.typeId = t.includes(":") ? t : `minecraft:${t || "apple"}`;
  }
  if (typeof base.amount !== "number") base.amount = 1;
  const id = preferredItemObjectId(base, data.title);
  base.id = id;
  return base;
}

export function createPayloadForKind(
  kind: CreateStimulusKind,
  data: CreateNodeLike["data"]
): Record<string, unknown> {
  if (kind === "player") return playerCreatePayload(data);
  if (kind === "entity") return entityCreatePayload(data);
  return itemCreatePayload(data);
}

/** 重置世界后清空图节点上的实例绑定（避免脏 objectId） */
export function clearCreateObjectIds<T extends CreateNodeLike>(nodes: T[]): T[] {
  return nodes.map((n) => {
    if (!isCreateStimulusKind(n.data.kind) || n.data.objectId == null) return n;
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

export function isCreateInstantiated(data: { kind: string; objectId?: string }): boolean {
  return (
    isCreateStimulusKind(data.kind) && typeof data.objectId === "string" && data.objectId.length > 0
  );
}
