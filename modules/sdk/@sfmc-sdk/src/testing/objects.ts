/**
 * sb.objects — 1:1 构造 / 调用实例（元数据见 playground-meta）
 *
 * - 世界对象：Player / Entity / ItemStack / Block（引擎入口）
 * - 事件对象：*AfterEvent / *BeforeEvent 属性袋（供 emit payload）
 */

import { ItemStack } from "./engine/inventory.js";
import type { FakePlayer, FakePlayerInit } from "./engine/player.js";
import type { FakeWorld } from "./engine/world.js";
import type { FakeSystem } from "./engine/system.js";
import { PLAYGROUND_META } from "./engine/generated/playground-meta.js";
import { UnimplementedMinecraftApiError } from "./engine/allowlist.js";

export type SandboxObjectKind = string;

export type SandboxObjectHandle = {
  id: string;
  kind: SandboxObjectKind;
  target: unknown;
};

type Host = {
  world: FakeWorld;
  system: FakeSystem;
  addPlayer: (init: FakePlayerInit) => FakePlayer;
};

let seq = 0;

const ENGINE_KINDS = new Set(["Player", "Entity", "ItemStack", "Block"]);

export function createObjectRegistry(host: Host) {
  const byId = new Map<string, SandboxObjectHandle>();

  function register(kind: SandboxObjectKind, target: unknown, id?: string): SandboxObjectHandle {
    const handle: SandboxObjectHandle = {
      id: id ?? `${kind}-${++seq}`,
      kind,
      target,
    };
    byId.set(handle.id, handle);
    return handle;
  }

  /** 解析 props 中的 `$ref:id` → 已登记实例 */
  function resolveRefs(value: unknown): unknown {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const o = value as Record<string, unknown>;
      if (typeof o.$ref === "string") {
        const h = byId.get(o.$ref);
        if (!h) throw new Error(`unknown $ref: ${o.$ref}`);
        return h.target;
      }
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(o)) out[k] = resolveRefs(v);
      return out;
    }
    if (Array.isArray(value)) return value.map(resolveRefs);
    return value;
  }

  function applyProps(kind: string, target: Record<string, unknown>, props: Record<string, unknown>) {
    const meta = PLAYGROUND_META.classes[kind as keyof typeof PLAYGROUND_META.classes];
    const known: Set<string> | null = meta
      ? new Set(meta.properties.map((p) => p.name as string))
      : null;
    for (const [k, v] of Object.entries(props)) {
      if (k === "$ref") continue;
      if (known && !known.has(k)) continue;
      try {
        target[k] = resolveRefs(v);
      } catch (e) {
        if (e instanceof Error && e.message.startsWith("unknown $ref")) throw e;
        /* setter 拒绝则跳过 */
      }
    }
  }

  function createEventBag(kind: string, props: Record<string, unknown>): SandboxObjectHandle {
    const bag: Record<string, unknown> = {};
    applyProps(kind, bag, props);
    return register(kind, bag);
  }

  return {
    meta: PLAYGROUND_META,
    get(id: string): SandboxObjectHandle | undefined {
      return byId.get(id);
    },
    list(): SandboxObjectHandle[] {
      return [...byId.values()];
    },
    /** 可构造种类：引擎四类 + 全部 Event 类型 */
    kinds(): string[] {
      const out = new Set<string>(["Player", "Entity", "ItemStack", "Block"]);
      for (const [name, info] of Object.entries(PLAYGROUND_META.classes)) {
        if ((info as { kind?: string }).kind === "event") out.add(name);
      }
      return [...out].sort();
    },
    create(kind: SandboxObjectKind, props: Record<string, unknown> = {}): SandboxObjectHandle {
      const classMeta = PLAYGROUND_META.classes[kind as keyof typeof PLAYGROUND_META.classes] as
        | { kind?: string }
        | undefined;

      if (classMeta?.kind === "event" || (!ENGINE_KINDS.has(kind) && kind.endsWith("Event"))) {
        return createEventBag(kind, props);
      }

      if (kind === "Player") {
        const name = String(props.name ?? "player");
        const init: FakePlayerInit = {
          name,
          op: Boolean(props.op),
        };
        if (props.id != null) init.id = String(props.id);
        if (props.nameTag != null) init.nameTag = String(props.nameTag);
        if (typeof props.playerPermissionLevel === "number") {
          init.permissionLevel = props.playerPermissionLevel;
        } else if (typeof props.permissionLevel === "number") {
          init.permissionLevel = props.permissionLevel;
        }
        if (props.location) init.location = props.location as NonNullable<FakePlayerInit["location"]>;
        if (typeof props.dimensionId === "string") {
          init.dimensionId = props.dimensionId;
        } else if (typeof (props.dimension as { id?: string } | undefined)?.id === "string") {
          init.dimensionId = (props.dimension as { id: string }).id;
        }
        const player = host.addPlayer(init);
        applyProps("Player", player as unknown as Record<string, unknown>, props);
        applyProps("Entity", player as unknown as Record<string, unknown>, props);
        return register("Player", player, player.id);
      }

      if (kind === "ItemStack") {
        const typeId = String(props.typeId ?? "minecraft:apple");
        const amount = typeof props.amount === "number" ? props.amount : 1;
        const stack = new ItemStack(typeId, amount);
        applyProps("ItemStack", stack as unknown as Record<string, unknown>, props);
        return register("ItemStack", stack);
      }

      if (kind === "Entity") {
        const typeId = String(props.typeId ?? "minecraft:cow");
        const loc = (props.location as { x: number; y: number; z: number }) ?? {
          x: 0,
          y: 0,
          z: 0,
        };
        const dimId =
          typeof props.dimensionId === "string"
            ? props.dimensionId
            : typeof (props.dimension as { id?: string } | undefined)?.id === "string"
              ? (props.dimension as { id: string }).id
              : "minecraft:overworld";
        const entity = host.world.getDimension(dimId).spawnEntity(typeId, loc);
        applyProps("Entity", entity as unknown as Record<string, unknown>, props);
        return register("Entity", entity, String((entity as { id: string }).id));
      }

      if (kind === "Block") {
        const loc = (props.location as { x: number; y: number; z: number }) ?? {
          x: 0,
          y: 0,
          z: 0,
        };
        const dimId =
          typeof props.dimensionId === "string" ? props.dimensionId : "minecraft:overworld";
        const dim = host.world.getDimension(dimId);
        const typeId = String(props.typeId ?? "minecraft:stone");
        dim.setBlockType(loc, typeId);
        const block = dim.getBlock(loc);
        applyProps("Block", block as unknown as Record<string, unknown>, props);
        return register("Block", block, `block:${dimId}:${loc.x},${loc.y},${loc.z}`);
      }

      // 元数据中有、但非引擎入口：按属性袋构造（供嵌套类型等）
      if (classMeta) {
        return createEventBag(kind, props);
      }

      throw new UnimplementedMinecraftApiError(`objects.create(${kind})`);
    },
    call(id: string, method: string, args: unknown[] = []): unknown {
      const handle = byId.get(id);
      if (!handle) throw new Error(`unknown object id: ${id}`);
      const target = handle.target as Record<string, unknown>;
      const fn = target[method];
      if (typeof fn !== "function") {
        throw new UnimplementedMinecraftApiError(`${handle.kind}.${method}`);
      }
      return (fn as (...a: unknown[]) => unknown).apply(target, args.map(resolveRefs));
    },
    /** 取出实例供 emit（解析 $ref） */
    resolve(idOrRef: unknown): unknown {
      return resolveRefs(idOrRef);
    },
  };
}

export type SandboxObjects = ReturnType<typeof createObjectRegistry>;
