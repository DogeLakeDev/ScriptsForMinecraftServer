import { Player } from "@minecraft/server";
import { Gui, ObservableString } from "../libs/Gui";
import { CustomForm } from "@minecraft/server-ui";
import { Msg, ListFormInfo } from "../libs/Tools";
import { Money } from "../libs/Money";
import { LandGUI } from "./LandGUI";
import { ChatGUI } from "./ChatGUI";
import { CoopGUI } from "./CoopGUI";
import { Command } from "../libs/Command";

export class MainMenu {
  static registerMenuCommand() {
    Command.register(
      "menu",
      "menu.use",
      (player: Player | undefined) => {
        if (player) MainMenu.show(player);
      },
      "主菜单"
    );
  }

  static show(player: Player): void {
    this.showMainMenu(player);
  }

  private static async showMainMenu(player: Player): Promise<void> {
    const balance = Money.get(player);
    const body = ListFormInfo([`当前余额: ${balance} ${Money.UNIT}`]);

    const form = new CustomForm(player, "主菜单")
      .label(body)
      .button("土地", () => LandGUI.showMainMenu(player))
      .button("合作社", () => {
        new CoopGUI(player).mainPanel();
      })
      .button("频道", () => ChatGUI.openChannelPanel(player))
      .button("红包", () => ChatGUI.openRedPacketPanel(player))
      .button("节操", () => this.showEconomyPanel(player))
      .closeButton();
    await Gui.showForm(player, form, "主菜单");
  }

  private static async showEconomyPanel(player: Player): Promise<void> {
    const balance = Money.get(player);
    const body = ListFormInfo([`当前余额: ${balance} ${Money.UNIT}`]);

    const form = new CustomForm(player, "经济系统")
      .label(body)
      .button("查询余额", async () => {
        const bal = Money.get(player);
        Msg.info(`当前余额: ${bal} ${Money.UNIT}`, player);
        await this.showEconomyPanel(player);
      })
      .button("转账", () => this.showTransferForm(player))
      .closeButton();
    await Gui.showForm(player, form, "经济系统");
  }

  private static async showTransferForm(player: Player): Promise<void> {
    const targetName = new ObservableString("");
    const amountStr = new ObservableString("");

    const form = new CustomForm(player, "转账")
      .textField("目标玩家", targetName, { description: "输入玩家名称" })
      .textField("金额", amountStr, { description: "输入转账金额" })
      .button("确认转账", async () => {
        const name = targetName.getData().trim();
        const amount = parseInt(amountStr.getData());

        if (!name || isNaN(amount) || amount <= 0) {
          Msg.error("输入无效，请检查玩家名称和金额。", player);
          return;
        }

        const target = player.dimension.getPlayers().find((p) => p.name === name);
        if (!target) {
          Msg.error(`未找到玩家「${name}」。`, player);
          return;
        }

        const balance = Money.get(player);
        if (amount > balance) {
          Msg.error(`余额不足。当前余额: ${balance} ${Money.UNIT}，需要: ${amount} ${Money.UNIT}`, player);
          return;
        }

        Money.add(player, -amount);
        Money.add(target, amount);
        Msg.success(`成功转账 ${amount} ${Money.UNIT} 给 ${name}。`, player);
      })
      .closeButton();
    const reason = await Gui.showForm(player, form, "转账");
    if (reason === "ClientClosed" || reason === "ServerClosed") {
      await this.showEconomyPanel(player);
    }
  }
}
