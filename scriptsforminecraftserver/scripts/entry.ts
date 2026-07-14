import { system, world, Player } from "@minecraft/server";

import { Money } from "./libs/Money";
import { Permission } from "./libs/Permission";
import { Command, setModuleGuard } from "./libs/Command";
import { ConfigManager } from "./libs/ConfigManager";
import { Modules } from "./libs/ModuleKeys";
import { ModuleRegistry, guardEvent, announceLoaded } from "./libs/ModuleRegistry";

import { QAManager } from "./doge/QA";
import * as AFK from "./doge/AFK";
import { Clean, registerCommand as registerCleanCommand } from "./doge/Clean";
import { TPS } from "./doge/TPS";
import { OnlineTime } from "./doge/OnlineTime";
import { ChatSoundsHelper } from "./doge/ChatSoundsHelper";
import { MonitorReporter } from "./doge/MonitorReporter";
import { SpawnProtect } from "./doge/SpawnProtect";

import * as Fly from "./area/Fly";
import { Peace } from "./area/Peace";
import { CoopSystem } from "./coop/CoopSystem";
import { ChatSystem } from "./chat/ChatSystem";
import { CreativeArea } from "./area/CreativeArea";
import { SurvivalArea } from "./area/SurvivalArea";
import { InventorySwitcher } from "./area/InventorySwitcher";
import { LandSystem } from "./land/LandSystem";
import { LandCore } from "./land/LandCore";
import { LandEvents } from "./land/LandEvents";
import { MoneyGUI } from "./gui/MoneyGUI";
import { MainMenu } from "./gui/MainMenu";
import { AdminGUI } from "./gui/AdminGUI";
import { ScoreboardSync, ScoreboardsBackup } from "./data/Scoreboards";
import { ActivityLog } from "./data/ActivityLog";
import { syncWorldData } from "./data/World";
import { getPlayerData } from "./data/Player";
import { savePlayers } from "./api";
import { HoloEntity } from "./holo/HoloEntity";
import { HoloGUI } from "./holo/HoloGUI";

ModuleRegistry.register({
  id: "fly",
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions: () => Fly.init(),
    init: () => Fly.boot(),
    cleanup: () => Fly.stop(),
  },
});

ModuleRegistry.register({
  id: "onlineTime",
  afterWorldLoad: true,
  lifecycle: {
    registerPermissions: () => OnlineTime.getInstance().registerCommandsAndPermissions(),
    registerEvents: () => OnlineTime.getInstance().registerEvents(),
    init: () => OnlineTime.getInstance().init(),
    cleanup: () => OnlineTime.getInstance().stop(),
  },
});

ModuleRegistry.register({
  id: "creative",
  afterWorldLoad: true,
  lifecycle: {
    registerPermissions: () => CreativeArea.getInstance().registerCommandsAndPermissions(),
    registerEvents: () => CreativeArea.getInstance().registerEvents(),
    init: () => CreativeArea.getInstance().init(),
    cleanup: () => CreativeArea.getInstance().cleanup(),
  },
});

ModuleRegistry.register({
  id: "survival",
  afterWorldLoad: true,
  lifecycle: {
    registerPermissions: () => SurvivalArea.getInstance().registerCommandsAndPermissions(),
    registerEvents: () => SurvivalArea.getInstance().registerEvents(),
    init: () => SurvivalArea.getInstance().init(),
    cleanup: () => SurvivalArea.getInstance().cleanup(),
  },
});

ModuleRegistry.register({
  id: "land",
  afterWorldLoad: true,
  lifecycle: {
    registerPermissions: () => LandSystem.registerCommandsAndPermissions(),
    registerEvents: () => LandEvents.registerEvents(),
    init: () => LandSystem.init(),
    cleanup: () => { LandEvents.cleanup(); LandSystem.cleanup(); },
  },
});

ModuleRegistry.register({
  id: "money",
  afterWorldLoad: true,
  lifecycle: {
    registerCommands: () => MoneyGUI.registerCommand(),
    init: () => Money.initScoreboard(),
  },
});

ModuleRegistry.register({
  id: "holoprint",
  afterWorldLoad: true,
  lifecycle: {
    registerCommands: () => HoloGUI.registerCommand(),
    registerEvents: () => HoloEntity.registerEvents(),
    init: () => HoloEntity.init(),
    cleanup: () => HoloEntity.cleanup(),
  },
});

ModuleRegistry.register({
  id: "afk",
  afterWorldLoad: true,
  lifecycle: {
    registerCommands: () => AFK.registerCommand(),
    init: () => AFK.init(),
    cleanup: () => AFK.stop(),
  },
});

ModuleRegistry.register({
  id: "coop",
  afterWorldLoad: true,
  lifecycle: {
    registerCommands: () => CoopSystem.registerCommands(),
    init: () => CoopSystem.init(),
  },
});

ModuleRegistry.register({
  id: "chat",
  afterWorldLoad: true,
  lifecycle: {
    registerCommands: () => ChatSystem.registerCommands(),
    registerEvents: () => ChatSystem.registerEvents(),
    init: () => ChatSystem.init(),
    cleanup: () => ChatSystem.cleanup(),
  },
});

