/**
 * 假 world：事件总线（1:1 惰性 hub）+ 玩家列表 + Scoreboard L2 + Dimension L2。
 */

import { createEventHub, createEventSignal, type EventSignal } from "./events.js";
import { guardAllowlist, SERVER_ALLOWLIST } from "./allowlist.js";
import type { FakePlayer } from "./player.js";
import { createFakeScoreboard, type FakeScoreboard } from "./scoreboard.js";
import { createFakeDimension, resolveDimensionId, type FakeDimension } from "./dimension.js";
import { resetEntityIdCounter } from "./entity.js";

export type FakeWorld = {
  afterEvents: Record<string, EventSignal<unknown>>;
  beforeEvents: Record<string, EventSignal<unknown>>;
  getDimension(id?: string): FakeDimension;
  getPlayers(): FakePlayer[];
  getAllPlayers(): FakePlayer[];
  scoreboard: FakeScoreboard;
  /** 沙箱内部 */
  _players: FakePlayer[];
  addPlayer(player: FakePlayer): void;
  removePlayer(id: string): void;
  reset(): void;
};

export function createFakeWorld(): FakeWorld {
  const players: FakePlayer[] = [];
  const scoreboard = createFakeScoreboard();
  const dims = new Map<string, FakeDimension>();

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
    });
    dims.set(canon, dim);
    return dim;
  };

  const api: FakeWorld = {
    afterEvents,
    beforeEvents,
    getDimension(id = "minecraft:overworld") {
      return getOrCreateDim(id);
    },
    getPlayers() {
      return [...players];
    },
    getAllPlayers() {
      return [...players];
    },
    scoreboard,
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
      for (const d of dims.values()) d.reset();
      dims.clear();
      resetEntityIdCounter();
      getOrCreateDim("minecraft:overworld");
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

  getOrCreateDim("minecraft:overworld");

  return guardAllowlist(api, SERVER_ALLOWLIST.world, "world") as FakeWorld;
}
