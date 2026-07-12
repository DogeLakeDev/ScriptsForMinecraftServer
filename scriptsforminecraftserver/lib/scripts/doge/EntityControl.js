import { system, world } from "@minecraft/server";
import { MenuNavigator } from "../libs/MenuNavigator";
import { Command } from "../libs/Command";
import { Permission } from "../libs/Permission";
export function entityClean(player) {
    const m = new Map();
    for (const entity of player.dimension.getEntities({ excludeTypes: ["player"] })) {
        m.set(entity.typeId, (m.get(entity.typeId) ?? 0) + 1);
    }
    if (m.size === 0)
        return;
    const arr = Array.from(m).sort((a, b) => b[1] - a[1]);
    const nav = new MenuNavigator(player);
    nav.section("entityList", "实体列表", (page) => {
        for (const data of arr) {
            page.button(`${data[1]} | ${data[0]}`, () => {
                nav.state.entityType = data[0];
                nav.state.arr = arr;
                nav.go("actionForm");
            });
        }
    });
    nav.section("actionForm", "处理方式", (page) => {
        const entityType = nav.state.entityType;
        page.button("remove", () => {
            for (const en of player.dimension.getEntities({ type: entityType }))
                en.remove();
        });
        page.button("kill", () => {
            player.runCommand(`kill @e[type=${entityType}]`);
        });
        page.button("tp", () => {
            player.runCommand(`tp @s @e[c=1,type=${entityType}]`);
        });
    });
    nav.start("entityList");
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