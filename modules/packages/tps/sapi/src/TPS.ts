import { Player, system, world } from "@minecraft/server";
import { Command } from "../../../../../scriptsforminecraftserver/scripts/libs/Command.js";
import { debug } from "../../../../../scriptsforminecraftserver/scripts/libs/DebugLog.js";
import { Permission } from "../../../../../scriptsforminecraftserver/scripts/libs/Permission.js";
import { Msg } from "../../../../../scriptsforminecraftserver/scripts/libs/Tools.js";

export class TPS {
  private static tickTimes: number[] = [];
  private static readonly MAX_SAMPLES = 100;

  static getTPS(): number {
    if (TPS.tickTimes.length < 10) return 20;
    const first = TPS.tickTimes[0];
    const last = TPS.tickTimes[TPS.tickTimes.length - 1];
    if (first === undefined || last === undefined) return 20;
    const elapsed = (last - first) / 1000;
    const tickCount = TPS.tickTimes.length - 1;
    const tps = tickCount / elapsed;
    return Math.round(Math.min(tps, 20) * 100) / 100;
  }

  static getTPSStatus(): string {
    const tps = this.getTPS();
    let color: string;
    if (tps >= 19.5) color = "§a";
    else if (tps >= 15) color = "§e";
    else if (tps >= 10) color = "§6";
    else color = "§c";
    return `§7[TPS] ${color}${tps} §7/ 20.00`;
  }

  static init() {
    debug.i("TPS", "init");
    this.startRecord();
  }

  private static startRecord() {
    this.recordRunId = system.runInterval(() => {
      TPS.tickTimes.push(Date.now());
      if (TPS.tickTimes.length > TPS.MAX_SAMPLES) {
        TPS.tickTimes.shift();
      }
    }, 1);
  }

  private static recordRunId: number | undefined;

  static stop() {
    debug.i("TPS", "stop");
    if (this.recordRunId !== undefined) {
      try {
        system.clearRun(this.recordRunId);
      } catch {}
      this.recordRunId = undefined;
    }
  }

  static registerPermissions(): void {
    Permission.register("tps.see", Permission.Any);
  }

  static registerCommands() {
    debug.i("TPS", "registerCommands");
    Command.register(
      "tps",
      "tps.see",
      (player: Player | undefined) => {
        const msg = this.getTPSStatus();
        if (player) {
          Msg.info(msg, player);
        } else {
          world.sendMessage(msg);
        }
      },
      "查看服务器 TPS",
      "tps"
    );
  }
}
