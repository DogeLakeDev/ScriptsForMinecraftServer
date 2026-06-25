import { Player, system, world, Vector3 } from "@minecraft/server";
import { Config } from "../data/Config";
import { Command } from "../core/Command";
import { Permission } from "../core/Permission";

// 初始化
for (const player of world.getAllPlayers()) {
    reset(player);
}

export function reset(player: Player): void {
    player.setDynamicProperty("afk:last_location", undefined);
    player.setDynamicProperty("afk:step", undefined);
    player.removeTag("AFK");
    player.removeTag("NOAFK");
}

export function setAFK(player: Player): void {
    player.removeTag("NOAFK");
    startAFKScan();
    playerList[player.id] = player.location;
    world.sendMessage(`§7* ${player.nameTag} is now AFK. *`);
    player.setDynamicProperty("afk:step", 0);
    player.addTag("AFK");
}

function locationMoved(lastLocation: Vector3, nowLocation: Vector3): boolean {
    const deltaX = lastLocation.x - nowLocation.x;
    if (-1 < deltaX && deltaX < 1) {
        const deltaY = lastLocation.y - nowLocation.y;
        if (-1 < deltaY && deltaY < 1) {
            const deltaZ = lastLocation.z - nowLocation.z;
            if (-1 < deltaZ && deltaZ < 1) {
                return false;
            }
        }
    }
    return true;
}

const STEPTIME = 15;
system.runInterval(() => {
    for (const player of world.getPlayers({ excludeTags: ["AFK", "NOAFK"] })) {
        const lastLocation = player.getDynamicProperty("afk:last_location") as Vector3 | undefined;
        const nowLocation = player.location;

        if (lastLocation !== undefined) {
            let nowStep = player.getDynamicProperty("afk:step") as number | undefined;
            if (!locationMoved(lastLocation, nowLocation)) {
                if (nowStep === undefined) {
                    nowStep = 1;
                } else {
                    nowStep++;
                }

                if (nowStep * STEPTIME >= Config.AFKTime) {
                    setAFK(player);
                } else {
                    player.setDynamicProperty("afk:step", nowStep);
                }
            } else {
                player.setDynamicProperty("afk:step", 0);
            }
        }

        player.setDynamicProperty("afk:last_location", nowLocation);
    }
}, STEPTIME * 20);

let intervalId: number | undefined = undefined;
const playerList: Record<string, Vector3> = {};

function startAFKScan(): void {
    if (intervalId === undefined) {
        intervalId = system.runInterval(() => {
            let count = 0;
            for (const id in playerList) {
                const player = world.getEntity(id);
                if (player === undefined) {
                    delete playerList[id];
                } else {
                    if (locationMoved(playerList[id], player.location)) {
                        world.sendMessage(`§7* ${player.nameTag} is no longer AFK. *`);
                        player.removeTag("AFK");
                        player.setDynamicProperty("afk:last_location", player.location);
                        player.setDynamicProperty("afk:step", 0);
                        delete playerList[id];
                    } else {
                        count++;
                    }
                }
            }
            if (count === 0) stopAFKScan();
        }, 100);
    }
}

function stopAFKScan(): void {
    if (intervalId !== undefined) {
        system.clearRun(intervalId);
        intervalId = undefined;
    }
}

function registerCommand(): void {
    Command.register("afk", Permission.Any, setAFK, "进入AFK状态");
    Command.register("noafk", Permission.OP, (pl) => {
        pl.addTag("NOAFK");
    }, "令玩家不会进入AFK状态");
}

registerCommand();
