import { system, world } from "@minecraft/server";
import { Command } from "../libs/Command";
import { Msg } from "../libs/Tools";
export class TPS {
    static getTPS() {
        if (TPS.tickTimes.length < 10)
            return 20;
        const elapsed = (TPS.tickTimes[TPS.tickTimes.length - 1] - TPS.tickTimes[0]) / 1000;
        const tickCount = TPS.tickTimes.length - 1;
        const tps = tickCount / elapsed;
        return Math.round(Math.min(tps, 20) * 100) / 100;
    }
    static getTPSStatus() {
        const tps = this.getTPS();
        let color;
        if (tps >= 19.5)
            color = "§a";
        else if (tps >= 15)
            color = "§e";
        else if (tps >= 10)
            color = "§6";
        else
            color = "§c";
        return `§7[TPS] ${color}${tps} §7/ 20.00`;
    }
    static init() {
        this.startRecord();
    }
    static startRecord() {
        system.runInterval(() => {
            TPS.tickTimes.push(Date.now());
            if (TPS.tickTimes.length > TPS.MAX_SAMPLES) {
                TPS.tickTimes.shift();
            }
        }, 1);
    }
    static registerCommands() {
        Command.register("tps", "tps.see", (player) => {
            const msg = this.getTPSStatus();
            if (player) {
                Msg.info(msg, player);
            }
            else {
                world.sendMessage(msg);
            }
        }, "查看服务器 TPS");
    }
}
TPS.tickTimes = [];
TPS.MAX_SAMPLES = 100;
//# sourceMappingURL=TPS.js.map