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

export type FakeWorld = {
  afterEvents: Record<string, EventSignal<unknown>>;
  beforeEvents: Record<string, EventSignal<unknown>>;
  /** L1 默认 */
  allowCheats: boolean;
  readonly isHardcore: boolean;
  readonly seed: string;
  scoreboard: FakeScoreboard;
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
  let absoluteTime = 0;
  let defaultSpawn: Vector3Like = { x: 0, y: 64, z: 0 };
  let allowCheats = true;

  const afterEvents = createEventHub({
    worldLoad: createEventSignal(),
    playerSpawn: createEventSignal(),
    playerJoin: createEventSignal(),
    chatSend: createEventSignal(),
    entityDie: createEventSignal(),
    itemUse: createEventSignal(),
    blockBreak: createEventSignal(),
    entitySpawn: createEventSignal(),
  });
  const beforeEvents = createEventHub({
    chatSend: createEventSignal(),
    playerSpawn: createEventSignal(),
    itemUse: createEventSignal(),
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
      if (i >= 0) players.splice(i, 1);
    },
    reset() {
      players.length = 0;
      scoreboard.reset();
      dynamicProps.clear();
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
