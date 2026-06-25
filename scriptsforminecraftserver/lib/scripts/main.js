import { world } from "@minecraft/server";
import * as Fly from "./doge/Fly";
import * as AFK from "./doge/AFK";
import { QAManager } from "./doge/QA";
import "./core/index";
// Player spawn
world.afterEvents.playerSpawn.subscribe(event => {
    if (event.initialSpawn) {
        Fly.playerJoinEvent(event.player);
        for (const player of world.getAllPlayers()) {
            AFK.reset(player);
        }
    }
});
let QA;
world.afterEvents.worldLoad.subscribe(() => {
    QA = new QAManager();
});
//# sourceMappingURL=main.js.map