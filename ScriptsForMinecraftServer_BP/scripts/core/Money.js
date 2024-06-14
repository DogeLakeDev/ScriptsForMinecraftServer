import { Player, world } from "@minecraft/server";
import { Command } from "./Command";

let MONEY_NAME = "money"

export class Money{
    /**
     * Get Money
     * @param {Player} player 
     * @returns 
     */
    static get(player){
        let scoreboard = world.scoreboard.getObjective(MONEY_NAME);
        try{
            let score = scoreboard.getScore(player);
            if(score !== undefined) return score;
        }
        catch{ }

        world.scoreboard.getObjective(MONEY_NAME).setScore(player, 0);
        return 0;
    }
    /**
     * Set Money
     * @param {Player} player 
     * @param {Number} money 
     * @returns 
     */
    static set(player, money){
        return world.scoreboard.getObjective(MONEY_NAME).setScore(player, money);
    }
    static initScoreboard(){
        if(world.scoreboard.getObjective(MONEY_NAME) == null){
            world.getDimension("overworld").runCommand(`scoreboard objectives add ${MONEY_NAME} dummy ${MONEY_NAME}`);
        }
    }
}
