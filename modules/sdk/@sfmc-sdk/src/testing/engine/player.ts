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

export type FakePlayer = {
  id: string;
  /** Entity.typeId；玩家固定 minecraft:player */
  typeId: string;
  name: string;
  /** 头顶名牌；默认等于 name */
  nameTag: string;
  log: string[];
  playerPermissionLevel: number;
  location: { x: number; y: number; z: number };
  dimension: FakeDimension;
  scoreboardIdentity: FakeScoreboardIdentity;
  sendMessage(text: string): void;
  isValid: boolean;
  getComponent(componentId: string): FakeEntityInventoryComponent | undefined;
  hasComponent(componentId: string): boolean;
  getComponents(): FakeEntityInventoryComponent[];
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
    getPlayers: () => [] as FakePlayer[],
    spawnEntity() {
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
    location: init.location ?? { x: 0, y: 64, z: 0 },
    dimension: placeholderDim,
    scoreboardIdentity: undefined as unknown as FakeScoreboardIdentity,
    isValid: true,
    sendMessage(text: string) {
      log.push(String(text ?? ""));
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
  };
  player.scoreboardIdentity = createPlayerScoreboardIdentity(player, () => player);
  return player;
}
