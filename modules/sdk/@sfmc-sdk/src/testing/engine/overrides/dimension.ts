/**
 * 假 Dimension / Block / BlockPermutation — 对照 Learn + pin `.d.ts` 最小 L2。
 *
 * 沙箱策略：不模拟未加载区块；`getBlock` 恒返回方块引用，缺省为空气（非 undefined）。
 */

import { guardUnimplemented, UnimplementedMinecraftApiError } from "../unimplemented-error.js";
import type { FakePlayer } from "./player.js";
import {
  createFakeEntity,
  filterEntities,
  type FakeEntity,
  type FakeEntityQueryOptions,
} from "./entity.js";
import { runThinCommand, type FakeCommandResult } from "./command.js";

export type Vector3Like = { x: number; y: number; z: number };

export type FakeBlockType = {
  id: string;
};

export type FakeBlockPermutation = {
  localizationKey: string;
  type: FakeBlockType;
  getAllStates(): Record<string, boolean | number | string>;
  getState(stateName: string): boolean | number | string | undefined;
  withState(name: string, value: boolean | number | string): FakeBlockPermutation;
  matches(blockName: string, states?: Record<string, boolean | number | string>): boolean;
  hasTag(_tag: string): boolean;
  getTags(): string[];
};

export type FakeBlock = {
  dimension: FakeDimension;
  x: number;
  y: number;
  z: number;
  location: Vector3Like;
  isValid: boolean;
  readonly isAir: boolean;
  readonly isLiquid: boolean;
  readonly isWaterlogged: boolean;
  readonly typeId: string;
  readonly type: FakeBlockType;
  readonly permutation: FakeBlockPermutation;
  setPermutation(permutation: FakeBlockPermutation): void;
  setType(blockType: FakeBlockType | string): void;
};

export type FakeDimension = {
  id: string;
  localizationKey: string;
  heightRange: { min: number; max: number };
  /** 沙箱可观测：runCommand 记录 */
  commandLog: string[];
  getBlock(location: Vector3Like): FakeBlock;
  setBlockPermutation(location: Vector3Like, permutation: FakeBlockPermutation): void;
  setBlockType(location: Vector3Like, blockType: FakeBlockType | string): void;
  getEntities(options?: FakeEntityQueryOptions): FakeEntity[];
  getEntitiesAtBlockLocation(location: Vector3Like): FakeEntity[];
  /** 糖：等价 getEntities({ typeId })；pin 无此方法，沙箱可调。 */
  getEntitiesOfType(entityType: string): FakeEntity[];
  getPlayers(): FakePlayer[];
  /** options.id：沙箱登记用稳定 id（对齐 objects.create Entity） */
  spawnEntity(identifier: string, location: Vector3Like, options?: { id?: string }): FakeEntity;
  /** 掉落物：生成 `minecraft:item` 实体（无物理）。 */
  spawnItem(itemStack: { typeId?: string }, location: Vector3Like): FakeEntity;
  /** 沙箱不模拟未加载区块，恒 true。 */
  isChunkLoaded(_location: Vector3Like): boolean;
  getWeather(): string;
  setWeather(weatherType: string): void;
  runCommand(commandString: string): FakeCommandResult;
  /** 沙箱内部 */
  _acceptEntity(entity: FakeEntity): void;
  _dropEntity(entity: FakeEntity): void;
  reset(): void;
};

export type FakeDimensionHooks = {
  getPlayers: () => FakePlayer[];
  onEntitySpawn?: (entity: FakeEntity) => void;
  onEntityDie?: (entity: FakeEntity, options?: unknown) => void;
  onEntityHealthChange?: (entity: FakeEntity, oldValue: number, newValue: number) => void;
  onEntityHurt?: (entity: FakeEntity, damage: number, options?: unknown) => void;
};

/** 规格 §6：默认三维（overworld / nether / the_end）。 */
export const DEFAULT_DIMENSION_IDS = [
  "minecraft:overworld",
  "minecraft:nether",
  "minecraft:the_end",
] as const;

function normalizeTypeId(id: string): string {
  const s = String(id ?? "").trim();
  if (!s) return "minecraft:air";
  return s.includes(":") ? s : `minecraft:${s}`;
}

function floorLoc(location: Vector3Like): { x: number; y: number; z: number } {
  return {
    x: Math.floor(Number(location.x)),
    y: Math.floor(Number(location.y)),
    z: Math.floor(Number(location.z)),
  };
}

function cellKey(loc: { x: number; y: number; z: number }): string {
  return `${loc.x},${loc.y},${loc.z}`;
}

export function createBlockPermutation(
  blockName: string,
  states: Record<string, boolean | number | string> = {}
): FakeBlockPermutation {
  const typeId = normalizeTypeId(blockName);
  const stateCopy = { ...states };
  const perm: FakeBlockPermutation = {
    localizationKey: `tile.${typeId.replace(/^minecraft:/, "")}.name`,
    type: { id: typeId },
    getAllStates() {
      return { ...stateCopy };
    },
    getState(stateName) {
      return stateCopy[stateName];
    },
    withState(name, value) {
      return createBlockPermutation(typeId, { ...stateCopy, [name]: value });
    },
    matches(blockName, states) {
      if (normalizeTypeId(blockName) !== typeId) return false;
      if (!states) return true;
      for (const [k, v] of Object.entries(states)) {
        if (stateCopy[k] !== v) return false;
      }
      return true;
    },
    hasTag(_tag) {
      return false;
    },
    getTags() {
      return [];
    },
  };
  return guardUnimplemented(perm, "BlockPermutation") as FakeBlockPermutation;
}

