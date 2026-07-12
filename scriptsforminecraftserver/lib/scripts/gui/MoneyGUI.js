import { world } from "@minecraft/server";
import { MenuNavigator, obsStr, FormStatus } from "../libs/MenuNavigator";
import { Money } from "../libs/Money";
import { Command } from "../libs/Command";
import { ListFormInfo } from "../libs/Tools";
export class MoneyGUI {
    static registerCommand() {
        Command.register("money", "money.admin", (player) => {
            if (!player)
                return;
            new MoneyGUI().show(player);
        }, "货币管理");
    }
    show(player) {
        const nav = new MenuNavigator(player);
        nav.section("main", "货币管理", (page) => {
            const balance = Money.get(player);
            page.label(ListFormInfo([`当前余额: ${balance} ${Money.UNIT}。`]));
            page.button("给予玩家", () => nav.go("give"));
            page.button("查询玩家", () => nav.go("query"));
        });
        nav.section("give", "给予玩家", (page) => {
            const status = new FormStatus(page);
            const targetName = obsStr("");
            const amountStr = obsStr("");
            page.textField("玩家名称", targetName, { description: "请输入玩家名称" });
            page.textField("数量", amountStr, { description: "请输入货币数量" });
            page.button("确认", () => {
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
                Money.add(target, val);
                status.ok(`已给予 ${name} ${val} ${Money.UNIT}。`);
                nav.rebuild("main");
            });
        });
        nav.section("query", "查询玩家", (page) => {
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
//# sourceMappingURL=MoneyGUI.js.map