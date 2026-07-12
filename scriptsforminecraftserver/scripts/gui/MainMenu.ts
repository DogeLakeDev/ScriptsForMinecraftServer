import { Player, system } from "@minecraft/server";
import { MenuNavigator, ObservableString, obsStr } from "../libs/MenuNavigator";
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
    new MainMenu().showMainMenu(player);
  }

  private showMainMenu(player: Player): void {
    const nav = new MenuNavigator(player);
    const balance = Money.get(player);

    nav.section("main", "主菜单", (page) => {
      page.label(ListFormInfo([`当前余额: ${balance} ${Money.UNIT}`]));
      page.button("土地", () => nav.leave(() => LandGUI.showMainMenu(player)));
      page.button("合作社", () => nav.leave(() => new CoopGUI(player).mainPanel()));
      page.button("频道", () => nav.leave(() => ChatGUI.openChannelPanel(player)));
      page.button("红包", () => nav.leave(() => ChatGUI.openRedPacketPanel(player)));
      page.button("节操", () => nav.go("economy"));
    });

    nav.section("economy", "经济系统", (page) => {
      const balLabel = obsStr(`§f[*] 当前余额: ${Money.get(player)} ${Money.UNIT}`);
      page.label(balLabel);
      page.button("转账", () => nav.go("transfer"));
    });

    nav.section("transfer", "转账", (page) => {
      const status = obsStr("");
      const targetName = obsStr("");
      const amountStr = obsStr("");
      page.label(status);
      page.label(ListFormInfo([`当前余额: ${Money.get(player)} ${Money.UNIT}`]));
      page.textField("目标玩家", targetName, { description: "输入玩家名称" });
      page.textField("金额", amountStr, { description: "输入转账金额" });
      page.button("确认转账", () => {
        const name = targetName.getData().trim();
        const amount = parseInt(amountStr.getData());
        if (!name || isNaN(amount) || amount <= 0) {
          status.setData("§c输入无效，请检查玩家名称和金额。");
          return;
        }
        const target = player.dimension.getPlayers().find((p) => p.name === name);
        if (!target) {
          status.setData(`§c未找到玩家「${name}」。`);
          return;
        }
        const bal = Money.get(player);
        if (amount > bal) {
          status.setData(`§c余额不足。当前余额: ${bal} ${Money.UNIT}，需要: ${amount} ${Money.UNIT}`);
          return;
        }
        Money.add(player, -amount);
        Money.add(target, amount);
        status.setData(`§a成功转账 ${amount} ${Money.UNIT} 给 ${name}。`);
        system.runTimeout(() => nav.rebuild("economy"), 40);
      });
    });

    nav.start("main");
  }
}
