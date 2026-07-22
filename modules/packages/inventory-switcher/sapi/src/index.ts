/**
 * @sfmc/module-inventory-switcher — v2 入口
 *
 * ModuleRegistry.register + 监听 playerGameModeChange,在 survival↔creative
 * 模式切换时把当前背包存到世界箱子阵列,再从对应箱子恢复另一模式背包。
 *
 * Graceful degradation: 如果 configs/inventory_switcher.json 不含有效 grid,
 * 模块 init 后直接 return,不订阅事件,功能完全关闭。
 */

import {
  BlockComponentTypes,
  EntityEquippableComponent,
  EntityInventoryComponent,
  EquipmentSlot,
  GameMode,
  Player,
  PlayerGameModeChangeAfterEvent,
  system,
  world,
} from "@minecraft/server";
import { config } from "@sfmc/sdk/sapi/config";
import { debug, ensureDoubleChest, getChestCardinal, getLayout, getShanghaiTime, getSignFacing, placeSign } from "@sfmc/sdk/sapi/runtime";
import { ModuleRegistry } from "@sfmc/sdk/module-loader";

const MODULE_ID = "feature-inventory-switcher";

interface Grid {
  start: [number, number, number];
  size: [number, number];
  direction: "x" | "z";
  face: "north" | "south" | "east" | "west";
}

interface InventorySwitcherConfig {
  grid?: Grid;
}

type ContainerLike = { size: number; getItem(i: number): unknown; setItem(i: number, item: unknown): void };

const chestMap = new Map<string, number>();
let gameModeSub: { unsubscribe(): void } | undefined;
let grid: Grid | null = null;

function getLayoutFor(index: number): { left: { x: number; y: number; z: number }; sign: { x: number; y: number; z: number } } {
  if (!grid) return { left: { x: 0, y: 0, z: 0 }, sign: { x: 0, y: 0, z: 0 } };
  const mainAxis = Math.floor(index / grid.size[1]);
  const yOffset = index % grid.size[1];
  return getLayout(grid.start, grid.direction, mainAxis, yOffset, grid.face);
}

function getChestIndex(playerId: string, forCreative: boolean): number {
  const key = `invswitcher:player_${playerId}`;
  let base = chestMap.get(key);
  if (base === undefined) {
    if (!grid) return 0;
    let nextIdx = world.getDynamicProperty("hpbe:invswitcher_next") as number | undefined;
    if (nextIdx === undefined) nextIdx = 0;
    const max = grid.size[0] - 2;
    if (nextIdx > max) nextIdx = 0;
    base = nextIdx;
    chestMap.set(key, base);
    world.setDynamicProperty("hpbe:invswitcher_next", base + 2);
  }
  return base * 2 + (forCreative ? 1 : 0);
}

function saveToChest(player: Player, forCreative: boolean): void {
  if (!grid) return;
  const dim = world.getDimension("minecraft:overworld");
  const { left, sign } = getLayoutFor(getChestIndex(player.id, forCreative));
  ensureDoubleChest(dim, left, getChestCardinal(grid.direction, grid.face), grid.direction);
  const { date, time } = getShanghaiTime();
  placeSign(
    dim,
    sign,
    getSignFacing(grid.direction, grid.face),
    `${player.nameTag}\n${forCreative ? "Creative" : "Survival"}\n${date}\n${time}`
  );
  const block = dim.getBlock(left);
  if (!block) return;
  const invComp = block.getComponent(BlockComponentTypes.Inventory) as unknown as { container: ContainerLike } | undefined;
  if (!invComp?.container) return;
  const container = invComp.container;
  for (let i = 0; i < container.size; i++) container.setItem(i, undefined);
  const playerInv = player.getComponent("inventory") as EntityInventoryComponent | undefined;
  if (playerInv?.container) {
    for (let i = 0; i < playerInv.container.size && i < 36; i++) {
      const item = playerInv.container.getItem(i);
      if (item) {
        playerInv.container.setItem(i, undefined);
        container.setItem(i, item);
      }
    }
  }
  const eq = player.getComponent("equippable") as EntityEquippableComponent | undefined;
  if (eq) {
    for (const [ai, slot] of [
      EquipmentSlot.Head,
      EquipmentSlot.Chest,
      EquipmentSlot.Legs,
      EquipmentSlot.Feet,
    ].entries()) {
      const item = eq.getEquipment(slot);
      if (item) {
        eq.setEquipment(slot, undefined);
        container.setItem(36 + ai, item);
      }
    }
    const offhand = eq.getEquipment(EquipmentSlot.Offhand);
    if (offhand) {
      eq.setEquipment(EquipmentSlot.Offhand, undefined);
      container.setItem(40, offhand);
    }
  }
}

