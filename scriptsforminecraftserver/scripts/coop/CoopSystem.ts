/* ---------------------------------------- *\
 *  合作社系统入口
 *  命令注册、事件监听
\* ---------------------------------------- */

import { world, Player } from "@minecraft/server";
import { Command } from "../libs/Command";
import { Permission } from "../libs/Permission";
import { Database } from "./Database";
import { CoopCore } from "./CoopCore";
import { CoopGUI } from "../gui/CoopGUI";

export class CoopSystem {

  static init() {
    Database.initDefaultGroups();
    this.registerPermissions();
    this.registerCommands();
    this.registerEvents();
  }

  private static registerPermissions() {
    Permission.register("coop.use", Permission.Any);
    Permission.register("coop.admin", Permission.OP);
    Permission.register("coopshop.use", Permission.Any);
  }

  private static registerCommands() {
    Command.register("coop", "coop.use", (player: Player | undefined) => {
      if (player) new CoopGUI(player).mainPanel();
    }, "合作社");

    Command.register("coopshop", "coopshop.use", (player: Player | undefined) => {
      if (!player) return;
      new CoopGUI(player).shopMgr(Database.getPlayerCid(player.name) ?? "", 1);
    }, "合作社商店");
  }

  private static registerEvents() {
    // 预留事件处理
  }
}
