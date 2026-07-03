/* ---------------------------------------- *\
 *  商店系统核心逻辑 — 箱子商店               *
 *  使用箱子存放货物，如同 Clean / InventorySwitcher *
\* ---------------------------------------- */

import { world, Player, ItemStack, BlockComponentTypes, BlockPermutation, system, EntityInventoryComponent, EntityEquippableComponent, EquipmentSlot } from "@minecraft/server";
import { Config } from "../data/Config";
import { Money } from "../libs/Money";
import { Msg } from "../libs/Tools";
import * as Tool from "../libs/Tools";
import { ShopGUI } from "../gui/ShopGUI";
import { Permission } from "../libs/Permission";
import { Storage } from "../libs/Storage";

// 存储键
const KEY_PRICES = "shop:prices";
const KEY_STOCKS = "shop:stocks";

export interface ShopPriceData {
  prices: Record<string, number>; // "catIdx:slotIdx" → buy price
  sellPrices: Record<string, number>; // "catIdx:slotIdx" → sell price
}

export class ShopSystem {
  static _instance: ShopSystem;
  static getInstance() {
    if (!ShopSystem._instance) ShopSystem._instance = new ShopSystem();
    return ShopSystem._instance;
  }

  init() {
    Permission.register('shop.use', Permission.Any);
  }

  /** 委托给 ShopGUI 打开商店主菜单 */
  showShop(player: Player) {
    ShopGUI.show(player);
  }

  // ── 布局工具 ──

  /** 获取第 catIdx 个商店箱子的 { left, right, sign } 布局 */
  static getChestLayout(catIdx: number) {
    const cfg = Config.shopChest;
    const mainAxis = Math.floor(catIdx / cfg.size[1]);
    const yOffset = catIdx % cfg.size[1];
    return Tool.getLayout(cfg.start, cfg.direction, mainAxis, yOffset, cfg.face);
  }

  /** 获取第 catIdx 个商店的名称（从告示牌读取） */
  static getShopName(catIdx: number): string {
    const { sign } = this.getChestLayout(catIdx);
    const dim = world.getDimension("minecraft:overworld");
    const block = dim.getBlock(sign);
    if (!block) return `商店 #${catIdx + 1}`;
    try {
      const signComp = block.getComponent(BlockComponentTypes.Sign) as any;
      if (signComp?.getText) {
        const text = signComp.getText(true);
        if (text && text.rawtext?.[0]?.text) return text.rawtext[0].text;
      }
    } catch {}
    return `商店 #${catIdx + 1}`;
  }

  /** 获取某个商店箱子里所有物品（实际库存） */
  static getChestItems(catIdx: number): (ItemStack | undefined)[] {
    const dim = world.getDimension("minecraft:overworld");
    const { left } = this.getChestLayout(catIdx);
    const block = dim.getBlock(left);
    if (!block) return [];
    Tool.ensureDoubleChest(dim, left, Tool.getChestCardinal(Config.shopChest.direction, Config.shopChest.face), Config.shopChest.direction);
    const invComp = block.getComponent(BlockComponentTypes.Inventory) as any;
    if (!invComp?.container) return [];
    const items: (ItemStack | undefined)[] = [];
    for (let i = 0; i < invComp.container.size; i++) {
      items.push(invComp.container.getItem(i));
    }
    return items;
  }

  // ── 价格管理 ──

  static getPriceData(): ShopPriceData {
    return {
      prices: Storage.get<Record<string, number>>(KEY_PRICES, {}),
      sellPrices: Storage.get<Record<string, number>>(KEY_STOCKS, {}),
    };
  }

  static setPrice(catIdx: number, slotIdx: number, buyPrice: number, sellPrice: number) {
    const data = this.getPriceData();
    const key = `${catIdx}:${slotIdx}`;
    if (buyPrice > 0) data.prices[key] = buyPrice; else delete data.prices[key];
    if (sellPrice > 0) data.sellPrices[key] = sellPrice; else delete data.sellPrices[key];
    Storage.set(KEY_PRICES, data.prices);
    Storage.set(KEY_STOCKS, data.sellPrices);
  }

  // ── 购买 ──

