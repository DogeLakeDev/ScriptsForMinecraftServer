/**
 * 假 Player：对齐 Msg.* → sendMessage，并带权限等级等常用字段。
 */

import {
  createPlayerScoreboardIdentity,
  type FakeScoreboardIdentity,
} from "./scoreboard.js";
import type { FakeDimension } from "./dimension.js";
import {
  createEntityInventoryComponent,
  isInventoryComponentId,
  type FakeEntityInventoryComponent,
} from "./inventory.js";
import { guardUnimplemented } from "../unimplemented-error.js";

export type FakePlayer = {
  id: string;
  /** Entity.typeId；玩家固定 minecraft:player */
  typeId: string;
  name: string;
  /** 头顶名牌；默认等于 name */
  nameTag: string;
  log: string[];
  playerPermissionLevel: number;
  /** d.ts 可写：命令权限等级（薄 L2，数字存） */
  commandPermissionLevel: number;
  /** d.ts 可写：热键栏槽位 */
  selectedSlotIndex: number;
  chatMessagePrefix: string;
  chatNamePrefix: string;
  chatNameSuffix: string;
  isSneaking: boolean;
  nameplateDepthTested: boolean;
  nameplateRenderDistance: number;
  location: { x: number; y: number; z: number };
  dimension: FakeDimension;
  scoreboardIdentity: FakeScoreboardIdentity;
  sendMessage(text: string): void;
  isValid: boolean;
  teleport(location: { x: number; y: number; z: number }, teleportOptions?: { dimension?: FakeDimension }): void;
  getTags(): string[];
  addTag(tag: string): boolean;
  removeTag(tag: string): boolean;
  hasTag(tag: string): boolean;
  getComponent(componentId: string): FakeEntityInventoryComponent | undefined;
  hasComponent(componentId: string): boolean;
  getComponents(): FakeEntityInventoryComponent[];
  getRotation(): { x: number; y: number };
  getHeadLocation(): { x: number; y: number; z: number };
  getVelocity(): { x: number; y: number; z: number };
};

export interface FakePlayerInit {
  id?: string;
  name: string;
  /** 对应 PlayerPermissionLevel：0 Visitor / 1 Member / 2 Operator / 3 Custom */
  op?: boolean;
  permissionLevel?: number;
  location?: { x: number; y: number; z: number };
  nameTag?: string;
  dimensionId?: string;
}

export function createEnginePlayer(init: FakePlayerInit): FakePlayer {
  const log: string[] = [];
  const level = init.permissionLevel ?? (init.op ? 2 /* Operator */ : 1 /* Member */);
  const dimId = init.dimensionId ?? "minecraft:overworld";
  const inventory = createEntityInventoryComponent(36);
  const tags = new Set<string>();
  // dimension 由 sandbox/world.addPlayer 前替换为世界内真维度；此处先放占位 id
  const placeholderDim = {
    id: dimId.includes(":") ? dimId : `minecraft:${dimId}`,
    localizationKey: "",
    heightRange: { min: -64, max: 320 },
    getBlock() {
      throw new Error("player.dimension 尚未绑定到 FakeWorld；请经 createSandbox().addPlayer 添加");
    },
    setBlockPermutation() {
      throw new Error("player.dimension 尚未绑定到 FakeWorld");
    },
    setBlockType() {
      throw new Error("player.dimension 尚未绑定到 FakeWorld");
    },
    getEntities: () => [],
    getEntitiesAtBlockLocation: () => [],
    getPlayers: () => [] as FakePlayer[],
    spawnEntity() {
      throw new Error("player.dimension 尚未绑定到 FakeWorld");
    },
    spawnItem() {
      throw new Error("player.dimension 尚未绑定到 FakeWorld");
    },
    isChunkLoaded: () => true,
    getWeather: () => "Clear",
    setWeather() {
      throw new Error("player.dimension 尚未绑定到 FakeWorld");
    },
    _acceptEntity() {},
    _dropEntity() {},
    reset() {},
  } as FakeDimension;

  const player: FakePlayer = {
    id: init.id ?? `player-${init.name}`,
    typeId: "minecraft:player",
    name: init.name,
    nameTag: init.nameTag ?? init.name,
    log,
    playerPermissionLevel: level,
    commandPermissionLevel: level,
    selectedSlotIndex: 0,
    chatMessagePrefix: "",
    chatNamePrefix: "",
    chatNameSuffix: "",
    isSneaking: false,
    nameplateDepthTested: true,
    nameplateRenderDistance: 64,
    location: init.location ?? { x: 0, y: 64, z: 0 },
    dimension: placeholderDim,
    scoreboardIdentity: undefined as unknown as FakeScoreboardIdentity,
    isValid: true,
    sendMessage(text: string) {
      log.push(String(text ?? ""));
    },
    teleport(location, teleportOptions) {
      if (!player.isValid) throw new Error("InvalidEntityError");
      player.location = {
        x: Number(location.x),
        y: Number(location.y),
        z: Number(location.z),
      };
      const nextDim = teleportOptions?.dimension;
      if (nextDim) player.dimension = nextDim;
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
    getComponent(componentId) {
      if (!player.isValid) return undefined;
      if (isInventoryComponentId(componentId)) return inventory;
      return undefined;
    },
    hasComponent(componentId) {
      return player.getComponent(componentId) !== undefined;
    },
    getComponents() {
      return [inventory];
    },
    getRotation() {
      return { x: 0, y: 0 };
    },
    getHeadLocation() {
      const loc = player.location;
      return { x: loc.x, y: loc.y + 1.62, z: loc.z };
    },
    getVelocity() {
      return { x: 0, y: 0, z: 0 };
    },
  };
  player.scoreboardIdentity = createPlayerScoreboardIdentity(player, () => player);
  return guardUnimplemented(player, "Player") as FakePlayer;
}
