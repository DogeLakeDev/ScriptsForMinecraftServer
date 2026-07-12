import { system, world } from "@minecraft/server";
import { Money } from "./libs/Money";
import { Command } from "./libs/Command";
import { QAManager } from "./doge/QA";
import * as Fly from "./area/Fly";
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
import { AdminGUI } from "./gui/AdminGUI";
import { ShopSystem } from "./shop/ShopSystem";
import { ScoreboardSync, ScoreboardsBackup } from "./data/Scoreboards";
import { ActivityLog } from "./data/ActivityLog";
import { syncWorldData } from "./data/World";
import { getPlayerData } from "./data/Player";
import { savePlayers } from "./api";
import { HoloEntity } from "./holo/HoloEntity";
import { HoloGUI } from "./holo/HoloGUI";
import { ConfigManager } from "./libs/ConfigManager";
import { ChatSoundsHelper } from "./doge/ChatSoundsHelper";
import { MonitorReporter } from "./doge/MonitorReporter";
export class AddOnInit {
    static init() {
        this.registerEvents();
        this.createTasks();
    }
    static registerEvents() {
        system.beforeEvents.startup.subscribe(async (e) => {
            system.run(async () => {
                await ConfigManager.init();
                ConfigManager.startPolling();
                ConfigManager.startFastPoll();
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
                if (ConfigManager.isEnabled("fly"))
                    Fly.init();
                if (ConfigManager.isEnabled("online_time"))
                    OnlineTime.getInstance().registerCommandsAndPermissions();
                if (ConfigManager.isEnabled("creative"))
                    CreativeArea.getInstance().registerCommandsAndPermissions();
                if (ConfigManager.isEnabled("survival"))
                    SurvivalArea.getInstance().registerCommandsAndPermissions();
                if (ConfigManager.isEnabled("land"))
                    LandSystem.registerCommandsAndPermissions();
                Permission.registerPermlistCommand();
                Command.registerHelpCommand();
                MainMenu.registerMenuCommand();
                if (ConfigManager.isEnabled("money"))
                    MoneyGUI.registerCommand();
                if (ConfigManager.isEnabled("shop"))
                    ShopSystem.registerCommand();
                if (ConfigManager.isEnabled("holoprint"))
                    HoloGUI.registerCommand();
                if (ConfigManager.isEnabled("afk"))
                    AFK.registerCommand();
                if (ConfigManager.isEnabled("coop"))
                    CoopSystem.registerCommands();
                if (ConfigManager.isEnabled("chat"))
                    ChatSystem.registerCommands();
                if (ConfigManager.isEnabled("tps"))
                    TPS.registerCommands();
                if (ConfigManager.isEnabled("clean"))
                    registerCleanCommand();
                Command.register("admin", "chat.admin", (player) => {
                    if (player)
                        AdminGUI.show(player);
                }, "管理面板");
            });
        });
        world.afterEvents.worldLoad.subscribe(() => {
            if (ConfigManager.isEnabled("afk"))
                AFK.init();
            if (ConfigManager.isEnabled("coop"))
                CoopSystem.init();
            if (ConfigManager.isEnabled("chat"))
                ChatSystem.init();
            if (ConfigManager.isEnabled("clean"))
                Clean.getInstance().init();
            if (ConfigManager.isEnabled("tps"))
                TPS.init();
            MonitorReporter.init();
            if (ConfigManager.isEnabled("online_time"))
                OnlineTime.getInstance().init();
            if (ConfigManager.isEnabled("creative"))
                CreativeArea.getInstance().init();
            if (ConfigManager.isEnabled("survival"))
                SurvivalArea.getInstance().init();
            if (ConfigManager.isEnabled("inventory_switcher"))
                InventorySwitcher.getInstance().init();
            if (ConfigManager.isEnabled("land"))
                LandSystem.init();
            if (ConfigManager.isEnabled("activity_log"))
                ActivityLog.init();
            Money.initScoreboard();
            ScoreboardSync.init();
            syncWorldData();
            HoloEntity.init();
            if (ConfigManager.isEnabled("chat_sounds"))
                ChatSoundsHelper.getInstance().registerEvent();
        });
        if (ConfigManager.isEnabled("online_time"))
            OnlineTime.getInstance().registerEvents();
        if (ConfigManager.isEnabled("creative"))
            CreativeArea.getInstance().registerEvents();
        if (ConfigManager.isEnabled("survival"))
            SurvivalArea.getInstance().registerEvents();
        if (ConfigManager.isEnabled("inventory_switcher"))
            InventorySwitcher.getInstance().registerEvents();
        if (ConfigManager.isEnabled("land"))
            LandEvents.registerEvents();
        if (ConfigManager.isEnabled("activity_log"))
            ActivityLog.registerEvents();
        if (ConfigManager.isEnabled("holoprint"))
            HoloEntity.registerEvents();
        if (ConfigManager.isEnabled("chat"))
            ChatSystem.registerEvents();
        world.afterEvents.playerSpawn.subscribe((event) => {
            if (event.initialSpawn) {
                if (ConfigManager.isEnabled("peace"))
                    Peace.getInstance().init();
                if (ConfigManager.isEnabled("fly"))
                    Fly.playerJoinEvent(event.player);
                if (ConfigManager.isEnabled("afk"))
                    AFK.reset(event.player);
                getPlayerData(event.player).then((data) => {
                    savePlayers([data]).catch(() => { });
                });
            }
        });
        world.afterEvents.playerLeave.subscribe((event) => {
            const player = world.getEntity(event.playerId);
            if (player) {
                getPlayerData(player).then((data) => {
                    savePlayers([data]).catch(() => { });
                });
                if (ConfigManager.isEnabled("online_time"))
                    OnlineTime.getInstance().onPlayerLeave(player);
            }
        });
        world.afterEvents.playerSpawn.subscribe((ev) => {
            if (ConfigManager.isEnabled("spawn_protect"))
                SpawnProtect.setProtect(ev.player);
        });
        world.beforeEvents.chatSend.subscribe((event) => {
            let firstChar = event.message.substring(0, 1);
            if (firstChar === "!" || firstChar === "！") {
                Command.trigger(event.sender, event.message.substring(1));
                event.cancel = true;
            }
        });
        system.beforeEvents.shutdown.subscribe(() => {
            syncWorldData();
            ScoreboardsBackup();
        });
    }
    static createTasks() {
        if (ConfigManager.isEnabled("qa"))
            QAManager.getInstance().start();
    }
}
//# sourceMappingURL=entry.js.map