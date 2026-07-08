import { system, world } from "@minecraft/server";
import { Command } from "../libs/Command";
import { Permission } from "../libs/Permission";
import { Gui } from "../libs/Gui";
import { CustomForm } from "@minecraft/server-ui";
export function entityClean(player) {
    let m = new Map();
    for (let entity of player.dimension.getEntities({ excludeTypes: ["player"] })) {
        let amount = m.get(entity.typeId);
        if (amount === undefined) {
            m.set(entity.typeId, 1);
        }
        else {
            m.set(entity.typeId, amount + 1);
        }
    }
    if (m.size === 0)
        return;
    let arr = Array.from(m);
    arr.sort((a, b) => b[1] - a[1]);
    const form = new CustomForm(player, "实体列表");
    for (let data of arr) {
        form.button(`${data[1]} | ${data[0]}`, () => {
            showActionForm(player, arr, arr.indexOf(data));
        });
    }
    form.closeButton();
    Gui.showForm(player, form, "实体列表");
}
function showActionForm(player, arr, selectionIndex) {
    const form = new CustomForm(player, "处理方式");
    form.button("remove", () => {
        let entities = player.dimension.getEntities({ type: arr[selectionIndex][0] });
        for (let en of entities)
            en.remove();
    });
    form.button("kill", () => {
        player.runCommand(`kill @e[type=${arr[selectionIndex][0]}]`);
    });
    form.button("tp", () => {
        player.runCommand(`tp @s @e[c=1,type=${arr[selectionIndex][0]}]`);
    });
    form.closeButton();
    Gui.showForm(player, form, "处理方式");
}
export function temp(player) {
    let ens = player.dimension.getEntities({ type: "dogelake:grid_blue" });
    for (let en of ens) {
        let res = `${en.typeId} (${en.location.x}, ${en.location.y}, ${en.location.z})\n`;
        res += `doge:depth | ${en.getProperty("doge:depth")}\n`;
        res += `doge:direction | ${en.getProperty("doge:direction")}\n`;
        res += `doge:alpha | ${en.getProperty("doge:alpha")}\n`;
        player.sendMessage(res);
    }
    ens = player.dimension.getEntities({ type: "dogelake:grid_red" });
    for (let en of ens) {
        let res = `${en.typeId} (${en.location.x}, ${en.location.y}, ${en.location.z})\n`;
        res += `doge:depth | ${en.getProperty("doge:depth")}\n`;
        res += `doge:direction | ${en.getProperty("doge:direction")}\n`;
        res += `doge:alpha | ${en.getProperty("doge:alpha")}\n`;
        player.sendMessage(res);
    }
    ens = player.dimension.getEntities({ type: "dogelake:moon_blue" });
    for (let en of ens) {
        let res = `${en.typeId} (${en.location.x}, ${en.location.y}, ${en.location.z})\n`;
        res += `doge:depth | ${en.getProperty("doge:depth")}\n`;
        res += `doge:direction | ${en.getProperty("doge:direction")}\n`;
        res += `doge:alpha | ${en.getProperty("doge:alpha")}\n`;
        res += `doge:x | ${en.getProperty("doge:x")}\n`;
        res += `doge:z | ${en.getProperty("doge:z")}\n`;
        res += `doge:scale | ${en.getProperty("doge:scale")}\n`;
        player.sendMessage(res);
    }
    ens = player.dimension.getEntities({ type: "dogelake:galaxy_blue" });
    for (let en of ens) {
        let res = `${en.typeId} (${en.location.x}, ${en.location.y}, ${en.location.z})\n`;
        res += `doge:depth | ${en.getProperty("doge:depth")}\n`;
        res += `doge:direction | ${en.getProperty("doge:direction")}\n`;
        res += `doge:alpha | ${en.getProperty("doge:alpha")}\n`;
        player.sendMessage(res);
    }
}
function registerCommand() {
    Permission.register("entity_control.clear", Permission.OP);
    Command.register("en", "entity_control.clear", (player) => entityClean(player), "清理实体");
}
registerCommand();
var iron_start = 0;
var iron_amount = 0;
var ironSubscription;
function killStatistics() {
    Permission.register("entity_control.inspect", Permission.OP);
    Command.register("en_i", "entity_control.inspect", (player) => {
        iron_start = new Date().getTime();
        iron_amount = 0;
        if (ironSubscription) {
            ironSubscription();
            ironSubscription = undefined;
        }
        const callback = (ev) => {
            iron_amount++;
        };
        world.afterEvents.entityDie.subscribe(callback, { entityTypes: ["minecraft:iron_golem"] });
        ironSubscription = () => world.afterEvents.entityDie.unsubscribe(callback);
        system.runInterval(() => {
            let time = (new Date().getTime() - iron_start) / 60000;
            if (player)
                player.sendMessage(`Total: ${iron_amount} | Time: ${time.toFixed(1)}(min) | Avg: ${(iron_amount / time).toFixed(1)}`);
        }, 200);
    }, "铁傀儡生成统计");
}
killStatistics();
//# sourceMappingURL=EntityControl.js.map