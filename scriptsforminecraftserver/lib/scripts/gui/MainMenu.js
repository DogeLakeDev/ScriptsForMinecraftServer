/* ---------------------------------------- *\
 *  主菜单 GUI 界面
\* ---------------------------------------- */
import { Gui } from "../libs/Gui";
import { Msg, ListFormInfo } from "../libs/Tools";
import { Money } from "../libs/Money";
import { LandGUI } from "./LandGUI";
import { ChatGUI } from "./ChatGUI";
import { CoopGUI } from "./CoopGUI";
export class MainMenu {
    static show(player) {
        this.showMainMenu(player);
    }
    static showMainMenu(player) {
        return __awaiter(this, void 0, void 0, function* () {
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
            const res = yield Gui.showForm(player, form, "主菜单");
            if (res.canceled)
                return;
            const sel = res.selection;
            switch (sel) {
                case 0:
                    LandGUI.showMainMenu(player);
                    break;
                case 1:
                    new CoopGUI(player).mainPanel();
                    break;
                case 2:
                    yield ChatGUI.openChannelPanel(player);
                    break;
                case 3:
                    yield ChatGUI.openRedPacketPanel(player);
                    break;
                case 4:
                    yield this.showEconomyPanel(player);
                    break;
                case 5: return;
            }
        });
    }
    static showEconomyPanel(player) {
        return __awaiter(this, void 0, void 0, function* () {
            const balance = Money.get(player);
            const body = ListFormInfo([
                `当前余额: ${balance} ${Money.UNIT}`,
            ]);
            const form = Gui.simpleForm("经济系统", body);
            form.button("查询余额");
            form.button("转账");
            form.button("§l返回");
            const res = yield Gui.showForm(player, form, "经济系统");
            if (res.canceled)
                return;
            const sel = res.selection;
            switch (sel) {
                case 0: {
                    const bal = Money.get(player);
                    Msg.info(`当前余额: ${bal} ${Money.UNIT}`, player);
                    yield this.showEconomyPanel(player);
                    break;
                }
                case 1:
                    yield this.showTransferForm(player);
                    break;
                case 2:
                    yield this.showMainMenu(player);
                    break;
            }
        });
    }
    static showTransferForm(player) {
        return __awaiter(this, void 0, void 0, function* () {
            const form = Gui.modalForm("转账");
            form.textField("目标玩家", "输入玩家名称");
            form.textField("金额", "输入转账金额");
            const res = yield Gui.showForm(player, form, "转账");
            if (res.canceled) {
                yield this.showEconomyPanel(player);
                return;
            }
            const vals = res.formValues;
            const targetName = vals[0].trim();
            const amount = parseInt(vals[1]);
            if (!targetName || isNaN(amount) || amount <= 0) {
                Msg.error("输入无效，请检查玩家名称和金额。", player);
                yield this.showTransferForm(player);
                return;
            }
            const target = player.dimension.getPlayers().find(p => p.name === targetName);
            if (!target) {
                Msg.error(`未找到玩家「${targetName}」。`, player);
                yield this.showTransferForm(player);
                return;
            }
            const balance = Money.get(player);
            if (amount > balance) {
                Msg.error(`余额不足。当前余额: ${balance} ${Money.UNIT}，需要: ${amount} ${Money.UNIT}`, player);
                yield this.showTransferForm(player);
                return;
            }
            Money.add(player, -amount);
            Money.add(target, amount);
            Msg.success(`成功转账 ${amount} ${Money.UNIT} 给 ${targetName}。`, player);
            yield this.showEconomyPanel(player);
        });
    }
}
//# sourceMappingURL=MainMenu.js.map