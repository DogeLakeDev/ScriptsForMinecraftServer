/* ---------------------------------------- *\
 *  合作社系统入口
 *  命令注册、事件监听
\* ---------------------------------------- */
import { Command } from "../libs/Command";
import { Permission } from "../libs/Permission";
import { CoopGUI } from "../gui/CoopGUI";
export class CoopSystem {
    static init() {
        console.log(`Initializing CoopSystem...`);
        console.log(`CoopSystem initialized successfully.`);
    }
    static registerPermissions() {
        Permission.register("coop.use", Permission.Member);
        Permission.register("coop.admin", Permission.OP);
        Permission.register("coopshop.use", Permission.Member);
    }
    static registerCommands() {
        Command.register("coop", "coop.use", (player) => {
            if (player)
                new CoopGUI(player).mainPanel();
        }, "合作社", "coop");
        Command.register("coopshop", "coopshop.use", (player) => {
            if (!player)
                return;
            CoopGUI.openShopMgr(player);
        }, "合作社商店", "coop");
    }
    static registerEvents() {
        // 预留事件处理函数
    }
}
//# sourceMappingURL=CoopSystem.js.map