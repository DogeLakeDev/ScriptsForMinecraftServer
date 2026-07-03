/* ---------------------------------------- *\
 *  货币快捷管理                             *
\* ---------------------------------------- */

import { Player, world } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { Gui } from "../libs/Gui";
import { Money } from "../libs/Money";
import { Command } from "../libs/Command";
import { Permission } from "../libs/Permission";
import { Msg, ListFormInfo } from "../libs/Tools";

// 注册权限
Permission.register("money.admin", Permission.Admin);

export class MoneyCommand {
  static init() {
    Command.register("money", "money.admin", (player: Player | undefined) => {
      if (!player) return;
      this.showMainMenu(player);
    }, "货币管理");
  }

  static showMainMenu(player: Player) {
    const balance = Money.get(player);
    const body = [
      `当前余额: ${balance} ${Money.UNIT}。`,
    ];

    const form = new ActionFormData()
      .title("货币管理")
      .body(ListFormInfo(body))
      .button("给予玩家")
      .button("查询玩家")
      .button("取消");

    Gui.showForm(player, form, "货币管理").then((res: any) => {
      if (res.canceled) return;
      switch (res.selection) {
        case 0:
          this.showGiveForm(player);
          break;
        case 1:
          this.showQueryForm(player);
          break;
      }
    });
  }

  private static showGiveForm(player: Player) {
    const form = new ModalFormData()
      .title("给予玩家")
      .textField("玩家名称", "请输入玩家名称")
      .textField("数量", "请输入货币数量");

    Gui.showForm(player, form, "给予玩家").then((res: any) => {
      if (res.canceled) return;
      const targetName = res.formValues[0] as string;
      const amount = parseInt(res.formValues[1] as string);
      if (!targetName || isNaN(amount) || amount <= 0) {
        Msg.error("输入无效，请检查玩家名称和数量。", player);
        return;
      }
      const targetPlayer = world.getPlayers().find(p => p.name === targetName);
      if (!targetPlayer) {
        Msg.error(`未找到玩家「${targetName}」。`, player);
        return;
      }
      Money.add(targetPlayer, amount);
      Msg.success(`已给予 ${targetName} ${amount} ${Money.UNIT}。`, player);
    });
  }

  private static showQueryForm(player: Player) {
    const form = new ModalFormData()
      .title("查询玩家")
      .textField("玩家名称", "请输入玩家名称");

    Gui.showForm(player, form, "查询玩家").then((res: any) => {
      if (res.canceled) return;
      const targetName = res.formValues[0] as string;
      if (!targetName) {
        Msg.error("请输入有效的玩家名称。", player);
        return;
      }
      const targetPlayer = world.getPlayers().find(p => p.name === targetName);
      if (!targetPlayer) {
        Msg.error(`未找到玩家「${targetName}」。`, player);
        return;
      }
      const balance = Money.get(targetPlayer);
      Msg.info(`玩家 ${targetName} 当前余额: ${balance} ${Money.UNIT}。`, player);
    });
  }
}
