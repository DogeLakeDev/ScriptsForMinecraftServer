/* ---------------------------------------- *\
 *  商店 GUI — 箱子商店界面                   *                       *
\* ---------------------------------------- */
import { Gui } from "../libs/Gui";
import { Msg, ListFormInfo } from "../libs/Tools";
import { Money } from "../libs/Money";
import { ShopSystem } from "../shop/ShopSystem";
import { Config } from "../data/Config";
export class ShopGUI {
    /** 打开商店主菜单 — 列出所有分类 */
    static show(player) {
        const cfg = Config.shopChest;
        const totalShops = cfg.size[0] * cfg.size[1];
        const form = Gui.simpleForm("商店", ListFormInfo(["选择要浏览的商品分类"]));
        for (let i = 0; i < totalShops; i++) {
            form.button(ShopSystem.getShopName(i));
        }
        form.button("§l返回");
        Gui.showForm(player, form, "商店").then((res) => {
            if (res.canceled)
                return;
            const sel = res.selection;
            if (sel >= totalShops)
                return; // 返回按钮
            this.showShopCategory(player, sel);
        });
    }
    /** 显示某个商店分类的物品列表 */
    static showShopCategory(player, catIdx) {
        const items = ShopSystem.getChestItems(catIdx);
        const priceData = ShopSystem.getPriceData();
        const shopName = ShopSystem.getShopName(catIdx);
        const body = [`当前余额: ${Money.get(player)} ${Money.UNIT}`];
        const form = Gui.simpleForm(shopName, ListFormInfo(body));
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (!item)
                continue;
            const buyPrice = priceData.prices[`${catIdx}:${i}`];
            const sellPrice = priceData.sellPrices[`${catIdx}:${i}`];
            const label = `${item.typeId} §7x${item.amount}§r`;
            const prices = `${buyPrice ? `§a买:${buyPrice} ${Money.UNIT}§r` : ""} ${sellPrice ? `§6卖:${sellPrice} ${Money.UNIT}§r` : ""}`;
            form.button(`${label}\n${prices}`);
        }
        form.button("§l返回");
        Gui.showForm(player, form, shopName).then((res) => {
            if (res.canceled)
                return;
            const sel = res.selection;
            if (sel >= items.length)
                return; // 返回按钮
            // 过滤掉空槽位得到实际的物品索引
            let actualIdx = -1;
            let count = 0;
            for (let j = 0; j < items.length; j++) {
                if (items[j]) {
                    if (count === sel) {
                        actualIdx = j;
                        break;
                    }
                    count++;
                }
            }
            if (actualIdx === -1)
                return;
            this.showItemDetail(player, catIdx, actualIdx);
        });
    }
    /** 显示某个物品的购买/回收操作界面 */
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
        const form = Gui.simpleForm(title, bodyParts.join("\n"));
        if (buyPrice)
            form.button(`§a购买 §7(${buyPrice} ${Money.UNIT}/个)`);
        if (sellPrice)
            form.button(`§6回收 §7(${sellPrice} ${Money.UNIT}/个)`);
        form.button("§l返回");
        Gui.showForm(player, form, title).then((res) => {
            if (res.canceled)
                return;
            const sel = res.selection;
            const hasBuy = !!buyPrice;
            const hasSell = !!sellPrice;
            let action = null;
            if (hasBuy && sel === 0)
                action = "buy";
            else if (hasSell && (hasBuy ? sel === 1 : sel === 0))
                action = "sell";
            if (!action)
                return; // 返回
            this.showQuantityInput(player, catIdx, slotIdx, item, action);
        });
    }
    /** 弹出数量输入框 */
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
        const form = Gui.modalForm(`§l${label} ${item.typeId}`);
        form.textField(`§7单价: ${unitPrice} ${Money.UNIT}/个\n§7库存: ${action === "buy" ? buyMax : "不限"}\n§7输入${label}数量：`, `输入数量 (1-${action === "buy" ? buyMax : 64})`);
        form.submitButton(`确认${label}`);
        Gui.showForm(player, form, `${label} ${item.typeId}`).then((res) => {
            var _a, _b;
            if (res.canceled)
                return;
            const amountStr = res.formValues[0];
            const amount = parseInt(amountStr);
            if (isNaN(amount) || amount <= 0) {
                Msg.error("无效的数量。", player);
                return;
            }
            if (action === "buy") {
                if (amount > ((_a = shopItem === null || shopItem === void 0 ? void 0 : shopItem.amount) !== null && _a !== void 0 ? _a : 0)) {
                    Msg.error(`库存不足，仅剩 ${(_b = shopItem === null || shopItem === void 0 ? void 0 : shopItem.amount) !== null && _b !== void 0 ? _b : 0} 个。`, player);
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
                // 检查玩家背包
                const playerInv = player.getComponent("inventory");
                if (!(playerInv === null || playerInv === void 0 ? void 0 : playerInv.container)) {
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
    }
}
//# sourceMappingURL=ShopGUI.js.map