  static buy(player: Player, catIdx: number, slotIdx: number, amount: number): boolean {
    const data = this.getPriceData();
    const key = `${catIdx}:${slotIdx}`;
    const price = data.prices[key];
    if (!price || price <= 0) { Msg.error("该物品未设置价格。", player); return false; }

    const dim = world.getDimension("minecraft:overworld");
    const { left } = this.getChestLayout(catIdx);
    Tool.ensureDoubleChest(dim, left, Tool.getChestCardinal(Config.shopChest.direction, Config.shopChest.face), Config.shopChest.direction);
    const block = dim.getBlock(left);
    if (!block) return false;
    const invComp = block.getComponent(BlockComponentTypes.Inventory) as any;
    if (!invComp?.container) return false;
    const container = invComp.container;

    const item = container.getItem(slotIdx);
    if (!item) { Msg.error("库存不足。", player); return false; }
    if (item.amount < amount) { Msg.error(`库存不足，仅剩 ${item.amount} 个。`, player); return false; }

    const total = price * amount;
    const bal = Money.get(player);
    if (bal < total) { Msg.error(`${Money.UNIT}不足，需要 ${total}，当前 ${bal}`, player); return false; }

    // 扣除金钱
    Money.set(player, bal - total);

    // 处理物品：扣除箱子中的数量
    if (item.amount === amount) {
      container.setItem(slotIdx, undefined);
    } else {
      item.amount -= amount;
      container.setItem(slotIdx, item);
    }

    // 给予玩家物品
    try {
      const itemName = item.typeId;
      const aux = (item as any).data ?? 0;
      player.runCommand(`give "${player.name}" ${itemName} ${amount} ${aux}`);
    } catch (e) {
      Msg.error("给予物品时出错，请联系管理员。", player);
      return false;
    }

    Msg.success(`购买成功！花费 ${total} ${Money.UNIT}`, player);
    return true;
  }

  // ── 出售 ──

  static sell(player: Player, catIdx: number, slotIdx: number, itemTypeId: string, amount: number): boolean {
    const data = this.getPriceData();
    const key = `${catIdx}:${slotIdx}`;
    const price = data.sellPrices[key];
    if (!price || price <= 0) { Msg.error("该位置不支持回收。", player); return false; }

    // 检查玩家背包中是否有该物品
    const playerInv = player.getComponent("inventory") as EntityInventoryComponent | undefined;
    if (!playerInv?.container) { Msg.error("无法获取背包信息。", player); return false; }

    let totalFound = 0;
    for (let i = 0; i < playerInv.container.size; i++) {
      const invItem = playerInv.container.getItem(i);
      if (invItem && invItem.typeId === itemTypeId) {
        totalFound += invItem.amount;
      }
    }

    if (totalFound < amount) { Msg.error(`背包中 ${itemTypeId} 不足，仅有 ${totalFound} 个。`, player); return false; }

    // 从玩家背包中移除物品
    let remaining = amount;
    for (let i = 0; i < playerInv.container.size && remaining > 0; i++) {
      const invItem = playerInv.container.getItem(i);
      if (invItem && invItem.typeId === itemTypeId) {
        if (invItem.amount <= remaining) {
          remaining -= invItem.amount;
          playerInv.container.setItem(i, undefined);
        } else {
          invItem.amount -= remaining;
          playerInv.container.setItem(i, invItem);
          remaining = 0;
        }
      }
    }

    const total = price * amount;
    Money.add(player, total);
    Msg.success(`回收成功！获得 ${total} ${Money.UNIT}`, player);
    return true;
  }

  // ── 检测商店方块 ──

  /** 检测某个坐标是否为商店箱子区域，返回 catIdx，否则返回 -1 */
  static detectShopChest(location: { x: number; y: number; z: number }): number {
    const cfg = Config.shopChest;
    for (let catIdx = 0; catIdx < cfg.size[0] * cfg.size[1]; catIdx++) {
      const { left, right } = this.getChestLayout(catIdx);
      for (const pos of [left, right]) {
        if (pos.x === Math.floor(location.x) && pos.y === Math.floor(location.y) && pos.z === Math.floor(location.z)) {
          return catIdx;
        }
      }
    }
    return -1;
  }
}
