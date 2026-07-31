/**
 * 假 world：事件总线（1:1 惰性 hub）+ 玩家列表 + Scoreboard L2 + Dimension L2。
 * 规格 §6「薄」：时间 / 出生点 / sendMessage / getEntity / 动态属性 + 默认三维可查。
 */

import { createEventHub, createEventSignal, type EventSignal } from "./events.js";
import { guardUnimplemented } from "../unimplemented-error.js";
import type { FakePlayer } from "./player.js";
import { createFakeScoreboard, type FakeScoreboard } from "./scoreboard.js";
import {
  createFakeDimension,
  DEFAULT_DIMENSION_IDS,
  resolveDimensionId,
  type FakeDimension,
  type Vector3Like,
} from "./dimension.js";
import { resetEntityIdCounter, type FakeEntity } from "./entity.js";
import { runThinCommand, type FakeCommandResult } from "./command.js";

export type FakeWorld = {
  afterEvents: Record<string, EventSignal<unknown>>;
  beforeEvents: Record<string, EventSignal<unknown>>;
  /** L1 默认 */
  allowCheats: boolean;
  readonly isHardcore: boolean;
  readonly seed: string;
  scoreboard: FakeScoreboard;
  /** 沙箱可观测：runCommand / playSound */
  commandLog: string[];
  soundLog: string[];
  getDimension(id?: string): FakeDimension;
  getPlayers(): FakePlayer[];
  getAllPlayers(): FakePlayer[];
  getEntity(entityId: string): FakeEntity | FakePlayer | undefined;
  getAbsoluteTime(): number;
  setAbsoluteTime(absoluteTime: number): void;
  getDay(): number;
  getTimeOfDay(): number;
  setTimeOfDay(timeOfDay: number | string): void;
  getDefaultSpawnLocation(): Vector3Like;
  setDefaultSpawnLocation(location: Vector3Like): void;
  sendMessage(message: string | Record<string, unknown>): void;
  playSound(soundId: string, location: Vector3Like, soundOptions?: unknown): { id: string };
  runCommand(commandString: string): FakeCommandResult;
  clearDynamicProperties(): void;
  getDynamicProperty(id: string): unknown;
  getDynamicPropertyIds(): string[];
  getDynamicPropertyTotalByteCount(): number;
  setDynamicProperty(id: string, value?: unknown): void;
  setDynamicProperties(values: Record<string, unknown>): void;
  /** 沙箱内部 */
  _players: FakePlayer[];
  addPlayer(player: FakePlayer): void;
  removePlayer(id: string): void;
  reset(): void;
};

const TICKS_PER_DAY = 24000;

function normalizeTimeOfDay(timeOfDay: number | string): number {
  if (typeof timeOfDay === "number" && Number.isFinite(timeOfDay)) {
    return ((Math.floor(timeOfDay) % TICKS_PER_DAY) + TICKS_PER_DAY) % TICKS_PER_DAY;
  }
  const named: Record<string, number> = {
    Day: 1000,
    Noon: 6000,
    Sunset: 12000,
    Night: 13000,
    Midnight: 18000,
    Sunrise: 23000,
  };
  const key = String(timeOfDay);
  if (key in named) return named[key]!;
  const n = Number(key);
  if (Number.isFinite(n)) {
    return ((Math.floor(n) % TICKS_PER_DAY) + TICKS_PER_DAY) % TICKS_PER_DAY;
  }
  return 0;
}

