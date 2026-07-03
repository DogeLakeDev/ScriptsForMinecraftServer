/* ---------------------------------------- *\
 *  主菜单 GUI 界面
\* ---------------------------------------- */

import { Player } from "@minecraft/server";
import { Gui } from "../libs/Gui";
import { Msg, ListFormInfo } from "../libs/Tools";
import { Money } from "../libs/Money";
import { LandGUI } from "./LandGUI";
import { ChatGUI } from "./ChatGUI";
import { CoopGUI } from "./CoopGUI";

export class MainMenu {
  static show(player: Player): void {
    this.showMainMenu(player);
  }

  private static async showMainMenu(player: Player): Promise<void> {
    const balance = Money.get(player);
    const body = ListFormInfo([
      `当前余额: ${balance} ${Money.UNIT}`,
    ]);

    const form = Gui.simpleForm("主菜单", body);
    form.button("土地");
    form.button("合作社");
    form.button("频道");
    form.button("红包");
    form.button("节操");
    form.button("§l返回");

    const res = await Gui.showForm(player, form, "主菜单");
    if (res.canceled) return;
    const sel = (res as any).selection;
    switch (sel) {
      case 0: LandGUI.showMainMenu(player); break;
      case 1: new CoopGUI(player).mainPanel(); break;
      case 2: await ChatGUI.openChannelPanel(player); break;
      case 3: await ChatGUI.openRedPacketPanel(player); break;
      case 4: await this.showEconomyPanel(player); break;
      case 5: return;
    }
  }

  private static async showEconomyPanel(player: Player): Promise<void> {
    const balance = Money.get(player);
    const body = ListFormInfo([
      `当前余额: ${balance} ${Money.UNIT}`,
    ]);

    const form = Gui.simpleForm("经济系统", body);
    form.button("查询余额");
    form.button("转账");
    form.button("§l返回");

    const res = await Gui.showForm(player, form, "经济系统");
    if (res.canceled) return;
    const sel = (res as any).selection;
    switch (sel) {
      case 0: {
        const bal = Money.get(player);
        Msg.info(`当前余额: ${bal} ${Money.UNIT}`, player);
        await this.showEconomyPanel(player);
        break;
      }
      case 1: await this.showTransferForm(player); break;
      case 2: await this.showMainMenu(player); break;
    }
  }

  private static async showTransferForm(player: Player): Promise<void> {
    const form = Gui.modalForm("转账");
    form.textField("目标玩家", "输入玩家名称");
    form.textField("金额", "输入转账金额");

    const res = await Gui.showForm(player, form, "转账");
    if (res.canceled) {
      await this.showEconomyPanel(player);
      return;
    }
    const vals = (res as any).formValues!;
    const targetName = (vals[0] as string).trim();
    const amount = parseInt(vals[1] as string);

    if (!targetName || isNaN(amount) || amount <= 0) {
      Msg.error("输入无效，请检查玩家名称和金额。", player);
      await this.showTransferForm(player);
      return;
    }

    const target = player.dimension.getPlayers().find(p => p.name === targetName);
    if (!target) {
      Msg.error(`未找到玩家「${targetName}」。`, player);
      await this.showTransferForm(player);
      return;
    }

    const balance = Money.get(player);
    if (amount > balance) {
      Msg.error(`余额不足。当前余额: ${balance} ${Money.UNIT}，需要: ${amount} ${Money.UNIT}`, player);
      await this.showTransferForm(player);
      return;
    }

    Money.add(player, -amount);
    Money.add(target, amount);
    Msg.success(`成功转账 ${amount} ${Money.UNIT} 给 ${targetName}。`, player);
    await this.showEconomyPanel(player);
  }
}
