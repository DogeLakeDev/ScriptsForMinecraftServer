import { world } from "@minecraft/server";
import * as Tool from "./libs/Tools";
import * as Clean from "./doge/Clean";
import * as Fly from "./doge/Fly";
import * as AFK from "./doge/AFK";
import * as Peace from "./doge/Peace";
import { Menu } from "./doge/Menu";
import { FormShop } from "./doge/FormShop";
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

let QA: QAManager;
world.afterEvents.worldLoad.subscribe(() => {
    QA = new QAManager();
});
