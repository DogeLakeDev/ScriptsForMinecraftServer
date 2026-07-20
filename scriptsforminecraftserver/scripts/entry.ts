import { Player, system, world } from "@minecraft/server";
import { Command, debug, Money, Msg, Permission, setModuleGuard } from "@sfmc/sdk/sapi/runtime";
import {
  ConfigManager,
  Modules,
  ModuleRegistry,
  announceLoaded,
  guardEvent,
} from "@sfmc/sdk/module-loader";

import * as AFK from "./doge/AFK.js";
import { ChatSoundsHelper } from "@sfmc/module-chat-sounds";
import { Clean, registerCommand as registerCleanCommand } from "./doge/Clean.js";
import { DailyTask } from "@sfmc/module-daily-task";
import { MonitorReporter } from "@sfmc/module-monitor";
import { OnlineTime } from "./doge/OnlineTime.js";
import { QAManager } from "./doge/QA.js";
import { SpawnProtect } from "@sfmc/module-spawn-protect";
import { TPS } from "@sfmc/module-tps";
import { EconomyReport } from "./EconomyReport.js";

import { CreativeArea } from "@sfmc/module-creative";
import * as Fly from "@sfmc/module-fly";
import { InventorySwitcher } from "@sfmc/module-inventory-switcher";
import { Peace } from "@sfmc/module-peace";
import { SurvivalArea } from "@sfmc/module-survival";

import { LandEvents } from "@sfmc/module-land";
import { LandSystem } from "@sfmc/module-land";

import { AdminGUI, MainMenu, MoneyGUI } from "@sfmc/module-gui";

import { CoopSystem } from "@sfmc/module-coop";

import { ChatSystem } from "@sfmc/module-chat";

import { ActivityLog } from "@sfmc/module-activity-log";
import { getPlayerData } from "./data/PlayerData.js";
import { ScoreboardSync, ScoreboardsBackup } from "@sfmc/module-scoreboard-sync";
import { syncWorldData } from "./data/WorldData.js";

import { savePlayers } from "./api/PlayersDataApi.js";

// ============================================================
//  模块注册
// ============================================================

// ---- core-config（配置中心）----
debug.i("SYS", "register module: config");
ModuleRegistry.register({
  id: "config",
  afterWorldLoad: false,
  lifecycle: {
    registerCommands: () => {
      Command.register(
        "admin",
        "chat.admin",
        (player: Player | undefined) => {
          if (player) AdminGUI.show(player);
        },
        "管理面板"
      );
    },
    init: () => {
      // 配置在 AddOnInit.init() 时已通过 ConfigManager.init() 一次性加载，
      // 不再轮询 / 热重载。改 configs/*.json 后重启 BDS 即可。
    },
  },
});

// ---- core-command（命令系统）----
debug.i("SYS", "register module: command");
ModuleRegistry.register({
  id: "command",
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions: () => {
      Permission.register("help.see", Permission.Member);
      Permission.register("permlist.see", Permission.Member);
    },
    registerCommands: () => {
      Command.registerHelpCommand();
      Permission.registerPermlistCommand();
    },
    registerEvents: () => {
      world.beforeEvents.chatSend.subscribe((event: any) => {
        if (!guardEvent()) return;
        const firstChar = event.message.substring(0, 1);
        if (firstChar === "!" || firstChar === "！") {
          Command.trigger(event.sender, event.message.substring(1));
          event.cancel = true;
        }
      });
    },
  },
});

// ---- data-backup（数据备份）----
debug.i("SYS", "register module: dataBackup");
ModuleRegistry.register({
  id: "dataBackup",
  afterWorldLoad: false,
  lifecycle: {
    registerEvents: () => {
      world.afterEvents.playerSpawn.subscribe((event) => {
        if (!guardEvent()) return;
        if (event.initialSpawn) {
          getPlayerData(event.player).then((data) => {
            savePlayers([data]).catch(() => {});
          });
        }
      });
      world.afterEvents.playerLeave.subscribe(async (event) => {
        if (!guardEvent()) return;
        const player = world.getEntity(event.playerId) as Player;
        if (player) {
          try {
            const data = await getPlayerData(player);
            await savePlayers([data]);
          } catch {}
        }
      });
    },
    cleanup: () => {
      syncWorldData();
    },
  },
});

