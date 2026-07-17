import { Player } from "@minecraft/server";
import { CoopGUI } from "../gui/CoopGUI.js";
import { Command } from "../libs/Command.js";
import { debug } from "../libs/DebugLog.js";
import { Permission } from "../libs/Permission.js";

export class CoopSystem {
  /**
   * @description
   * @author Shiroha7z
   * @date 17/07/2026
   * @static
   * @memberof CoopSystem
   */
  static init() {
    debug.i("COOP", "init");
    console.log(`Initializing CoopSystem...`);
    console.log(`CoopSystem initialized successfully.`);
  }

  static registerPermissions() {
    debug.i("COOP", "registerPermissions");
    Permission.register("coop.use", Permission.Member);
    Permission.register("coop.admin", Permission.OP);
    Permission.register("coopshop.use", Permission.Member);
  }

  static registerCommands() {
    Command.register(
      "coop",
      "coop.use",
      (player: Player | undefined) => {
        if (player) new CoopGUI(player).mainPanel();
      },
      "合作社",
      "coop"
    );

    Command.register(
      "coopshop",
      "coopshop.use",
      (player: Player | undefined) => {
        if (!player) return;
        CoopGUI.openShopMgr(player);
      },
      "合作社商店",
      "coop"
    );
  }

  static registerEvents() {
    // 预留事件处理函数
  }
}
