import { GameMode, Player, system, world, ScriptEventCommandMessageAfterEvent } from "@minecraft/server";
import * as Tool from "./libs/Tools"
import * as Clean from "./doge/Clean"
import * as Fly from "./doge/Fly"

// Script Event
system.afterEvents.scriptEventReceive.subscribe(event => {
    system.run(()=>{
        switch(event.id){
            case "doge:clean": Clean.startClean(event); break;
            case "doge:help": break;
            default: break;
        }
    })
}, {namespaces: ["doge"]});

// Player spawn
world.afterEvents.playerSpawn.subscribe(event => {
    // 进服事件
    if(event.initialSpawn){
        Fly.playerJoinEvent(event.player);
    }
});