// ---- gui（主菜单）----
debug.i("SYS", "register module: gui");
ModuleRegistry.register({
  id: "gui",
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions: () => {
      Permission.register("menu.use", Permission.Member);
    },
    registerCommands: () => {
      MainMenu.registerMenuCommand();
    },
  },
});

// ---- fly（区域飞行）----
debug.i("SYS", "register module: fly");
ModuleRegistry.register({
  id: "fly",
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions: () => Fly.registerPermissions(),
    registerEvents: () => Fly.registerEvents(),
    init: () => Fly.boot(),
    cleanup: () => Fly.stop(),
  },
});

// ---- onlineTime（在线时长统计）----
debug.i("SYS", "register module: onlineTime");
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

// ---- creative（创造区域）----
debug.i("SYS", "register module: creative");
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

// ---- survival（生存区域）----
debug.i("SYS", "register module: survival");
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

// ---- land（领地系统）----
debug.i("SYS", "register module: land");
ModuleRegistry.register({
  id: "land",
  afterWorldLoad: true,
  lifecycle: {
    registerPermissions: () => LandSystem.registerCommandsAndPermissions(),
    registerEvents: () => LandEvents.registerEvents(),
    init: () => LandSystem.init(),
    cleanup: () => {
      LandEvents.cleanup();
      LandSystem.cleanup();
    },
  },
});

// ---- money（经济系统）----
debug.i("SYS", "register module: money");
ModuleRegistry.register({
  id: "money",
  afterWorldLoad: true,
  lifecycle: {
    registerPermissions: () => Permission.register("money.admin", Permission.OP),
    registerCommands: () => MoneyGUI.registerCommand(),
    registerEvents: () => {
      world.afterEvents.playerSpawn.subscribe((event) => {
        void Money.load(event.player);
      });
    },
    init: () => {
      Money.initScoreboard();
      Command.deductCost = async (player, amount, commandName) => {
        return Money.add(player, -amount);
      };
      EconomyReport.start();
    },
    cleanup: () => {
      EconomyReport.stop();
    },
  },
});

// ---- afk（挂机判定）----
debug.i("SYS", "register module: afk");
ModuleRegistry.register({
  id: "afk",
  afterWorldLoad: true,
  lifecycle: {
    registerPermissions: () => AFK.registerPermissions(),
    registerCommands: () => AFK.registerCommand(),
    registerEvents: () => AFK.registerEvents(),
    init: () => AFK.init(),
    cleanup: () => AFK.stop(),
  },
});
// ---- coop（合作社）----
debug.i("SYS", "register module: coop");
ModuleRegistry.register({
  id: "coop",
  afterWorldLoad: true,
  lifecycle: {
    registerPermissions: () => CoopSystem.registerPermissions(),
    registerCommands: () => CoopSystem.registerCommands(),
    init: () => CoopSystem.init(),
  },
});

// ---- chat（聊天系统）----
debug.i("SYS", "register module: chat");
ModuleRegistry.register({
  id: "chat",
  afterWorldLoad: true,
  lifecycle: {
    registerPermissions: () => {
      Permission.register("chat.use", Permission.Member);
      Permission.register("chat.admin", Permission.OP);
    },
    registerCommands: () => ChatSystem.registerCommands(),
    registerEvents: () => ChatSystem.registerEvents(),
    init: () => ChatSystem.init(),
    cleanup: () => ChatSystem.cleanup(),
  },
});

// ---- tps（性能监控）----
debug.i("SYS", "register module: tps");
ModuleRegistry.register({
  id: "tps",
  afterWorldLoad: true,
  lifecycle: {
    registerPermissions: () => TPS.registerPermissions(),
    registerCommands: () => TPS.registerCommands(),
    init: () => TPS.init(),
    cleanup: () => TPS.stop(),
  },
});