/** 对齐 `BlockPermutation.resolve`；`new BlockPermutation()` 硬失败。 */
export const BlockPermutation = Object.assign(
  function BlockPermutationCtor(): never {
    throw new UnimplementedMinecraftApiError("new BlockPermutation()");
  },
  {
    resolve(blockName: string, states?: Record<string, boolean | number | string>): FakeBlockPermutation {
      return createBlockPermutation(blockName, states ?? {});
    },
  }
);

const AIR = () => createBlockPermutation("minecraft:air");

const HEIGHT: Record<string, { min: number; max: number }> = {
  "minecraft:overworld": { min: -64, max: 320 },
  "minecraft:nether": { min: 0, max: 128 },
  "minecraft:the_end": { min: 0, max: 256 },
};

function resolveDimensionId(id: string): string {
  const raw = String(id || "minecraft:overworld").trim();
  const aliases: Record<string, string> = {
    overworld: "minecraft:overworld",
    nether: "minecraft:nether",
    the_end: "minecraft:the_end",
    end: "minecraft:the_end",
  };
  if (aliases[raw]) return aliases[raw];
  return raw.includes(":") ? raw : `minecraft:${raw}`;
}

export { resolveDimensionId };

export function createFakeDimension(id: string, hooks: FakeDimensionHooks): FakeDimension {
  const dimId = resolveDimensionId(id);
  const cells = new Map<string, FakeBlockPermutation>();
  const entities: FakeEntity[] = [];
  const commandLog: string[] = [];
  /** Clear / Rain / Thunder — 无物理，仅状态袋。 */
  let weather = "Clear";

  let dim!: FakeDimension;
  const api: FakeDimension = {
    id: dimId,
    localizationKey: `dimension.${dimId.replace(/^minecraft:/, "")}`,
    heightRange: HEIGHT[dimId] ?? { min: -64, max: 320 },
    commandLog,
    getBlock(location) {
      const loc = floorLoc(location);
      const key = cellKey(loc);
      const readPerm = () => cells.get(key) ?? AIR();
      const block: FakeBlock = {
        dimension: dim,
        x: loc.x,
        y: loc.y,
        z: loc.z,
        location: { x: loc.x, y: loc.y, z: loc.z },
        isValid: true,
        get isAir() {
          return readPerm().type.id === "minecraft:air";
        },
        get isLiquid() {
          const tid = readPerm().type.id;
          return tid === "minecraft:water" || tid === "minecraft:lava";
        },
        isWaterlogged: false,
        get typeId() {
          return readPerm().type.id;
        },
        get type() {
          return readPerm().type;
        },
        get permutation() {
          return readPerm();
        },
        setPermutation(permutation) {
          const p = permutation ?? AIR();
          if (p.type.id === "minecraft:air" && Object.keys(p.getAllStates()).length === 0) {
            cells.delete(key);
          } else {
            cells.set(key, p);
          }
        },
        setType(blockType) {
          const tid = typeof blockType === "string" ? blockType : blockType.id;
          block.setPermutation(createBlockPermutation(tid));
        },
      };
      return guardUnimplemented(block, "Block") as FakeBlock;
    },
    setBlockPermutation(location, permutation) {
      dim.getBlock(location).setPermutation(permutation);
    },
    setBlockType(location, blockType) {
      dim.getBlock(location).setType(blockType);
    },
    getEntities(options) {
      return filterEntities(entities, options);
    },
    getEntitiesAtBlockLocation(location) {
      const loc = floorLoc(location);
      return entities.filter((e) => {
        if (!e.isValid) return false;
        const p = e.location;
        return Math.floor(p.x) === loc.x && Math.floor(p.y) === loc.y && Math.floor(p.z) === loc.z;
      });
    },
    getEntitiesOfType(entityType) {
      return filterEntities(entities, { typeId: String(entityType ?? "") });
    },
    getPlayers() {
      return hooks.getPlayers();
    },
    spawnEntity(identifier, location, options) {
      const entity = createFakeEntity({
        typeId: identifier,
        location,
        dimension: dim,
        ...(options?.id ? { id: options.id } : {}),
        onDie: (e, options) => hooks.onEntityDie?.(e, options),
        onRemove: (e) => {
          const i = entities.indexOf(e);
          if (i >= 0) entities.splice(i, 1);
        },
        onHealthChange: (e, oldValue, newValue) => hooks.onEntityHealthChange?.(e, oldValue, newValue),
        onHurt: (e, damage, options) => hooks.onEntityHurt?.(e, damage, options),
      });
      entities.push(entity);
      hooks.onEntitySpawn?.(entity);
      return entity;
    },
    spawnItem(itemStack, location) {
      const typeId =
        itemStack && typeof itemStack.typeId === "string" ? itemStack.typeId : "minecraft:air";
      const entity = dim.spawnEntity("minecraft:item", location);
      entity.nameTag = typeId;
      return entity;
    },
    isChunkLoaded(_location) {
      return true;
    },
    getWeather() {
      return weather;
    },
    setWeather(weatherType) {
      weather = String(weatherType ?? "Clear");
    },
    runCommand(commandString) {
      return runThinCommand(commandLog, commandString);
    },
    _acceptEntity(entity) {
      if (!entities.includes(entity)) entities.push(entity);
    },
    _dropEntity(entity) {
      const i = entities.indexOf(entity);
      if (i >= 0) entities.splice(i, 1);
    },
    reset() {
      cells.clear();
      weather = "Clear";
      commandLog.length = 0;
      for (const e of [...entities]) {
        if (e.isValid) e.remove();
      }
      entities.length = 0;
    },
  };

  dim = guardUnimplemented(api, "Dimension") as FakeDimension;
  return dim;
}

/** `new Dimension()` 硬失败；实例仅经 world.getDimension。 */
export const Dimension = function DimensionCtor(): never {
  throw new UnimplementedMinecraftApiError("new Dimension()");
};