function restoreFromChest(player: Player, forCreative: boolean): void {
  if (!grid) return;
  const dim = world.getDimension("minecraft:overworld");
  const { left } = getLayoutFor(getChestIndex(player.id, forCreative));
  ensureDoubleChest(dim, left, getChestCardinal(grid.direction, grid.face), grid.direction);
  const block = dim.getBlock(left);
  if (!block) return;
  const invComp = block.getComponent(BlockComponentTypes.Inventory) as unknown as { container: ContainerLike } | undefined;
  if (!invComp?.container) return;
  const container = invComp.container;
  const playerInv = player.getComponent("inventory") as EntityInventoryComponent | undefined;
  if (playerInv?.container) {
    for (let i = 0; i < playerInv.container.size; i++) playerInv.container.setItem(i, undefined);
  }
  const eq = player.getComponent("equippable") as EntityEquippableComponent | undefined;
  if (eq) {
    eq.setEquipment(EquipmentSlot.Head, undefined);
    eq.setEquipment(EquipmentSlot.Chest, undefined);
    eq.setEquipment(EquipmentSlot.Legs, undefined);
    eq.setEquipment(EquipmentSlot.Feet, undefined);
    eq.setEquipment(EquipmentSlot.Offhand, undefined);
  }
  if (playerInv?.container) {
    for (let i = 0; i < 36; i++) {
      const item = container.getItem(i);
      if (item) {
        container.setItem(i, undefined);
        playerInv.container.setItem(i, item);
      }
    }
  }
  if (eq) {
    for (const [ai, slot] of [
      EquipmentSlot.Head,
      EquipmentSlot.Chest,
      EquipmentSlot.Legs,
      EquipmentSlot.Feet,
    ].entries()) {
      const item = container.getItem(36 + ai);
      if (item) {
        container.setItem(36 + ai, undefined);
        eq.setEquipment(slot, item);
      }
    }
    const offhand = container.getItem(40);
    if (offhand) {
      container.setItem(40, undefined);
      eq.setEquipment(EquipmentSlot.Offhand, offhand);
    }
  }
}

ModuleRegistry.register({
  id: MODULE_ID,
  afterWorldLoad: true,
  lifecycle: {
    registerPermissions() {
      // No external command — purely reactive on playerGameModeChange
    },
    async init() {
      const cfg = (await config.get<InventorySwitcherConfig>("inventory_switcher")) ?? {};
      if (!cfg.grid) {
        debug.e("InventorySwitcher", "configs/inventory_switcher.json missing or invalid grid — module disabled");
        return;
      }
      grid = cfg.grid;
      gameModeSub = world.afterEvents.playerGameModeChange.subscribe((event: PlayerGameModeChangeAfterEvent) => {
        const player = event.player;
        system.run(() => {
          if (player.getGameMode() !== event.toGameMode) return;
          if (event.fromGameMode === GameMode.Survival && event.toGameMode === GameMode.Creative) {
            saveToChest(player, false);
            restoreFromChest(player, true);
          } else if (event.fromGameMode === GameMode.Creative && event.toGameMode === GameMode.Survival) {
            saveToChest(player, true);
            restoreFromChest(player, false);
          }
        });
      });
      debug.i("InventorySwitcher", "init: enabled with grid " + JSON.stringify(grid));
    },
    cleanup() {
      try {
        gameModeSub?.unsubscribe();
      } catch {
        /* ignore */
      }
      gameModeSub = undefined;
      chestMap.clear();
    },
  },
});