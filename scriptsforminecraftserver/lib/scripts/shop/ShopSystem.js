/* ---------------------------------------- *\
 *  商店系统核心逻辑 — 箱子商店               *
 *  使用箱子存放货物，如同 Clean / InventorySwitcher *
\* ---------------------------------------- */
import { world, BlockComponentTypes, } from "@minecraft/server";
import { ConfigManager } from "../libs/ConfigManager";
import { Money } from "../libs/Money";
import * as Tool from "../libs/Tools";
import { ShopGUI } from "../gui/ShopGUI";
import { Command } from "../libs/Command";
export class ShopSystem {
    static registerCommand() {
        Command.register("shop", "shop.use", (player) => {
            if (player)
                this.showShop(player);
        }, "商店", "shop");
    }
    /** 委托给 ShopGUI 打开商店主菜单 */
    static showShop(player) {
        ShopGUI.show(player);
    }
    // ── 布局工具 ──
    /** 获取第 catIdx 个商店箱子的 { left, right, sign } 布局 */
    static getChestLayout(catIdx) {
        const cfg = ConfigManager.getGrid("shop_chest");
        const mainAxis = Math.floor(catIdx / cfg.size[1]);
        const yOffset = catIdx % cfg.size[1];
        return Tool.getLayout(cfg.start, cfg.direction, mainAxis, yOffset, cfg.face);
    }
    /** 获取第 catIdx 个商店的名称（从告示牌读取） */
    static getShopName(catIdx) {
        const { sign } = this.getChestLayout(catIdx);
        const dim = world.getDimension("minecraft:overworld");
        const block = dim.getBlock(sign);
        if (!block)
            return `商店 #${catIdx + 1}`;
        try {
            const signComp = block.getComponent(BlockComponentTypes.Sign);
            if (signComp?.getText) {
                const text = signComp.getText(true);
                if (text && text.rawtext?.[0]?.text)
                    return text.rawtext[0].text;
            }
        }
        catch { }
        return `商店 #${catIdx + 1}`;
    }
    /** 获取某个商店箱子里所有物品（实际库存） */
    static getChestItems(catIdx) {
        const dim = world.getDimension("minecraft:overworld");
        const { left } = this.getChestLayout(catIdx);
        const block = dim.getBlock(left);
        if (!block)
            return [];
        const cfg = ConfigManager.getGrid("shop_chest");
        Tool.ensureDoubleChest(dim, left, Tool.getChestCardinal(cfg.direction, cfg.face), cfg.direction);
        const invComp = block.getComponent(BlockComponentTypes.Inventory);
        if (!invComp?.container)
            return [];
        const items = [];
        for (let i = 0; i < invComp.container.size; i++) {
            items.push(invComp.container.getItem(i));
        }
        return items;
    }
    // ── 价格管理 ──
    static getPriceData() {
        let pricesData = world.getDynamicProperty("hpbe:shop_prices");
        let prices = {};
        if (typeof pricesData === "string")
            prices = JSON.parse(pricesData);
        let stocksData = world.getDynamicProperty("hpbe:shop_stocks");
        let sellPrices = {};
        if (typeof stocksData === "string")
            sellPrices = JSON.parse(stocksData);
        return {
            prices,
            sellPrices,
        };
    }
    static setPrice(catIdx, slotIdx, buyPrice, sellPrice) {
        const data = this.getPriceData();
        const key = `${catIdx}:${slotIdx}`;
        if (buyPrice > 0)
            data.prices[key] = buyPrice;
        else
            delete data.prices[key];
        if (sellPrice > 0)
            data.sellPrices[key] = sellPrice;
        else
            delete data.sellPrices[key];
        world.setDynamicProperty("hpbe:shop_prices", JSON.stringify(data.prices));
        world.setDynamicProperty("hpbe:shop_stocks", JSON.stringify(data.sellPrices));
    }
    // ── 购买 ──
    static buy(player, catIdx, slotIdx, amount) {
        const data = this.getPriceData();
        const key = `${catIdx}:${slotIdx}`;
        const price = data.prices[key];
        if (!price || price <= 0) {
            Tool.Msg.error("该物品未设置价格。", player);
            return false;
        }
        const dim = world.getDimension("minecraft:overworld");
        const { left } = this.getChestLayout(catIdx);
        const cfg = ConfigManager.getGrid("shop_chest");
        Tool.ensureDoubleChest(dim, left, Tool.getChestCardinal(cfg.direction, cfg.face), cfg.direction);
        const block = dim.getBlock(left);
        if (!block)
            return false;
        const invComp = block.getComponent(BlockComponentTypes.Inventory);
        if (!invComp?.container)
            return false;
        const container = invComp.container;
        const item = container.getItem(slotIdx);
        if (!item) {
            Tool.Msg.error("库存不足。", player);
            return false;
        }
        if (item.amount < amount) {
            Tool.Msg.error(`库存不足，仅剩 ${item.amount} 个。`, player);
            return false;
        }
        const total = price * amount;
        const bal = Money.get(player);
        if (bal < total) {
            Tool.Msg.error(`${Money.UNIT}不足，需要 ${total}，当前 ${bal}`, player);
            return false;
        }
        // 扣除金钱
        Money.set(player, bal - total);
        // 处理物品：扣除箱子中的数量
        if (item.amount === amount) {
            container.setItem(slotIdx, undefined);
        }
        else {
            item.amount -= amount;
            container.setItem(slotIdx, item);
        }
        // 给予玩家物品
        try {
            const itemName = item.typeId;
            const aux = item.data ?? 0;
            player.runCommand(`give "${player.name}" ${itemName} ${amount} ${aux}`);
        }
        catch (e) {
            Tool.Msg.error("给予物品时出错，请联系管理员。", player);
            return false;
        }
        Tool.Msg.success(`购买成功！花费 ${total} ${Money.UNIT}`, player);
        return true;
    }
    // ── 出售 ──
    static sell(player, catIdx, slotIdx, itemTypeId, amount) {
        const data = this.getPriceData();
        const key = `${catIdx}:${slotIdx}`;
        const price = data.sellPrices[key];
        if (!price || price <= 0) {
            Tool.Msg.error("该位置不支持回收。", player);
            return false;
        }
        // 检查玩家背包中是否有该物品
        const playerInv = player.getComponent("inventory");
        if (!playerInv?.container) {
            Tool.Msg.error("无法获取背包信息。", player);
            return false;
        }
        let totalFound = 0;
        for (let i = 0; i < playerInv.container.size; i++) {
            const invItem = playerInv.container.getItem(i);
            if (invItem && invItem.typeId === itemTypeId) {
                totalFound += invItem.amount;
            }
        }
        if (totalFound < amount) {
            Tool.Msg.error(`背包中 ${itemTypeId} 不足，仅有 ${totalFound} 个。`, player);
            return false;
        }
        // 从玩家背包中移除物品
        let remaining = amount;
        for (let i = 0; i < playerInv.container.size && remaining > 0; i++) {
            const invItem = playerInv.container.getItem(i);
            if (invItem && invItem.typeId === itemTypeId) {
                if (invItem.amount <= remaining) {
                    remaining -= invItem.amount;
                    playerInv.container.setItem(i, undefined);
                }
                else {
                    invItem.amount -= remaining;
                    playerInv.container.setItem(i, invItem);
                    remaining = 0;
                }
            }
        }
        const total = price * amount;
        Money.add(player, total);
        Tool.Msg.success(`回收成功！获得 ${total} ${Money.UNIT}`, player);
        return true;
    }
    // ── 检测商店方块 ──
    /** 检测某个坐标是否为商店箱子区域，返回 catIdx，否则返回 -1 */
    static detectShopChest(location) {
        const cfg = ConfigManager.getGrid("shop_chest");
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
//# sourceMappingURL=ShopSystem.js.map