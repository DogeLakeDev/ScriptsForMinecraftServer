import { world } from "@minecraft/server";

export class Command{

    static register(){

    }

    static chatEvent(){

    }
}

world.beforeEvents.chatSend.subscribe((event)=>{
    event.message
});
