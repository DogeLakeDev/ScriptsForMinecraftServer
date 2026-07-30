/**
 * 假 Entity — 对照 Learn + pin `.d.ts` 最小 L2。
 * `new Entity()` 硬失败；实例经 Dimension.spawnEntity。
 */

import { guardAllowlist, SERVER_ALLOWLIST, UnimplementedMinecraftApiError } from "./allowlist.js";
import type { FakeDimension, Vector3Like } from "./dimension.js";
import {
  createPlayerScoreboardIdentity,
  type FakeScoreboardIdentity,
} from "./scoreboard.js";

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

import {
  createEntityInventoryComponent,
  inventorySizeForEntityType,
  isInventoryComponentId,
  type FakeEntityInventoryComponent,
} from "./inventory.js";

export type FakeEntity = {
  id: string;
  typeId: string;
  location: Vector3Like;
  dimension: FakeDimension;
  nameTag: string;
  isValid: boolean;
  isOnGround: boolean;
  isSneaking: boolean;
  scoreboardIdentity: FakeScoreboardIdentity;
  remove(): void;
  kill(): boolean;
  teleport(location: Vector3Like, teleportOptions?: { dimension?: FakeDimension }): void;
  getComponent(componentId: string): FakeEntityInventoryComponent | undefined;
  hasComponent(componentId: string): boolean;
  getComponents(): FakeEntityInventoryComponent[];
  getTags(): string[];
  addTag(tag: string): boolean;
  removeTag(tag: string): boolean;
  hasTag(tag: string): boolean;
  getRotation(): { x: number; y: number };
  getHeadLocation(): Vector3Like;
  getVelocity(): Vector3Like;
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
  onRemove?: (entity: FakeEntity) => void;
};

export function createFakeEntity(opts: CreateFakeEntityOpts): FakeEntity {
  const typeId = normalizeEntityTypeId(opts.typeId);
  const tags = new Set<string>();
  const invSize = inventorySizeForEntityType(typeId);
  const inventory = invSize !== undefined ? createEntityInventoryComponent(invSize) : undefined;
  let loc = {
    x: Number(opts.location.x),
    y: Number(opts.location.y),
    z: Number(opts.location.z),
  };
  let dim = opts.dimension;
  let valid = true;

  const entity: FakeEntity = {
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
    scoreboardIdentity: undefined as unknown as FakeScoreboardIdentity,
    remove() {
      if (!valid) return;
      valid = false;
      opts.onRemove?.(entity);
    },
    kill() {
      if (!valid) return false;
      entity.remove();
      return true;
    },
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
      if (inventory && isInventoryComponentId(componentId)) return inventory;
      return undefined;
    },
    hasComponent(componentId) {
      return entity.getComponent(componentId) !== undefined;
    },
    getComponents() {
      return inventory ? [inventory] : [];
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
  };

  entity.scoreboardIdentity = createPlayerScoreboardIdentity(
    { name: entity.nameTag || entity.id },
    () => (valid ? entity : undefined),
    "Entity"
  );

  return guardAllowlist(entity, SERVER_ALLOWLIST.entity, "Entity") as FakeEntity;
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
