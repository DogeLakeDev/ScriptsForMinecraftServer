/**
 * @minecraft/server 桥：手写语义 + L0 生成大范围导出。
 */

import {
  getSystem,
  getWorld,
  GameMode,
  PlayerPermissionLevel,
  createServerExports,
} from "./runtime.js";
import { UnimplementedMinecraftApiError } from "./unimplemented-error.js";
import * as L0 from "./generated/server-l0.js";

const base = createServerExports();

function bindGet<T extends object>(getter: () => T): T {
  return new Proxy({} as T, {
    get(_t, prop, _receiver) {
      const target = getter();
      const v = Reflect.get(target, prop, target);
      return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(target) : v;
    },
    has(_t, prop) {
      return Reflect.has(getter(), prop);
    },
    ownKeys() {
      return Reflect.ownKeys(getter());
    },
    getOwnPropertyDescriptor(_t, prop) {
      const desc = Reflect.getOwnPropertyDescriptor(getter(), prop);
      if (!desc) return undefined;
      return { ...desc, configurable: true };
    },
  });
}

export const world = bindGet(getWorld);
export const system = bindGet(getSystem);

export const Player = base.Player;
export { PlayerPermissionLevel, GameMode };
export const ItemStack = base.ItemStack;
export const Entity = base.Entity;
export const BlockComponentTypes = base.BlockComponentTypes;
export const BlockPermutation = base.BlockPermutation;
export const Dimension = base.Dimension;
export const EntityInventoryComponent = base.EntityInventoryComponent;
export const EntityHealthComponent = base.EntityHealthComponent;
export const Effect = base.Effect;
export const EntityInitializationCause = base.EntityInitializationCause;

export * from "./generated/server-l0.js";

const hand: Record<string | symbol, unknown> = {
  world,
  system,
  Player,
  PlayerPermissionLevel,
  GameMode,
  ItemStack,
  Entity,
  BlockComponentTypes,
  BlockPermutation,
  Dimension,
  EntityInventoryComponent,
  EntityHealthComponent,
  Effect,
  EntityInitializationCause,
};

export default new Proxy(hand, {
  get(t, prop) {
    if (prop === "__esModule") return true;
    if (typeof prop === "symbol") return undefined;
    if (Object.prototype.hasOwnProperty.call(t, prop)) return t[prop];
    const fromL0 = (L0 as Record<string, unknown>)[prop];
    if (fromL0 !== undefined) return fromL0;
    throw new UnimplementedMinecraftApiError(`@minecraft/server.${String(prop)}`);
  },
  has(t, prop) {
    if (typeof prop === "symbol") return false;
    return Object.prototype.hasOwnProperty.call(t, prop) || prop in (L0 as object);
  },
});
