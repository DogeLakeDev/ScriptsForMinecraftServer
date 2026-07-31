/**
 * 假 Entity — 对照 Learn + pin `.d.ts` 最小 L2。
 * `new Entity()` 硬失败；实例经 Dimension.spawnEntity。
 */

import { guardUnimplemented, UnimplementedMinecraftApiError } from "../unimplemented-error.js";
import type { FakeDimension, Vector3Like } from "./dimension.js";
import {
  createPlayerScoreboardIdentity,
  type FakeScoreboardIdentity,
} from "./scoreboard.js";
import { runThinCommand, type FakeCommandResult } from "./command.js";
import {
  createEntityInventoryComponent,
  inventorySizeForEntityType,
  isInventoryComponentId,
  type FakeEntityInventoryComponent,
} from "./inventory.js";
import {
  createEntityHealthComponent,
  defaultMaxHealth,
  isHealthComponentId,
  type FakeEntityHealthComponent,
} from "./health.js";
import {
  createEffectBagMethods,
  type FakeEffect,
  type FakeEntityEffectOptions,
} from "./effect.js";

export type FakeEntityQueryOptions = {
  type?: string;
  typeId?: string;
  location?: Vector3Like;
  maxDistance?: number;
  closest?: number;
  tags?: string[];
  excludeTypes?: string[];
  excludeTags?: string[];
};

export type FakeEntityComponent = FakeEntityInventoryComponent | FakeEntityHealthComponent;

export type FakeEntity = {
  id: string;
  typeId: string;
  location: Vector3Like;
  dimension: FakeDimension;
  nameTag: string;
  isValid: boolean;
  isOnGround: boolean;
  isSneaking: boolean;
  /** d.ts 可写：名牌深度测试 / 渲染距离（薄 L2） */
  nameplateDepthTested: boolean;
  nameplateRenderDistance: number;
  scoreboardIdentity: FakeScoreboardIdentity;
  /** 沙箱可观测：runCommand 记录 */
  commandLog: string[];
  remove(): void;
  /** options 透传至 onDie（对齐致死 applyDamage 的 damageSource）。 */
  kill(options?: unknown): boolean;
  /** 扣血；<=0 返回 false；血量归零则 kill。不模拟护甲/击退。 */
  applyDamage(amount: number, options?: unknown): boolean;
  /** 效果状态袋；不模拟粒子 / 周期伤害。 */
  addEffect(
    effectType: string | { getName(): string },
    duration: number,
    options?: FakeEntityEffectOptions
  ): FakeEffect | undefined;
  getEffect(effectType: string | { getName(): string }): FakeEffect | undefined;
  getEffects(): FakeEffect[];
  removeEffect(effectType: string | { getName(): string }): boolean;
  teleport(location: Vector3Like, teleportOptions?: { dimension?: FakeDimension }): void;
  getComponent(componentId: string): FakeEntityComponent | undefined;
  hasComponent(componentId: string): boolean;
  getComponents(): FakeEntityComponent[];
  getTags(): string[];
  addTag(tag: string): boolean;
  removeTag(tag: string): boolean;
  hasTag(tag: string): boolean;
  getRotation(): { x: number; y: number };
  getHeadLocation(): Vector3Like;
  getVelocity(): Vector3Like;
  runCommand(commandString: string): FakeCommandResult;
};

function normalizeEntityTypeId(id: string): string {
  let s = String(id ?? "").trim();
  // 忽略事件后缀 horse<minecraft:ageable_grow_up>
  const angle = s.indexOf("<");
  if (angle >= 0) s = s.slice(0, angle);
  if (!s) return "minecraft:unknown";
  return s.includes(":") ? s : `minecraft:${s}`;
}

let nextEntityId = 1;

export type CreateFakeEntityOpts = {
  typeId: string;
  location: Vector3Like;
  dimension: FakeDimension;
  id?: string;
  nameTag?: string;
  /** kill() 时先于 remove 调用（对齐 entityDie）；options 来自致死 applyDamage。 */
  onDie?: (entity: FakeEntity, options?: unknown) => void;
  onRemove?: (entity: FakeEntity) => void;
  /** 生命值变化（entityHealthChanged）。 */
  onHealthChange?: (entity: FakeEntity, oldValue: number, newValue: number) => void;
  /** 受伤（entityHurt）；不模拟物理。 */
  onHurt?: (entity: FakeEntity, damage: number, options?: unknown) => void;
};

