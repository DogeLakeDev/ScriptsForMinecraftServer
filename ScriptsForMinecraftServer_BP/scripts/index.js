import { GameMode, Player, system, world, ScriptEventCommandMessageAfterEvent } from "@minecraft/server";
import * as Tool from "./libs/Tools"
import * as Clean from "./doge/Clean"
import * as Fly from "./doge/Fly"
import * as AFK from "./doge/AFK";
import * as Peace from "./doge/Peace"
import { QAManager } from "./doge/QA";
import "./core/index";

// Script Event
system.afterEvents.scriptEventReceive.subscribe(event => {
    system.run(()=>{
        switch(event.id){
            case "doge:clean": Clean.startClean(event); break; // 立即开始清理掉落物
            case "doge:afk": AFK.setAFK(event.sourceEntity); break; // 令玩家立即进入AFK状态
            case "doge:noafk": event.sourceEntity.addTag("NOAFK"); break; // 令玩家不会被AFK检测
            case "doge:peace":
                event.sourceEntity.sendMessage(Peace.switchPeace() ? "开启区域和平": "关闭区域和平"); break;
            default: event.sourceEntity.sendMessage(`doge:clean, doge:afk, doge:noafk, doge:peace, doge:qa`); break;
        }
    })
}, {namespaces: ["doge"]});

// Player spawn
world.afterEvents.playerSpawn.subscribe(event => {
    // 进服事件
    if(event.initialSpawn){
        Fly.playerJoinEvent(event.player);
        AFK.reset();
    }
});

var QA;
world.afterEvents.worldInitialize.subscribe(()=>{
    QA = new QAManager()
});