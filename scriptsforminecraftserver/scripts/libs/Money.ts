import { Player, world } from "@minecraft/server";

if (world.scoreboard.getObjective("money") == null) {
    world.getDimension("overworld").runCommand("scoreboard objectives add money dummy money");
}

export class Money {
    static get(player: Player): number {
        const scores = world.scoreboard.getObjective("money")!.getScores();
        const name = player.nameTag;

        for (const s of scores) {
            if (s.participant.displayName === name) {
                return s.score;
            }
        }
        player.runCommand("scoreboard players add @s money 0");
        return 0;
    }

    static set(player: Player, money: number): void {
        player.runCommand(`scoreboard players set @s money ${money}`);
    }

    static add(pl: Player, money: number): void {
        return this.set(pl, this.get(pl) + money);
    }
}