export function createFakeEntity(opts: CreateFakeEntityOpts): FakeEntity {
  const typeId = normalizeEntityTypeId(opts.typeId);
  const tags = new Set<string>();
  const commandLog: string[] = [];
  const invSize = inventorySizeForEntityType(typeId);
  const inventory = invSize !== undefined ? createEntityInventoryComponent(invSize) : undefined;
  let entity!: FakeEntity;
  const health = createEntityHealthComponent({
    max: defaultMaxHealth(typeId),
    onChange(oldValue, newValue) {
      opts.onHealthChange?.(entity, oldValue, newValue);
    },
  });
  let loc = {
    x: Number(opts.location.x),
    y: Number(opts.location.y),
    z: Number(opts.location.z),
  };
  let dim = opts.dimension;
  let valid = true;
  const effects = createEffectBagMethods(() => valid);

  entity = {
    id: opts.id ?? `entity-${nextEntityId++}`,
    typeId,
    get location() {
      return { ...loc };
    },
    get dimension() {
      return dim;
    },
    nameTag: opts.nameTag ?? "",
    get isValid() {
      return valid;
    },
    isOnGround: true,
    isSneaking: false,
    nameplateDepthTested: true,
    nameplateRenderDistance: 64,
    scoreboardIdentity: undefined as unknown as FakeScoreboardIdentity,
    commandLog,
    remove() {
      if (!valid) return;
      valid = false;
      opts.onRemove?.(entity);
    },
    kill(options?: unknown) {
      if (!valid) return false;
      opts.onDie?.(entity, options);
      entity.remove();
      return true;
    },
    applyDamage(amount, options) {
      if (!valid) throw new Error("InvalidEntityError");
      const n = Number(amount);
      if (!Number.isFinite(n) || n <= 0) return false;
      const before = health.currentValue;
      health.setCurrentValue(before - n);
      const dealt = before - health.currentValue;
      if (dealt <= 0) return false;
      opts.onHurt?.(entity, dealt, options);
      if (health.currentValue <= 0) entity.kill(options);
      return true;
    },
    addEffect: effects.addEffect,
    getEffect: effects.getEffect,
    getEffects: effects.getEffects,
    removeEffect: effects.removeEffect,
    teleport(location, teleportOptions) {
      if (!valid) throw new Error("InvalidEntityError");
      loc = {
        x: Number(location.x),
        y: Number(location.y),
        z: Number(location.z),
      };
      const nextDim = teleportOptions?.dimension;
      if (nextDim && nextDim !== dim) {
        dim._dropEntity?.(entity);
        nextDim._acceptEntity?.(entity);
        dim = nextDim;
      }
    },
    getComponent(componentId) {
      if (!valid) return undefined;
      if (isHealthComponentId(componentId)) return health;
      if (inventory && isInventoryComponentId(componentId)) return inventory;
      return undefined;
    },
    hasComponent(componentId) {
      return entity.getComponent(componentId) !== undefined;
    },
    getComponents() {
      const list: FakeEntityComponent[] = [health];
      if (inventory) list.push(inventory);
      return list;
    },
    getTags() {
      return [...tags];
    },
    addTag(tag) {
      if (tags.has(tag)) return false;
      tags.add(tag);
      return true;
    },
    removeTag(tag) {
      return tags.delete(tag);
    },
    hasTag(tag) {
      return tags.has(tag);
    },
    getRotation() {
      return { x: 0, y: 0 };
    },
    getHeadLocation() {
      return { x: loc.x, y: loc.y + 1.62, z: loc.z };
    },
    getVelocity() {
      return { x: 0, y: 0, z: 0 };
    },
    runCommand(commandString) {
      if (!valid) throw new Error("InvalidEntityError");
      return runThinCommand(
        commandLog,
        commandString,
        inventory ? { inventory: inventory.container } : undefined
      );
    },
  };

  entity.scoreboardIdentity = createPlayerScoreboardIdentity(
    { name: entity.nameTag || entity.id },
    () => (valid ? entity : undefined),
    "Entity"
  );

  return guardUnimplemented(entity, "Entity") as FakeEntity;
}

/** `new Entity()` 硬失败。 */
export const Entity = function EntityCtor(): never {
  throw new UnimplementedMinecraftApiError("new Entity()");
};

export function resetEntityIdCounter(): void {
  nextEntityId = 1;
}

export function filterEntities(
  list: FakeEntity[],
  options?: FakeEntityQueryOptions
): FakeEntity[] {
  let out = list.filter((e) => e.isValid);
  if (!options) return out;

  const typeFilter = options.typeId ?? options.type;
  if (typeFilter) {
    const want = normalizeEntityTypeId(typeFilter);
    out = out.filter((e) => e.typeId === want);
  }
  if (options.excludeTypes?.length) {
    const excl = new Set(options.excludeTypes.map(normalizeEntityTypeId));
    out = out.filter((e) => !excl.has(e.typeId));
  }
  if (options.tags?.length) {
    out = out.filter((e) => options.tags!.every((t) => e.hasTag(t)));
  }
  if (options.excludeTags?.length) {
    out = out.filter((e) => !options.excludeTags!.some((t) => e.hasTag(t)));
  }
  if (options.location && options.maxDistance !== undefined) {
    const origin = options.location;
    const maxD = options.maxDistance;
    out = out.filter((e) => {
      const dx = e.location.x - origin.x;
      const dy = e.location.y - origin.y;
      const dz = e.location.z - origin.z;
      return dx * dx + dy * dy + dz * dz <= maxD * maxD;
    });
  }
  if (options.location && options.closest !== undefined) {
    const origin = options.location;
    out = [...out].sort((a, b) => {
      const da =
        (a.location.x - origin.x) ** 2 +
        (a.location.y - origin.y) ** 2 +
        (a.location.z - origin.z) ** 2;
      const db =
        (b.location.x - origin.x) ** 2 +
        (b.location.y - origin.y) ** 2 +
        (b.location.z - origin.z) ** 2;
      return da - db;
    });
    out = out.slice(0, Math.max(0, options.closest));
  }
  return out;
}

export { normalizeEntityTypeId };
