import { world } from "@minecraft/server";
const MONEY_NAME = "money";
export class Money {
    static get(player) {
        const scoreboard = world.scoreboard.getObjective(MONEY_NAME);
        try {
            const score = scoreboard.getScore(player);
            if (score !== undefined)
                return score;
        }
        catch ( /* ignore */_a) { /* ignore */ }
        world.scoreboard.getObjective(MONEY_NAME).setScore(player, 0);
        return 0;
    }
    static set(player, money) {
        world.scoreboard.getObjective(MONEY_NAME).setScore(player, money);
    }
    static initScoreboard() {
        if (world.scoreboard.getObjective(MONEY_NAME) == null) {
            world.getDimension("overworld").runCommand(`scoreboard objectives add ${MONEY_NAME} dummy ${MONEY_NAME}`);
        }
    }
}
//# sourceMappingURL=Money.js.map