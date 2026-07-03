/* ---------------------------------------- *\
 *  合作社系统入口
 *  命令注册、事件监听
\* ---------------------------------------- */
import { Command } from "../libs/Command";
import { Permission } from "../libs/Permission";
import { Database } from "./Database";
import { CoopGUI } from "../gui/CoopGUI";
export class CoopSystem {
    static init() {
        Database.initDefaultGroups();
        this.registerPermissions();
        this.registerCommands();
        this.registerEvents();
    }
    static registerPermissions() {
        Permission.register("coop.use", Permission.Any);
        Permission.register("coop.admin", Permission.OP);
        Permission.register("coopshop.use", Permission.Any);
    }
    static registerCommands() {
        Command.register("coop", "coop.use", (player) => {
            if (player)
                new CoopGUI(player).mainPanel();
        }, "合作社");
        Command.register("coopshop", "coopshop.use", (player) => {
            var _a;
            if (!player)
                return;
            new CoopGUI(player).shopMgr((_a = Database.getPlayerCid(player.name)) !== null && _a !== void 0 ? _a : "", 1);
        }, "合作社商店");
    }
    static registerEvents() {
        // 预留事件处理
    }
}
//# sourceMappingURL=CoopSystem.js.map