ModuleRegistry.register({
  id: "tps",
  afterWorldLoad: true,
  lifecycle: {
    registerCommands: () => TPS.registerCommands(),
    init: () => TPS.init(),
    cleanup: () => TPS.stop(),
  },
});

ModuleRegistry.register({
  id: "clean",
  afterWorldLoad: true,
  lifecycle: {
    registerCommands: () => registerCleanCommand(),
    init: () => Clean.getInstance()!.init(),
    cleanup: () => Clean.getInstance()!.stop(),
  },
});

ModuleRegistry.register({
  id: "inventorySwitcher",
  afterWorldLoad: true,
  lifecycle: {
    registerEvents: () => InventorySwitcher.getInstance().registerEvents(),
    init: () => InventorySwitcher.getInstance().init(),
    cleanup: () => InventorySwitcher.getInstance().cleanup(),
  },
});

ModuleRegistry.register({
  id: "activityLog",
  afterWorldLoad: true,
  lifecycle: {
    registerEvents: () => ActivityLog.registerEvents(),
    init: () => ActivityLog.init(),
    cleanup: () => ActivityLog.cleanup(),
  },
});

ModuleRegistry.register({
  id: "scoreboardSync",
  afterWorldLoad: true,
  lifecycle: {
    registerCommands: () => ScoreboardSync.registerCommands(),
    init: () => ScoreboardSync.init(),
    cleanup: () => ScoreboardsBackup(),
  },
});

ModuleRegistry.register({
  id: "chatSounds",
  afterWorldLoad: true,
  lifecycle: {
    init: () => ChatSoundsHelper.getInstance().registerEvent(),
    cleanup: () => ChatSoundsHelper.getInstance().stop(),
  },
});

ModuleRegistry.register({
  id: "monitor",
  afterWorldLoad: false,
  lifecycle: {
    init: () => MonitorReporter.init(),
    cleanup: () => MonitorReporter.stop(),
  },
});

ModuleRegistry.register({
  id: "peace",
  afterWorldLoad: false,
  lifecycle: {},
});

ModuleRegistry.register({
  id: "qa",
  afterWorldLoad: false,
  lifecycle: {
    init: () => QAManager.getInstance().start(),
    cleanup: () => QAManager.getInstance().stop(),
  },
});

ModuleRegistry.register({
  id: "spawnProtect",
  afterWorldLoad: false,
  lifecycle: {},
});

export class AddOnInit {
  static init() {
    this.registerEvents();
  }

  static registerEvents() {
    system.beforeEvents.startup.subscribe(async () => {
      system.run(async () => {
        await ConfigManager.init();
        ConfigManager.startPolling();
        ConfigManager.startFastPoll();

        Permission.register("permlist.see", Permission.Member);
        Permission.register("help.see", Permission.Member);
        Permission.register("menu.use", Permission.Member);
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

        Permission.registerPermlistCommand();
        Command.registerHelpCommand();
        MainMenu.registerMenuCommand();
        Command.register("admin", "chat.admin", (player: Player | undefined) => {
          if (player) AdminGUI.show(player);
        }, "管理面板");

        // 命令守卫：模块禁用时拦截该模块下的命令
        setModuleGuard((moduleId) => {
          const idKey = moduleId as keyof typeof Modules;
          return ModuleRegistry.isActive(idKey);
        });

        ModuleRegistry.bootAll();
        ModuleRegistry.snapshotEnabled();
        announceLoaded();
      });
    });

    world.afterEvents.worldLoad.subscribe(() => {
      if (!guardEvent()) return;
      ModuleRegistry.bootAfterWorldLoad();
      MonitorReporter.init();
      syncWorldData();
    });

    world.afterEvents.playerSpawn.subscribe((event) => {
      void Money.load(event.player);
      if (!guardEvent()) return;
      if (event.initialSpawn) {
        if (ModuleRegistry.isActive("peace")) Peace.getInstance().init();
        if (ModuleRegistry.isActive("fly")) Fly.playerJoinEvent(event.player);
        if (ModuleRegistry.isActive("afk")) AFK.reset(event.player);

        getPlayerData(event.player).then((data) => {
          savePlayers([data]).catch(() => {});
        });
      }
      if (ModuleRegistry.isActive("spawnProtect")) {
        SpawnProtect.setProtect(event.player);
      }
    });

    world.afterEvents.playerLeave.subscribe((event) => {
      if (!guardEvent()) return;
      LandCore.clearSession(event.playerId);
      if (ModuleRegistry.isActive("onlineTime")) {
        OnlineTime.getInstance().onPlayerLeave({ id: event.playerId });
      }
      const player = world.getEntity(event.playerId) as Player;
      if (player) {
        getPlayerData(player).then((data) => {
          savePlayers([data]).catch(() => {});
        });
      }
    });

    world.beforeEvents.chatSend.subscribe((event: any) => {
      if (!guardEvent()) return;
      let firstChar = event.message.substring(0, 1);
      if (firstChar === "!" || firstChar === "！") {
        Command.trigger(event.sender, event.message.substring(1));
        event.cancel = true;
      }
    });

    system.beforeEvents.shutdown.subscribe(() => {
      if (!guardEvent()) return;
      ModuleRegistry.teardown();
      syncWorldData();
    });
  }

  static createTasks() {
    if (!ConfigManager.isReady()) return;
    ModuleRegistry.bootTasks();
  }
}
