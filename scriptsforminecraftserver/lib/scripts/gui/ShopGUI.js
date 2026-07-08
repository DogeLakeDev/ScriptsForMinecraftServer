/* ---------------------------------------- *\
 *  商店 GUI — 箱子商店界面                   *                       *
\* ---------------------------------------- */
import { CustomForm } from "@minecraft/server-ui";
import { Gui, ObservableString } from "../libs/Gui";
import { Msg, ListFormInfo } from "../libs/Tools";
import { Money } from "../libs/Money";
import { ShopSystem } from "../shop/ShopSystem";
import { Config } from "../data/Config";
export class ShopGUI {
    static show(player) {
        const cfg = Config.shopChest;
        const totalShops = cfg.size[0] * cfg.size[1];
        const form = new CustomForm(player, "商店");
        form.label(ListFormInfo(["选择要浏览的商品分类"]));
        for (let i = 0; i < totalShops; i++) {
            const idx = i;
            form.button(ShopSystem.getShopName(i), () => {
                this.showShopCategory(player, idx);
            });
        }
        form.closeButton();
        Gui.showForm(player, form, "商店");
    }
    static showShopCategory(player, catIdx) {
        const items = ShopSystem.getChestItems(catIdx);
        const priceData = ShopSystem.getPriceData();
        const shopName = ShopSystem.getShopName(catIdx);
        const body = [`当前余额: ${Money.get(player)} ${Money.UNIT}`];
        const form = new CustomForm(player, shopName);
        form.label(ListFormInfo(body));
        for (let j = 0; j < items.length; j++) {
            const item = items[j];
            if (!item)
                continue;
            const actualIdx = j;
            const buyPrice = priceData.prices[`${catIdx}:${j}`];
            const sellPrice = priceData.sellPrices[`${catIdx}:${j}`];
            const label = `${item.typeId} §7x${item.amount}§r`;
            const prices = `${buyPrice ? `§a买:${buyPrice} ${Money.UNIT}§r` : ""} ${sellPrice ? `§6卖:${sellPrice} ${Money.UNIT}§r` : ""}`;
            form.button(`${label}\n${prices}`, () => {
                this.showItemDetail(player, catIdx, actualIdx);
            });
        }
        form.closeButton();
        Gui.showForm(player, form, shopName);
    }
    static showItemDetail(player, catIdx, slotIdx) {
        const items = ShopSystem.getChestItems(catIdx);
        const item = items[slotIdx];
        if (!item) {
            Msg.error("该物品已不存在。", player);
            return;
        }
        const priceData = ShopSystem.getPriceData();
        const buyPrice = priceData.prices[`${catIdx}:${slotIdx}`];
        const sellPrice = priceData.sellPrices[`${catIdx}:${slotIdx}`];
        const title = item.typeId;
        const bodyParts = [`§7物品: §f${item.typeId}`, `§7库存: §f${item.amount}`];
        if (buyPrice)
            bodyParts.push(`§a购买价: ${buyPrice} ${Money.UNIT}/个`);
        if (sellPrice)
            bodyParts.push(`§6回收价: ${sellPrice} ${Money.UNIT}/个`);
        bodyParts.push(`§7当前余额: ${Money.get(player)} ${Money.UNIT}`);
        const form = new CustomForm(player, title);
        form.label(bodyParts.join("\n"));
        if (buyPrice) {
            form.button(`§a购买 §7(${buyPrice} ${Money.UNIT}/个)`, () => {
                this.showQuantityInput(player, catIdx, slotIdx, item, "buy");
            });
        }
        if (sellPrice) {
            form.button(`§6回收 §7(${sellPrice} ${Money.UNIT}/个)`, () => {
                this.showQuantityInput(player, catIdx, slotIdx, item, "sell");
            });
        }
        form.closeButton();
        Gui.showForm(player, form, title);
    }
    static showQuantityInput(player, catIdx, slotIdx, item, action) {
        const priceData = ShopSystem.getPriceData();
        const buyPrice = priceData.prices[`${catIdx}:${slotIdx}`];
        const sellPrice = priceData.sellPrices[`${catIdx}:${slotIdx}`];
        const unitPrice = action === "buy" ? buyPrice : sellPrice;
        const label = action === "buy" ? "购买" : "回收";
        const maxStack = item.amount;
        const shopItems = ShopSystem.getChestItems(catIdx);
        const shopItem = shopItems[slotIdx];
        const buyMax = shopItem ? shopItem.amount : 0;
        const amountObs = new ObservableString("");
        const form = new CustomForm(player, `§l${label} ${item.typeId}`);
        form.label(`§7单价: ${unitPrice} ${Money.UNIT}/个\n§7库存: ${action === "buy" ? buyMax : "不限"}\n§7输入${label}数量：`);
        form.textField(`输入数量 (1-${action === "buy" ? buyMax : 64})`, amountObs);
        form.button(`确认${label}`, () => {
            const amountStr = amountObs.getData();
            const amount = parseInt(amountStr);
            if (isNaN(amount) || amount <= 0) {
                Msg.error("无效的数量。", player);
                return;
            }
            if (action === "buy") {
                if (amount > (shopItem?.amount ?? 0)) {
                    Msg.error(`库存不足，仅剩 ${shopItem?.amount ?? 0} 个。`, player);
                    return;
                }
                const total = amount * unitPrice;
                if (Money.get(player) < total) {
                    Msg.error(`${Money.UNIT}不足，需要 ${total}，当前 ${Money.get(player)}`, player);
                    return;
                }
                ShopSystem.buy(player, catIdx, slotIdx, amount);
            }
            else {
                const playerInv = player.getComponent("inventory");
                if (!playerInv?.container) {
                    Msg.error("无法获取背包信息。", player);
                    return;
                }
                let totalFound = 0;
                for (let i = 0; i < playerInv.container.size; i++) {
                    const invItem = playerInv.container.getItem(i);
                    if (invItem && invItem.typeId === item.typeId)
                        totalFound += invItem.amount;
                }
                if (totalFound < amount) {
                    Msg.error(`背包中不足，仅有 ${totalFound} 个。`, player);
                    return;
                }
                ShopSystem.sell(player, catIdx, slotIdx, item.typeId, amount);
            }
        });
        form.closeButton();
        Gui.showForm(player, form, `${label} ${item.typeId}`);
    }
}
//# sourceMappingURL=ShopGUI.js.map