import { Player, world } from "@minecraft/server";
import * as Tool from "./Tools"

if(world.scoreboard.getObjective("money") == null){
    world.getDimension("overworld").runCommand("scoreboard objectives add money dummy money");
}

export class Money{
    /**
     * @param {Player} player
     * @returns {number|undefined}
     */
    static get(player) {
        let scores = world.scoreboard.getObjective("money").getScores();
        let name = player.nameTag;

        for(let s of scores){
            if(s.participant.displayName == name){
                return s.score;
            }
        }
        player.runCommand(`scoreboard players add @s money 0`);
        return 0;
    }
    /**
     * @param {Player} player
     * @param {Number} money
     */
    static set(player, money){
        player.runCommand(`scoreboard players set @s money ${money}`);
    }
    /**
     * @param {Player} player
     * @param {Number} money
     */
    static add(pl, money){
        return this.set(pl, this.get(pl) + money);
    }
}
