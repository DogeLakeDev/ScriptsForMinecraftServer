/**
 * 模组初始化
 */
import { system, world, Player } from "@minecraft/server";
import { Money } from "./libs/Money";
import { Command } from "./libs/Command";
import { QAManager } from "./doge/QA";
import * as Fly from "./area/Fly";
import * as AFK from "./doge/AFK";
import { SpawnProtect } from "./doge/SpawnProtect";
import { Clean } from "./doge/Clean";
import { Peace } from "./area/Peace";
import { Permission } from "./libs/Permission";
import { CoopSystem } from "./coop/CoopSystem";
import { ChatSystem } from "./chat/ChatSystem";
import { TPS } from "./doge/TPS";
import { OnlineTime } from "./doge/OnlineTime";
import { CreativeArea } from "./area/CreativeArea";
import { SurvivalArea } from "./area/SurvivalArea";
import { InventorySwitcher } from "./area/InventorySwitcher";
import { LandSystem } from "./land/LandSystem";
import { MoneyCommand } from "./gui/MoneyGUI";
import { MainMenu } from "./gui/MainMenu";
import { ShopSystem } from "./shop/ShopSystem";
import { Storage } from "./libs/Storage";
import { ScoreboardSync } from "./backup/ScoreboardSync";
import { ActivityLog } from "./backup/ActivityLog";

export class AddOnInit {
  static init() {
    this.registerEvents();
    this.createTasks();
    Peace.getInstance().init();
  }

  static registerEvents() {
    SpawnProtect.registerEvents();

    world.beforeEvents.chatSend.subscribe((event: any) => {
      let firstChar = event.message.substring(0, 1);
      if (firstChar === "!" || firstChar === "！") {
        Command.trigger(event.sender, event.message.substring(1));
        event.cancel = true;
      }
    });

    system.beforeEvents.startup.subscribe(async (e) => {
      // 先初始化存储层（从 HttpDB 加载数据到缓存）
      await Storage.init();

      system.run(() => {
        Money.initScoreboard();
        Command.registerHelpCommand();
        Permission.registerPermlistCommand();
        Command.register("menu", "menu.use", (player: Player | undefined) => {
          if (player) MainMenu.show(player);
        }, "主菜单");
        CoopSystem.init();
        ChatSystem.init();
        Clean.getInstance()!.init();
        AFK.init();
        TPS.getInstance().init();
        OnlineTime.getInstance().init();
        CreativeArea.getInstance().init();
        SurvivalArea.getInstance().init();
        InventorySwitcher.getInstance().init();
        LandSystem.init();
        MoneyCommand.init();
        ShopSystem.getInstance().init();
        ScoreboardSync.init();
        ActivityLog.init();
        Command.register("shop", "shop.use", (player: Player | undefined) => {
          if (player) ShopSystem.getInstance().showShop(player);
        }, "商店");
      });
    });

    world.afterEvents.playerSpawn.subscribe(event => {
      // 进服事件
      if (event.initialSpawn) {
        Fly.playerJoinEvent(event.player);
        AFK.reset(event.player);
      }
    });
  }

  /**
   * 创建定时任务
   */
  static createTasks() {
    QAManager.getInstance().start();
  }
}