// ---- clean（掉落物清理）----
debug.i("SYS", "register module: clean");
ModuleRegistry.register({
  id: "clean",
  afterWorldLoad: true,
  lifecycle: {
    registerCommands: () => registerCleanCommand(),
    init: () => Clean.getInstance()!.init(),
    cleanup: () => Clean.getInstance()!.stop(),
  },
});

// ---- priceIndex（价格指数）----
debug.i("SYS", "register module: priceIndex");
ModuleRegistry.register({
  id: "priceIndex",
  afterWorldLoad: false,
  lifecycle: {},
});

// ---- dailyTask（每日任务）----
debug.i("SYS", "register module: dailyTask");
ModuleRegistry.register({
  id: "dailyTask",
  afterWorldLoad: false,
  lifecycle: {
    registerCommands: () => DailyTask.registerCommand(),
  },
});

// ---- inventorySwitcher（背包切换）----
debug.i("SYS", "register module: inventorySwitcher");
ModuleRegistry.register({
  id: "inventorySwitcher",
  afterWorldLoad: true,
  lifecycle: {
    registerEvents: () => InventorySwitcher.getInstance().registerEvents(),
    init: () => InventorySwitcher.getInstance().init(),
    cleanup: () => InventorySwitcher.getInstance().cleanup(),
  },
});

// ---- activityLog（行为日志）----
debug.i("SYS", "register module: activityLog");
ModuleRegistry.register({
  id: "activityLog",
  afterWorldLoad: true,
  lifecycle: {
    registerEvents: () => ActivityLog.registerEvents(),
    init: () => ActivityLog.init(),
    cleanup: () => ActivityLog.cleanup(),
  },
});

// ---- scoreboardSync（计分板同步）----
debug.i("SYS", "register module: scoreboardSync");
ModuleRegistry.register({
  id: "scoreboardSync",
  afterWorldLoad: true,
  lifecycle: {
    registerCommands: () => ScoreboardSync.registerCommands(),
    init: () => ScoreboardSync.init(),
    cleanup: () => ScoreboardsBackup(),
  },
});

// ---- chatSounds（聊天音效）----
debug.i("SYS", "register module: chatSounds");
ModuleRegistry.register({
  id: "chatSounds",
  afterWorldLoad: true,
  lifecycle: {
    init: () => ChatSoundsHelper.getInstance().registerEvent(),
    cleanup: () => ChatSoundsHelper.getInstance().stop(),
  },
});

// ---- monitor（性能上报）----
debug.i("SYS", "register module: monitor");
ModuleRegistry.register({
  id: "monitor",
  afterWorldLoad: false,
  lifecycle: {
    init: () => MonitorReporter.init(),
    cleanup: () => MonitorReporter.stop(),
  },
});

// ---- peace（和平区域）----
debug.i("SYS", "register module: peace");
ModuleRegistry.register({
  id: "peace",
  afterWorldLoad: false,
  lifecycle: {
    registerEvents: () => Peace.getInstance().init(),
  },
});

// ---- qa（问答系统）----
debug.i("SYS", "register module: qa");
ModuleRegistry.register({
  id: "qa",
  afterWorldLoad: false,
  lifecycle: {
    init: () => QAManager.getInstance().start(),
    cleanup: () => QAManager.getInstance().stop(),
  },
});

// ---- spawnProtect（出生保护）----
debug.i("SYS", "register module: spawnProtect");
ModuleRegistry.register({
  id: "spawnProtect",
  afterWorldLoad: false,
  lifecycle: {
    registerEvents: () => SpawnProtect.registerEvents(),
  },
});

// ============================================================
//  初始化入口
// ============================================================
export class AddOnInit {
  static init() {
    this.registerEvents();
  }

  static registerEvents() {
    system.beforeEvents.startup.subscribe(async () => {
      system.run(async () => {
        await ConfigManager.init();

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
      syncWorldData();
    });

    system.beforeEvents.shutdown.subscribe(() => {
      if (!guardEvent()) return;
      ModuleRegistry.teardown();
    });
  }

  static createTasks() {
    if (!ConfigManager.isReady()) return;
    ModuleRegistry.bootTasks();
  }
}
