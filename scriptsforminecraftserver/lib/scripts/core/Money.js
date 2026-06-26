import { world } from "@minecraft/server";
const MONEY_NAME = 'money';
export class Money {
    /**
     * 获取玩家金钱
     */
    static get(player) {
        let scoreboard = world.scoreboard.getObjective(MONEY_NAME);
        if (!scoreboard)
            return 0;
        try {
            let score = scoreboard.getScore(player);
            if (score !== undefined) {
                return score;
            }
        }
        catch (_) { }
        if (scoreboard) {
            scoreboard.setScore(player, 0);
        }
        return 0;
    }
    /**
     * 设置玩家金钱
     */
    static set(player, money) {
        let scoreboard = world.scoreboard.getObjective(MONEY_NAME);
        if (!scoreboard) {
            world.getDimension('overworld').runCommand(`scoreboard objectives add ${MONEY_NAME} dummy ${MONEY_NAME}`);
            scoreboard = world.scoreboard.getObjective(MONEY_NAME);
        }
        return scoreboard.setScore(player, money);
    }
    /**
     * 给予玩家金钱
     */
    static add(pl, money) {
        return this.set(pl, this.get(pl) + money);
    }
    /**
     * 初始化计分板
     */
    static initScoreboard() {
        if (!world.scoreboard.getObjective(MONEY_NAME)) {
            world.getDimension("overworld")
                .runCommand(`scoreboard objectives add ${MONEY_NAME} dummy ${MONEY_NAME}`);
        }
    }
}
//# sourceMappingURL=Money.js.map