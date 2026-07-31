/**
 * 假 Player：对齐 Msg.* → sendMessage，并带权限等级、GameMode、runCommand 等常用字段。
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
import {
  createEntityHealthComponent,
  defaultMaxHealth,
  isHealthComponentId,
  type FakeEntityHealthComponent,
} from "./health.js";
import { guardUnimplemented } from "../unimplemented-error.js";
import { normalizeGameMode, runThinCommand, type FakeCommandResult } from "./command.js";
import { createFakeScreenDisplay, type FakeScreenDisplay } from "./screen-display.js";

export type FakeDimensionLocation = {
  dimension: FakeDimension;
  x: number;
  y: number;
  z: number;
};

export type FakePlayerComponent = FakeEntityInventoryComponent | FakeEntityHealthComponent;

export type FakePlayer = {
  id: string;
  /** Entity.typeId；玩家固定 minecraft:player */
  typeId: string;
  name: string;
  /** 头顶名牌；默认等于 name */
  nameTag: string;
  log: string[];
  /** 沙箱可观测：runCommand 记录（不含前导 /） */
  commandLog: string[];
  /** 沙箱可观测：playSound 记录 */
  soundLog: string[];
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
  readonly onScreenDisplay: FakeScreenDisplay;
  sendMessage(text: string): void;
  isValid: boolean;
  teleport(location: { x: number; y: number; z: number }, teleportOptions?: { dimension?: FakeDimension }): void;
  getTags(): string[];
  addTag(tag: string): boolean;
  removeTag(tag: string): boolean;
  hasTag(tag: string): boolean;
  getComponent(componentId: string): FakePlayerComponent | undefined;
  hasComponent(componentId: string): boolean;
  getComponents(): FakePlayerComponent[];
  getRotation(): { x: number; y: number };
  getHeadLocation(): { x: number; y: number; z: number };
  getVelocity(): { x: number; y: number; z: number };
  getGameMode(): string;
  setGameMode(gameMode?: string): void;
  getSpawnPoint(): FakeDimensionLocation | undefined;
  setSpawnPoint(spawnPoint?: FakeDimensionLocation): void;
  playSound(soundId: string | { id?: string }, soundOptions?: unknown): { id: string };
  runCommand(commandString: string): FakeCommandResult;
  /** 扣血；不模拟物理；归零则 isValid=false（不经 Dimension.remove）。 */
  applyDamage(amount: number, options?: unknown): boolean;
  kill(): boolean;
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
  /** 初始游戏模式；默认 survival */
  gameMode?: string;
  /** setGameMode 时回调（sandbox/world 用于 emit playerGameModeChange） */
  onGameModeChange?: (player: FakePlayer, from: string, to: string) => void;
  onHealthChange?: (player: FakePlayer, oldValue: number, newValue: number) => void;
  onHurt?: (player: FakePlayer, damage: number, options?: unknown) => void;
  onDie?: (player: FakePlayer) => void;
}

export function createEnginePlayer(init: FakePlayerInit): FakePlayer {
  const log: string[] = [];
  const commandLog: string[] = [];
  const soundLog: string[] = [];
  const level = init.permissionLevel ?? (init.op ? 2 /* Operator */ : 1 /* Member */);
  const dimId = init.dimensionId ?? "minecraft:overworld";
  const inventory = createEntityInventoryComponent(36);
  const tags = new Set<string>();
  let gameMode = normalizeGameMode(init.gameMode) ?? "Survival";
  let spawnPoint: FakeDimensionLocation | undefined;
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
    getEntitiesOfType: () => [],
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
    runCommand() {
      throw new Error("player.dimension 尚未绑定到 FakeWorld");
    },
    commandLog: [],
    _acceptEntity() {},
    _dropEntity() {},
    reset() {},
  } as unknown as FakeDimension;

  let player!: FakePlayer;
  const screen = createFakeScreenDisplay(() => player.isValid);
  const health = createEntityHealthComponent({
    max: defaultMaxHealth("minecraft:player"),
    onChange(oldValue, newValue) {
      init.onHealthChange?.(player, oldValue, newValue);
    },
  });

  player = {
    id: init.id ?? `player-${init.name}`,
    typeId: "minecraft:player",
    name: init.name,
    nameTag: init.nameTag ?? init.name,
    log,
    commandLog,
    soundLog,
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
    onScreenDisplay: screen,
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
      if (isHealthComponentId(componentId)) return health;
      if (isInventoryComponentId(componentId)) return inventory;
      return undefined;
    },
    hasComponent(componentId) {
      return player.getComponent(componentId) !== undefined;
    },
    getComponents() {
      return [health, inventory];
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
    getGameMode() {
      return gameMode;
    },
    setGameMode(nextRaw) {
      if (!player.isValid) throw new Error("InvalidEntityError");
      const next = normalizeGameMode(nextRaw) ?? "Survival";
      const from = gameMode;
      if (from === next) return;
      gameMode = next;
      init.onGameModeChange?.(player, from, next);
    },
    getSpawnPoint() {
      return spawnPoint ? { ...spawnPoint } : undefined;
    },
    setSpawnPoint(point) {
      if (!player.isValid) throw new Error("InvalidEntityError");
      if (point == null) {
        spawnPoint = undefined;
        return;
      }
      spawnPoint = {
        dimension: point.dimension ?? player.dimension,
        x: Number(point.x),
        y: Number(point.y),
        z: Number(point.z),
      };
    },
    playSound(soundId) {
      if (!player.isValid) throw new Error("InvalidEntityError");
      const id =
        typeof soundId === "string"
          ? soundId
          : String((soundId as { id?: string })?.id ?? soundId ?? "");
      soundLog.push(id);
      return { id };
    },
    runCommand(commandString) {
      if (!player.isValid) throw new Error("InvalidEntityError");
      return runThinCommand(commandLog, commandString, {
        onGamemode: (mode) => player.setGameMode(mode),
        selfName: player.name,
        inventory: inventory.container,
      });
    },
    applyDamage(amount, options) {
      if (!player.isValid) throw new Error("InvalidEntityError");
      const n = Number(amount);
      if (!Number.isFinite(n) || n <= 0) return false;
      const before = health.currentValue;
      health.setCurrentValue(before - n);
      const dealt = before - health.currentValue;
      if (dealt <= 0) return false;
      init.onHurt?.(player, dealt, options);
      if (health.currentValue <= 0) player.kill();
      return true;
    },
    kill() {
      if (!player.isValid) return false;
      init.onDie?.(player);
      player.isValid = false;
      return true;
    },
  };
  player.scoreboardIdentity = createPlayerScoreboardIdentity(player, () => player);
  return guardUnimplemented(player, "Player") as FakePlayer;
}
