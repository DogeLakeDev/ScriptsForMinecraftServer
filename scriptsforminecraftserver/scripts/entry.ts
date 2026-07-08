/**
 * 模组初始化
 */
import { system, world, Player } from "@minecraft/server";
import { Money } from "./libs/Money";
import { Command } from "./libs/Command";
import { QAManager } from "./doge/QA";
import * as Fly from "./area/Fly";
import { init as initDogeMenu } from "./doge/Menu";
import * as AFK from "./doge/AFK";
import { SpawnProtect } from "./doge/SpawnProtect";
import { Clean, registerCommand as registerCleanCommand } from "./doge/Clean";
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
import { LandEvents } from "./land/LandEvents";
import { MoneyGUI } from "./gui/MoneyGUI";
import { MainMenu } from "./gui/MainMenu";
import { ShopSystem } from "./shop/ShopSystem";
import { ScoreboardSync, ScoreboardsBackup } from "./data/Scoreboards";
import { ActivityLog } from "./data/ActivityLog";
import { syncWorldData } from "./data/World";
import { getPlayerData } from "./data/Player";
import { savePlayers } from "./api/PlayersDataApi";
import { HoloEntity } from "./holo/HoloEntity";
import { HoloGUI } from "./holo/HoloGUI";

export class AddOnInit {
  static init() {
    this.registerEvents();
    this.createTasks();
  }

  static registerEvents() {
    system.beforeEvents.startup.subscribe(async (e) => {
      system.run(() => {
        Permission.register("permlist.see", Permission.Member);
        Permission.register("help.see", Permission.Member);
        Permission.register("menu.use", Permission.Member);
        Permission.register("shop.use", Permission.Member);
        Permission.register("money.admin", Permission.OP);
        Permission.register("holorint.menu", Permission.Member);
        Permission.register("holorint.pos1", Permission.Member);
        Permission.register("holorint.pos2", Permission.Member);
        Permission.register("afk.use", Permission.Member);
        Permission.register("afk.clear.other", Permission.OP);
        CoopSystem.registerPermissions();
        Permission.register("chat.use", Permission.Member);
        Permission.register("chat.admin", Permission.OP);
        Permission.register("tps.see", Permission.Any);

        Fly.init();
        initDogeMenu();
        OnlineTime.getInstance().registerCommandsAndPermissions();
        CreativeArea.getInstance().registerCommandsAndPermissions();
        SurvivalArea.getInstance().registerCommandsAndPermissions();
        LandSystem.registerCommandsAndPermissions();

        Permission.registerPermlistCommand();
        Command.registerHelpCommand();
        MainMenu.registerMenuCommand();
        MoneyGUI.registerCommand();
        ShopSystem.registerCommand();
        HoloGUI.registerCommand();
        AFK.registerCommand();
        CoopSystem.registerCommands();
        ChatSystem.registerCommands();
        TPS.registerCommands();
        registerCleanCommand();
      });
    });

    world.afterEvents.worldLoad.subscribe(() => {
      AFK.init();
      CoopSystem.init();
      ChatSystem.init();
      Clean.getInstance()!.init();
      TPS.init();
      OnlineTime.getInstance().init();
      CreativeArea.getInstance().init();
      SurvivalArea.getInstance().init();
      InventorySwitcher.getInstance().init();
      LandSystem.init();
      ActivityLog.init();
      Money.initScoreboard();
      ScoreboardSync.init();
      syncWorldData();
      HoloEntity.init();
    });

    OnlineTime.getInstance().registerEvents();
    CreativeArea.getInstance().registerEvents();
    SurvivalArea.getInstance().registerEvents();
    InventorySwitcher.getInstance().registerEvents();
    LandEvents.registerEvents();
    ActivityLog.registerEvents();
    HoloEntity.registerEvents();
    ChatSystem.registerEvents();

    world.afterEvents.playerSpawn.subscribe((event) => {
      if (event.initialSpawn) {
        Peace.getInstance().init();
        Fly.playerJoinEvent(event.player);
        AFK.reset(event.player);

        // 玩家进服时保存玩家数据
        getPlayerData(event.player).then((data) => {
          savePlayers([data]).catch(() => {});
        });
      }
    });

    // 玩家退出时保存玩家数据和在线时间
    world.afterEvents.playerLeave.subscribe((event) => {
      const player = world.getEntity(event.playerId) as Player;
      if (player) {
        getPlayerData(player).then((data) => {
          savePlayers([data]).catch(() => {});
        });
        OnlineTime.getInstance().onPlayerLeave(player);
      }
    });

    world.afterEvents.playerSpawn.subscribe((ev) => {
      SpawnProtect.setProtect(ev.player);
    });

    world.beforeEvents.chatSend.subscribe((event: any) => {
      let firstChar = event.message.substring(0, 1);
      if (firstChar === "!" || firstChar === "！") {
        Command.trigger(event.sender, event.message.substring(1));
        event.cancel = true;
      }
    });

    // 服务器停止时保存世界数据和计分板
    system.beforeEvents.shutdown.subscribe(() => {
      syncWorldData();
      ScoreboardsBackup();
    });
  }

  static createTasks() {
    QAManager.getInstance().start();
  }
}
