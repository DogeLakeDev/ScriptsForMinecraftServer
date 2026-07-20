import { Player, world } from "@minecraft/server";
import { Command } from "@sfmc/sdk/sapi/runtime";
import { debug } from "@sfmc/sdk/sapi/runtime";
import { Money } from "@sfmc/sdk/sapi/runtime";
import { FormStatus, MenuNavigator, obsStr } from "@sfmc/sdk/sapi/runtime";
import { ListFormInfo } from "@sfmc/sdk/sapi/runtime";

export class MoneyGUI {
  static registerCommand() {
    debug.i("GUI", "MoneyGUI.registerCommand");
    Command.register(
      "money",
      "money.admin",
      (player: Player | undefined) => {
        if (!player) return;
        new MoneyGUI().show(player);
      },
      "货币管理",
      "money"
    );
  }

  private show(player: Player): void {
    debug.i("GUI", `MoneyGUI.show: player=${player.name}`);
    const nav = new MenuNavigator(player);

    nav.section("main", "货币管理", (page: any) => {
      const balance = Money.get(player);
      page.label(ListFormInfo([`当前余额: ${balance} ${Money.UNIT}。`]));
      page.button("给予玩家", () => nav.go("give"));
      page.button("查询玩家", () => nav.go("query"));
    });

    nav.section("give", "给予玩家", (page: any) => {
      const status = new FormStatus(page);
      const targetName = obsStr("");
      const amountStr = obsStr("");
      page.textField("玩家名称", targetName, { description: "请输入玩家名称" });
      page.textField("数量", amountStr, { description: "请输入货币数量" });
      page.button("确认", async () => {
        const name = targetName.getData().trim();
        const val = parseInt(amountStr.getData());
        if (!name || isNaN(val) || val <= 0) {
          status.fail("输入无效，请检查玩家名称和数量。");
          return;
        }
        const target = world.getPlayers().find((p) => p.name === name);
        if (!target) {
          status.fail(`未找到玩家「${name}」。`);
          return;
        }
        if (!(await Money.add(target, val))) {
          status.fail("发放失败，请稍后重试。");
          return;
        }
        status.ok(`已给予 ${name} ${val} ${Money.UNIT}。`);
        await nav.rebuild("main");
      });
    });

    nav.section("query", "查询玩家", (page: any) => {
      const status = new FormStatus(page);
      const targetName = obsStr("");
      page.textField("玩家名称", targetName, { description: "请输入玩家名称" });
      page.button("查询", () => {
        const name = targetName.getData().trim();
        if (!name) {
          status.fail("请输入有效的玩家名称。");
          return;
        }
        const target = world.getPlayers().find((p) => p.name === name);
        if (!target) {
          status.fail(`未找到玩家「${name}」。`);
          return;
        }
        const balance = Money.get(target);
        status.info(`玩家 ${name} 当前余额: ${balance} ${Money.UNIT}。`);
      });
    });

    nav.start("main");
  }
}