import { system, world, ScriptEventCommandMessageAfterEvent } from "@minecraft/server";
import { Config } from "../data/Config";
import { Command } from "../core/Command";
import { Permission } from "../core/Permission";

let isCleaning = false;

world.getDimension("overworld").runCommand("scoreboard objectives add item_amount dummy item_amount");
world.getDimension("overworld").runCommand(`scoreboard players set target_value item_amount ${Config.ITEMMAX}`);

system.runInterval(() => {
    if (!isCleaning) {
        const dim = world.getDimension("overworld");
        dim.runCommand("scoreboard players set value item_amount 0");
        dim.runCommand(`execute as @e[type=item,c=${Config.ITEMMAX + 1}] run scoreboard players add value item_amount 1`);
        dim.runCommand("execute if score value item_amount > target_value item_amount run scriptevent doge:clean");
    }
}, 1200);

export function startClean(event: ScriptEventCommandMessageAfterEvent): void {
    isCleaning = true;
    const dimension = world.getDimension("overworld");
    world.sendMessage({ "rawtext": [{ "text": "「§6読経するヤマビコ ~ 幽谷 響子§f」 距离清理掉落物还有§c 60 §fs" }] });

    system.runTimeout(() => {
        world.sendMessage({ "rawtext": [{ "text": "「§6読経するヤマビコ ~ 幽谷 響子§f」 距离清理掉落物还有§c 30 §fs" }] });

        system.runTimeout(() => {
            world.sendMessage({ "rawtext": [{ "text": "「§6読経するヤマビコ ~ 幽谷 響子§f」 距离清理掉落物还有§c 10 §fs" }] });

            system.runTimeout(() => {
                world.sendMessage({ "rawtext": [{ "text": "「§6読経するヤマビコ ~ 幽谷 響子§f」 距离清理掉落物还有§c 5 §fs" }] });

                system.runTimeout(() => {
                    dimension.runCommand("execute as @e[type=item] at @s run tp @p");
                    world.sendMessage({ "rawtext": [{ "text": "§a* 已清理掉落物 *" }] });

                    system.runTimeout(() => {
                        isCleaning = false;
                    }, 2400);
                }, 100);
            }, 100);
        }, 400);
    }, 600);
}

function registerCommand(): void {
    Command.register("clean", Permission.OP, () => {
        world.sendMessage("§e!clean 命令已执行，开始清理掉落物");
        return undefined;
    }, "开始扫地");
}

registerCommand();
