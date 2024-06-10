import { world } from "@minecraft/server";


import { Command } from "./Command";

world.beforeEvents.chatSend.subscribe((event)=>{
    let firstChar = event.message.substring(0, 1);
    if(firstChar === "!" || firstChar === "！"){
        Command.trigger(event.sender, event.message.substring(1));
        event.cancel = true;
    }
});


import { Money } from "./Money";

world.afterEvents.worldInitialize.subscribe(()=>{
    Money.initScoreboard();
    Command.registerHelpCommand();
});