export function createFakeWorld(): FakeWorld {
  const players: FakePlayer[] = [];
  const scoreboard = createFakeScoreboard();
  const dims = new Map<string, FakeDimension>();
  const dynamicProps = new Map<string, unknown>();
  const commandLog: string[] = [];
  const soundLog: string[] = [];
  let absoluteTime = 0;
  let defaultSpawn: Vector3Like = { x: 0, y: 64, z: 0 };
  let allowCheats = true;

  const afterEvents = createEventHub({
    worldLoad: createEventSignal(),
    playerSpawn: createEventSignal(),
    playerJoin: createEventSignal(),
    playerLeave: createEventSignal(),
    chatSend: createEventSignal(),
    entityDie: createEventSignal(),
    entityHurt: createEventSignal(),
    entityHealthChanged: createEventSignal(),
    entityHitEntity: createEventSignal(),
    itemUse: createEventSignal(),
    playerBreakBlock: createEventSignal(),
    /** 旧别名；pin 为 playerBreakBlock */
    blockBreak: createEventSignal(),
    entitySpawn: createEventSignal(),
    playerGameModeChange: createEventSignal(),
  });
  const beforeEvents = createEventHub({
    chatSend: createEventSignal(),
    playerSpawn: createEventSignal(),
    itemUse: createEventSignal(),
    playerBreakBlock: createEventSignal(),
    playerLeave: createEventSignal(),
    playerGameModeChange: createEventSignal(),
  });

  const getOrCreateDim = (rawId: string): FakeDimension => {
    const canon = resolveDimensionId(rawId);
    const existing = dims.get(canon);
    if (existing) return existing;
    const dim = createFakeDimension(canon, {
      getPlayers: () => players.filter((p) => p.dimension.id === canon),
      onEntitySpawn: (entity) => {
        afterEvents.entitySpawn!.emit({ entity });
      },
      onEntityDie: (entity) => {
        afterEvents.entityDie!.emit({ deadEntity: entity, damageSource: { cause: "none" } });
      },
      onEntityHealthChange: (entity, oldValue, newValue) => {
        afterEvents.entityHealthChanged!.emit({ entity, oldValue, newValue });
      },
      onEntityHurt: (entity, damage, options) => {
        const cause =
          options && typeof options === "object" && "cause" in (options as object)
            ? (options as { cause?: unknown }).cause
            : "none";
        afterEvents.entityHurt!.emit({
          hurtEntity: entity,
          damage,
          damageSource: { cause: cause ?? "none" },
        });
      },
    });
    dims.set(canon, dim);
    return dim;
  };

  const ensureDefaultDims = () => {
    for (const id of DEFAULT_DIMENSION_IDS) getOrCreateDim(id);
  };

  const api: FakeWorld = {
    afterEvents,
    beforeEvents,
    get allowCheats() {
      return allowCheats;
    },
    set allowCheats(v: boolean) {
      allowCheats = Boolean(v);
    },
    isHardcore: false,
    seed: "sfmc-testing",
    scoreboard,
    commandLog,
    soundLog,
    getDimension(id = "minecraft:overworld") {
      return getOrCreateDim(id);
    },
    getPlayers() {
      return [...players];
    },
    getAllPlayers() {
      return [...players];
    },
    getEntity(entityId) {
      const id = String(entityId ?? "");
      const player = players.find((p) => p.id === id);
      if (player) return player;
      for (const dim of dims.values()) {
        const hit = dim.getEntities().find((e) => e.id === id);
        if (hit) return hit;
      }
      return undefined;
    },
    getAbsoluteTime() {
      return absoluteTime;
    },
    setAbsoluteTime(t) {
      absoluteTime = Math.max(0, Math.floor(Number(t) || 0));
    },
    getDay() {
      return Math.floor(absoluteTime / TICKS_PER_DAY);
    },
    getTimeOfDay() {
      return absoluteTime % TICKS_PER_DAY;
    },
    setTimeOfDay(timeOfDay) {
      const tod = normalizeTimeOfDay(timeOfDay);
      absoluteTime = Math.floor(absoluteTime / TICKS_PER_DAY) * TICKS_PER_DAY + tod;
    },
    getDefaultSpawnLocation() {
      return { ...defaultSpawn };
    },
    setDefaultSpawnLocation(location) {
      defaultSpawn = {
        x: Number(location.x),
        y: Number(location.y),
        z: Number(location.z),
      };
    },
    sendMessage(message) {
      const text =
        typeof message === "string"
          ? message
          : (() => {
              try {
                return JSON.stringify(message);
              } catch {
                return String(message);
              }
            })();
      for (const p of players) p.sendMessage(text);
    },
    playSound(soundId, _location, _soundOptions) {
      const id = String(soundId ?? "");
      soundLog.push(id);
      return { id };
    },
    runCommand(commandString) {
      return runThinCommand(commandLog, commandString);
    },
    clearDynamicProperties() {
      dynamicProps.clear();
    },
    getDynamicProperty(id) {
      return dynamicProps.get(String(id));
    },
    getDynamicPropertyIds() {
      return [...dynamicProps.keys()];
    },
    getDynamicPropertyTotalByteCount() {
      let n = 0;
      for (const [k, v] of dynamicProps) {
        n += k.length;
        if (typeof v === "string") n += v.length;
        else if (typeof v === "number" || typeof v === "boolean") n += 8;
      }
      return n;
    },
    setDynamicProperty(id, value) {
      const key = String(id);
      if (value === undefined) dynamicProps.delete(key);
      else dynamicProps.set(key, value);
    },
    setDynamicProperties(values) {
      for (const [k, v] of Object.entries(values ?? {})) {
        api.setDynamicProperty(k, v);
      }
    },
    _players: players,
    addPlayer(player) {
      if (!players.some((p) => p.id === player.id)) {
        players.push(player);
        if (player.scoreboardIdentity) {
          scoreboard._registerIdentity(player.scoreboardIdentity);
        }
      }
    },
    removePlayer(id) {
      const i = players.findIndex((p) => p.id === id);
      if (i < 0) return;
      const [player] = players.splice(i, 1);
      if (!player) return;
      beforeEvents.playerLeave!.emit({ player, playerId: player.id });
      afterEvents.playerLeave!.emit({ playerName: player.name, playerId: player.id });
    },
    reset() {
      players.length = 0;
      scoreboard.reset();
      dynamicProps.clear();
      commandLog.length = 0;
      soundLog.length = 0;
      absoluteTime = 0;
      defaultSpawn = { x: 0, y: 64, z: 0 };
      allowCheats = true;
      for (const d of dims.values()) d.reset();
      dims.clear();
      resetEntityIdCounter();
      ensureDefaultDims();
      (
        afterEvents as unknown as {
          _clearAll(): void;
        }
      )._clearAll();
      (
        beforeEvents as unknown as {
          _clearAll(): void;
        }
      )._clearAll();
    },
  };

  ensureDefaultDims();

  return guardUnimplemented(api, "world") as FakeWorld;
}

