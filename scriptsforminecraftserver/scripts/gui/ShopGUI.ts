import { Player, EntityInventoryComponent } from "@minecraft/server";
import { MenuNavigator, ObservableString, obsStr, FormStatus } from "../libs/MenuNavigator";
import { Msg, ListFormInfo } from "../libs/Tools";
import { Money } from "../libs/Money";
import { ShopSystem } from "../shop/ShopSystem";
import { ConfigManager } from "../libs/ConfigManager";

export class ShopGUI {
  private nav: MenuNavigator;
  private player: Player;

  private constructor(player: Player) {
    this.player = player;
    this.nav = new MenuNavigator(player);
    this.registerSections();
  }

  static show(player: Player): void {
    new ShopGUI(player).nav.start("category");
  }

  private registerSections(): void {
    this.nav.section("category", "商店", (p) => this.buildCategory(p));
    this.nav.section("itemDetail", "商品详情", (p) => this.buildItemDetail(p));
    this.nav.section("quantityInput", "数量", (p) => this.buildQuantityInput(p));
  }

  private buildCategory(page: any): void {
    const cfg = ConfigManager.getGrid("shop_chest");
    const totalShops = cfg.size[0] * cfg.size[1];
    page.label(ListFormInfo(["选择要浏览的商品分类"]));
    for (let i = 0; i < totalShops; i++) {
      const idx = i;
      page.button(ShopSystem.getShopName(i), () => {
        this.nav.state.catIdx = idx;
        this.nav.rebuild("itemDetail");
      });
    }
  }

  private async buildItemDetail(page: any): Promise<void> {
    const catIdx = this.nav.state.catIdx as number;
    const items = ShopSystem.getChestItems(catIdx);
    const priceData = ShopSystem.getPriceData();
    const shopName = ShopSystem.getShopName(catIdx);
    page.label(ListFormInfo([`当前余额: ${Money.get(this.player)} ${Money.UNIT}`]));

    for (let j = 0; j < items.length; j++) {
      const item = items[j];
      if (!item) continue;
      const buyPrice = priceData.prices[`${catIdx}:${j}`];
      const sellPrice = priceData.sellPrices[`${catIdx}:${j}`];
      const label = `${item.typeId} §7x${item.amount}§r`;
      const prices = `${buyPrice ? `§a买:${buyPrice} ${Money.UNIT}§r` : ""} ${sellPrice ? `§6卖:${sellPrice} ${Money.UNIT}§r` : ""}`;
      page.button(`${label}\n${prices}`, () => {
        this.nav.state.catIdx = catIdx;
        this.nav.state.slotIdx = j;
        this.nav.state.item = item;
        this.nav.state.buyPrice = buyPrice;
        this.nav.state.sellPrice = sellPrice;
        this.nav.go("quantityInput");
      });
    }
  }

  private buildQuantityInput(page: any): void {
    const status = new FormStatus(page);
    const catIdx = this.nav.state.catIdx as number;
    const slotIdx = this.nav.state.slotIdx as number;
    const item = this.nav.state.item as any;
    const buyPrice = this.nav.state.buyPrice as number | undefined;
    const sellPrice = this.nav.state.sellPrice as number | undefined;

    if (!item) {
      page.label("物品数据丢失。");
      return;
    }

    const bodyParts = [`§7物品: §f${item.typeId}`, `§7库存: §f${item.amount}`];
    if (buyPrice) bodyParts.push(`§a购买价: ${buyPrice} ${Money.UNIT}/个`);
    if (sellPrice) bodyParts.push(`§6回收价: ${sellPrice} ${Money.UNIT}/个`);
    bodyParts.push(`§7当前余额: ${Money.get(this.player)} ${Money.UNIT}`);
    page.label(bodyParts.join("\n"));

    if (buyPrice) {
      page.button(`§a购买 §7(${buyPrice} ${Money.UNIT}/个)`, () => {
        this.nav.state.action = "buy";
        this.nav.rebuild("quantityInput");
        // Rebuild to show the quantity section properly
      });
    }
    if (sellPrice) {
      page.button(`§6回收 §7(${sellPrice} ${Money.UNIT}/个)`, () => {
        this.nav.state.action = "sell";
        this.nav.rebuild("quantityInput");
      });
    }

    const amountObs = obsStr("");
    page.textField("数量", amountObs);

    page.button("确认", () => {
      const action = this.nav.state.action as string;
      const amountStr = amountObs.getData();
      const amount = parseInt(amountStr);
      if (isNaN(amount) || amount <= 0) {
        status.fail("无效的数量。");
        return;
      }

      if (action === "buy") {
        const shopItem = ShopSystem.getChestItems(catIdx)?.[slotIdx];
        if (amount > (shopItem?.amount ?? 0)) {
          status.fail(`库存不足，仅剩 ${shopItem?.amount ?? 0} 个。`);
          return;
        }
        const total = amount * buyPrice!;
        if (Money.get(this.player) < total) {
          status.fail(`${Money.UNIT}不足，需要 ${total}，当前 ${Money.get(this.player)}`);
          return;
        }
        ShopSystem.buy(this.player, catIdx, slotIdx, amount);
      } else {
        const playerInv = this.player.getComponent("inventory") as EntityInventoryComponent | undefined;
        if (!playerInv?.container) {
          status.fail("无法获取背包信息。");
          return;
        }
        let totalFound = 0;
        for (let i = 0; i < playerInv.container.size; i++) {
          const invItem = playerInv.container.getItem(i);
          if (invItem && invItem.typeId === item.typeId) totalFound += invItem.amount;
        }
        if (totalFound < amount) {
          status.fail(`背包中不足，仅有 ${totalFound} 个。`);
          return;
        }
        ShopSystem.sell(this.player, catIdx, slotIdx, item.typeId, amount);
      }
    });
  }
}
