import { Player, system } from "@minecraft/server";
import { Command } from "@sfmc/sdk/sapi/runtime";
import { debug } from "@sfmc/sdk/sapi/runtime";
import { Money } from "@sfmc/sdk/sapi/runtime";
import { MenuNavigator, obsStr } from "@sfmc/sdk/sapi/runtime";
import { ListFormInfo, Msg } from "@sfmc/sdk/sapi/runtime";
import { service } from "@sfmc/sdk/sapi/service";
import { ChatGUI } from "@sfmc/module-feature-chat";
import { LandGUI } from "@sfmc/module-land-gui";

export class MainMenu {
  static registerMenuCommand() {
    debug.i("GUI", "MainMenu.registerMenuCommand");
    Command.register(
      "menu",
      "menu.use",
      (player: Player | undefined) => {
        if (player) MainMenu.show(player);
      },
      "主菜单",
      "money"
    );
  }

  static show(player: Player): void {
    debug.i("GUI", `MainMenu.show: player=${player.name}`);
    new MainMenu().showMainMenu(player);
  }

  private showMainMenu(player: Player): void {
    debug.i("GUI", "MainMenu.showMainMenu");
    const nav = new MenuNavigator(player);
    const balance = Money.get(player);

    nav.section("main", "主菜单", (page: any) => {
      page.label(ListFormInfo([`当前余额: ${balance} ${Money.UNIT}`]));
      page.button("土地", () => nav.leave(() => LandGUI.showMainMenu(player)));
      // feature-coop 已合并 GUI 到命令面(/coop);图形 UI 待 P1 补回
      page.button("合作社", () =>
        nav.leave(() => {
          Msg.tips("请使用 /coop 打开合作社菜单", player);
        })
      );
      page.button("频道", () => nav.leave(() => ChatGUI.openChannelPanel(player)));
      page.button("红包", () => nav.leave(() => ChatGUI.openRedPacketPanel(player)));
      page.button("节操", () => nav.go("economy"));
    });

    nav.section("economy", "经济系统", (page: any) => {
      const balLabel = obsStr(`§f[*] 当前余额: ${Money.get(player)} ${Money.UNIT}`);
      page.label(balLabel);
      page.button("转账", () => nav.go("transfer"));
    });

    nav.section("transfer", "转账", (page: any) => {
      const status = obsStr("");
      const targetName = obsStr("");
      const amountStr = obsStr("");
      page.label(status);
      page.label(ListFormInfo([`当前余额: ${Money.get(player)} ${Money.UNIT}`]));
      page.textField("目标玩家", targetName, { description: "输入玩家名称" });
      page.textField("金额", amountStr, { description: "输入转账金额" });
      page.button("确认转账", async () => {
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
        const bal = await Money.load(player);
        if (amount > bal) {
          status.setData(`§c余额不足。当前余额: ${bal} ${Money.UNIT}，需要: ${amount} ${Money.UNIT}`);
          return;
        }
        try {
          await service.get("economy.account.transfer", {
            fromPlayerId: player.id,
            toPlayerId: target.id,
            amount,
            toPlayerName: target.name,
          });
        } catch {
          status.setData("§c转账失败，余额可能已变化，请重试。");
          return;
        }
        await Money.load(player);
        await Money.load(target);
        status.setData(`§a成功转账 ${amount} ${Money.UNIT} 给 ${name}。`);
        system.runTimeout(() => nav.rebuild("economy"), 40);
      });
    });

    nav.start("main");
  }
}
