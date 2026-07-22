/**
 * lifecycles/clean.ts — 掉落物清理
 *
 * 全服扫描掉落物,超阈值收纳到回收箱阵列;kill_list 直接清除。
 * 启用条件:任意区域 features.clean === true。配置读 configs/area.json 的 clean 块。
 */

import { BlockComponentTypes, Entity, ItemStack, system, world } from "@minecraft/server";
import { Command, debug, Permission } from "@sfmc/sdk/sapi/runtime";
import {
  ensureDoubleChest,
  getBase,
  getChestCardinal,
  getShanghaiTime,
  getSignFacing,
  placeSign,
} from "@sfmc/sdk/sapi/runtime";
import type { ModuleLifecycle } from "@sfmc/sdk/module-loader";
import { getCleanConfig, isFeatureActive } from "../area-service.js";

let _cleanIndex = 0;

let _startPoint: [number, number, number] = [0, 0, 0];
let _size: [number, number] = [5, 5];
let _direction = -1; // 箱子的朝向
let _face = -1;
let _killList: string[] = [];
let _itemMax = 128;
let _timeout = 60;
let _intervalId: number | undefined = undefined;

/**
 * 将物品放入回收箱阵列。
 * @param itemProvider 物品给予函数,返回 undefined 表示任务结束
 * @param isFirstCall 首次调用;若一轮循环后仍有物品,归零索引再循环一次
 */
function placeItem(itemProvider: () => ItemStack | undefined, isFirstCall = true): void {
  const base = getBase(_direction);
  const cardinalDirection = getChestCardinal(_direction, _face);
  const facingDirection = getSignFacing(_direction, _face);

  let index = 0;
  const currentIndex = _cleanIndex; // 当前箱子索引,仅在跳过阶段使用
  const dimension = world.getDimension("overworld");
  for (let mainAxis = 0; mainAxis < _size[0]; mainAxis++) {
    for (let y = 0; y < _size[1]; y++) {
      // 若还未到达当前空箱子的索引,则跳过
      index++;
      if (index < currentIndex) {
        continue;
      }
      const coordinate = {
        x: _startPoint[0] + mainAxis * base[0] * 2,
        y: _startPoint[1] + y,
        z: _startPoint[2] + mainAxis * base[1] * 2,
      }; // 主箱子
      const coordinate2 = {
        x: coordinate.x + base[0],
        y: coordinate.y,
        z: coordinate.z + base[1],
      }; // 主箱子右边一个箱子
      const block = dimension.getBlock(coordinate);
      // 方块应该是箱子,不是则放置
      ensureDoubleChest(dimension, coordinate, cardinalDirection, _direction);

      const inventory = block!.getComponent(BlockComponentTypes.Inventory) as
        | { container?: { emptySlotsCount: number; clearAll(): void; addItem(item: ItemStack): void } }
        | undefined;
      if (!inventory || !inventory.container) {
        continue;
      }
      const container = inventory.container;
      if (container.emptySlotsCount === 0) {
        container.clearAll();
      }

      while (container.emptySlotsCount > 0) {
        const item = itemProvider();
        if (!item) {
          // 没有物品需要处理了,结束任务
          return;
        }
        container.addItem(item);
      }
      // 当前箱子装满了,更新索引为下一个
      _cleanIndex = index + 1;
      // 放置告示牌
      const signCoordinate = {
        x: coordinate2.x + (base[0] !== 0 ? 0 : _face),
        y: coordinate2.y,
        z: coordinate2.z + (base[1] !== 0 ? 0 : _face),
      };
      placeSign(dimension, signCoordinate, facingDirection, getTimeStr());
    }
  }
  // 一轮循环后仍未结束,归零,进行新一轮
  _cleanIndex = 0;
  if (isFirstCall) {
    placeItem(itemProvider, false);
  }
}

/** 开始清理 */
function startClean(entities?: Entity[]): void {
  debug.i("CLEAN", `startClean: entityCount=${entities?.length || "all"}`);
  const itemEntities = entities ?? getAllItemEntities();

  placeItem(() => {
    while (itemEntities.length > 0) {
      const itemEntity = itemEntities.pop()!;
      const stack = (itemEntity.getComponent("minecraft:item") as { itemStack?: ItemStack } | undefined)?.itemStack;
      if (!stack) {
        continue;
      }
      // 在直接清除列表中的物品实体直接清除
      if (_killList.some((value) => value === stack.typeId)) {
        itemEntity.kill();
        continue;
      }
      itemEntity.kill();
      return stack;
    }
    return undefined;
  });
}

function startCleanInterval(): void {
  debug.i("CLEAN", "startCleanInterval");
  if (_intervalId) {
    system.clearRun(_intervalId);
    _intervalId = undefined;
  }
  _intervalId = system.runInterval(() => {
    if (!isFeatureActive("clean")) return;
    const entities = getAllItemEntities();
    if (entities.length > _itemMax) {
      world.sendMessage({ rawtext: [{ text: "「§6読経するヤマビコ ~ 幽谷 響子§f」 距离清理掉落物还有§c 5 §fs" }] });
      system.runTimeout(() => {
        startClean(undefined);
        system.runTimeout(() => {
          world.sendMessage({ rawtext: [{ text: "§a* 已清理掉落物 *" }] });
        }, 5);
      }, 100);
    }
  }, _timeout * 20);
}

function stopCleanInterval(): void {
  debug.i("CLEAN", "stopCleanInterval");
  if (_intervalId) {
    system.clearRun(_intervalId);
    _intervalId = undefined;
  }
}

/** 获取世界的所有掉落物实体 */
function getAllItemEntities(): Entity[] {
  const itemEntities = world.getDimension("overworld").getEntities({ type: "item" });
  itemEntities.push(...world.getDimension("nether").getEntities({ type: "item" }));
  itemEntities.push(...world.getDimension("the_end").getEntities({ type: "item" }));
  return itemEntities;
}

function getTimeStr(): string {
  const { date, time } = getShanghaiTime();
  return `\n${date}\n${time}`;
}

export const cleanLifecycle: ModuleLifecycle = {
  registerPermissions() {
    Permission.register("clean.admin", Permission.OP);
  },

  registerCommands() {
    Command.register(
      "clean",
      "clean.admin",
      () => {
        startClean(undefined);
      },
      "开始扫地",
      "clean"
    );
  },

  init() {
    debug.i("CLEAN", "Clean.init");
    const cfg = getCleanConfig();
    if (cfg) {
      if (cfg.recycle_bin) {
        _startPoint = [cfg.recycle_bin.start[0], cfg.recycle_bin.start[1], cfg.recycle_bin.start[2]];
        _size = [cfg.recycle_bin.size[0], cfg.recycle_bin.size[1]];
        _direction = cfg.recycle_bin.direction;
        _face = cfg.recycle_bin.face;
      }
      _killList = Array.isArray(cfg.kill_list) ? cfg.kill_list : [];
      _itemMax = typeof cfg.item_max === "number" ? cfg.item_max : 128;
      _timeout = typeof cfg.poll_interval === "number" ? cfg.poll_interval : 60;
    }
    startCleanInterval();
  },

  cleanup() {
    debug.i("CLEAN", "Clean.stop");
    stopCleanInterval();
  },
};
