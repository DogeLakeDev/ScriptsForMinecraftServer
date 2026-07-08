import { world } from "@minecraft/server";
import { Gui, ObservableString } from "../libs/Gui";
import { CustomForm } from "@minecraft/server-ui";
import { Money } from "../libs/Money";
import { Command } from "../libs/Command";
import { Msg, ListFormInfo } from "../libs/Tools";
export class MoneyGUI {
    static registerCommand() {
        Command.register("money", "money.admin", (player) => {
            if (!player)
                return;
            this.showMainMenu(player);
        }, "货币管理");
    }
    static showMainMenu(player) {
        const balance = Money.get(player);
        const form = new CustomForm(player, "货币管理")
            .label(ListFormInfo([`当前余额: ${balance} ${Money.UNIT}。`]))
            .button("给予玩家", () => this.showGiveForm(player))
            .button("查询玩家", () => this.showQueryForm(player))
            .closeButton();
        Gui.showForm(player, form, "货币管理");
    }
    static showGiveForm(player) {
        const targetName = new ObservableString("");
        const amountStr = new ObservableString("");
        const form = new CustomForm(player, "给予玩家")
            .textField("玩家名称", targetName, { description: "请输入玩家名称" })
            .textField("数量", amountStr, { description: "请输入货币数量" })
            .button("确认", () => {
            const name = targetName.getData().trim();
            const val = parseInt(amountStr.getData());
            if (!name || isNaN(val) || val <= 0) {
                Msg.error("输入无效，请检查玩家名称和数量。", player);
                return;
            }
            const target = world.getPlayers().find((p) => p.name === name);
            if (!target) {
                Msg.error(`未找到玩家「${name}」。`, player);
                return;
            }
            Money.add(target, val);
            Msg.success(`已给予 ${name} ${val} ${Money.UNIT}。`, player);
        })
            .closeButton();
        Gui.showForm(player, form, "给予玩家");
    }
    static showQueryForm(player) {
        const targetName = new ObservableString("");
        const form = new CustomForm(player, "查询玩家")
            .textField("玩家名称", targetName, { description: "请输入玩家名称" })
            .button("查询", () => {
            const name = targetName.getData().trim();
            if (!name) {
                Msg.error("请输入有效的玩家名称。", player);
                return;
            }
            const target = world.getPlayers().find((p) => p.name === name);
            if (!target) {
                Msg.error(`未找到玩家「${name}」。`, player);
                return;
            }
            const balance = Money.get(target);
            Msg.info(`玩家 ${name} 当前余额: ${balance} ${Money.UNIT}。`, player);
        })
            .closeButton();
        Gui.showForm(player, form, "查询玩家");
    }
}
//# sourceMappingURL=MoneyGUI.js.map