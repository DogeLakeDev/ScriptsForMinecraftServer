/**
 * 假引擎进程内单例（挂 globalThis，避免 testing 与 mc-bridge 双份 bundle 状态分裂）。
 */

import { createFakeSystem, type FakeSystem } from "./overrides/system.js";
import { createFakeWorld, type FakeWorld } from "./overrides/world.js";
import { createEnginePlayer, type FakePlayer, type FakePlayerInit } from "./overrides/player.js";
import { createFakeUiHost, type FakeUiHost, type FormResponse } from "./overrides/ui-host.js";
import { UnimplementedMinecraftApiError } from "./unimplemented-error.js";
import { BlockPermutation, Dimension } from "./overrides/dimension.js";
import { Entity } from "./overrides/entity.js";
import { ItemStack, EntityInventoryComponent } from "./overrides/inventory.js";

export type EngineState = {
  system: FakeSystem;
  world: FakeWorld;
  ui: FakeUiHost;
};

type G = typeof globalThis & { __sfmcTestingEngine?: EngineState };

function store(): G {
  return globalThis as G;
}

export function getEngine(): EngineState {
  const g = store();
  if (!g.__sfmcTestingEngine) {
    g.__sfmcTestingEngine = {
      system: createFakeSystem(),
      world: createFakeWorld(),
      ui: createFakeUiHost(),
    };
  }
  return g.__sfmcTestingEngine;
}

/** 就地复位（保持对象身份）。 */
export function resetEngine(): EngineState {
  const eng = getEngine();
  eng.system.reset();
  eng.world.reset();
  eng.ui.reset();
  return eng;
}

export function disposeEngine(): void {
  if (!store().__sfmcTestingEngine) return;
  resetEngine();
}

export { createEnginePlayer };
export type { FakePlayer, FakePlayerInit, FormResponse, FakeSystem, FakeWorld, FakeUiHost };

export const PlayerPermissionLevel = {
  Visitor: 0,
  Member: 1,
  Operator: 2,
  Custom: 3,
} as const;

/** 对齐 pin `@minecraft/server` GameMode 枚举字面量。 */
export const GameMode = {
  Survival: "Survival",
  Creative: "Creative",
  Adventure: "Adventure",
  Spectator: "Spectator",
} as const;

function unimplementedCtor(name: string) {
  return class {
    constructor() {
      throw new UnimplementedMinecraftApiError(`new ${name}()`);
    }
  };
}

export function getWorld(): FakeWorld {
  return getEngine().world;
}

export function getSystem(): FakeSystem {
  return getEngine().system;
}

export function getUi(): FakeUiHost {
  return getEngine().ui;
}

export function createServerExports() {
  return {
    world: getWorld(),
    system: getSystem(),
    Player: unimplementedCtor("Player"),
    PlayerPermissionLevel,
    GameMode,
    ItemStack,
    Entity,
    BlockComponentTypes: {},
    BlockPermutation,
    Dimension,
    EntityInventoryComponent,
    EntityInitializationCause: {},
  };
}
