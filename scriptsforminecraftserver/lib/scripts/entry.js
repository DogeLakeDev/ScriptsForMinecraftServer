/**
 * 模组初始化
 */
import { system, world } from "@minecraft/server";
import { Command, Money, } from "./core/main";
import { QAManager } from "./doge/QA";
import * as Fly from "./doge/Fly";
import * as AFK from "./doge/AFK";
import { SpawnProtect } from "./doge/SpawnProtect";
import { Clean } from "./doge/Clean";
import { Peace } from "./doge/Peace";
import { ShitMountain } from "./shit/ShitMountain";
export class AddOnInit {
    static init() {
        this.registerEvents();
        this.createTasks();
        Peace.getInstance().init();
    }
    static registerEvents() {
        ShitMountain.cancelChat();
        SpawnProtect.registerEvents();
        world.beforeEvents.chatSend.subscribe((event) => {
            let firstChar = event.message.substring(0, 1);
            if (firstChar === "!" || firstChar === "！") {
                Command.trigger(event.sender, event.message.substring(1));
                event.cancel = true;
            }
        });
        system.beforeEvents.startup.subscribe((e) => {
            system.run(() => {
                Money.initScoreboard();
                Command.registerHelpCommand();
                Clean.getInstance().init();
                AFK.init();
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
//# sourceMappingURL=entry.js.map