/* ---------------------------------------- *\
 *  Name        :  TPS                      *
 *  Description :  TPS 检测                  *
 *  Version     :  1.0.0                    *
 *  Author      :  Shiroha7z                *
\* ---------------------------------------- */

import { Player, system, world } from "@minecraft/server";
import { Permission } from "../libs/Permission";
import { Command } from "../libs/Command";
import { Msg } from "../libs/Tools";



export class TPS {
  static _instance: TPS;
  /**
   * @returns {TPS}
   */
  static getInstance() {
    if (!TPS._instance) {
      TPS._instance = new TPS();
    }
    return TPS._instance;
  }

  private tickTimes: number[] = [];
  private readonly MAX_SAMPLES = 100;

  /**
   * 获取当前 TPS
   * @returns 保留两位小数的 TPS 值
   */
  private getTPS(): number {
    if (this.tickTimes.length < 10) return 20;
    const elapsed = (this.tickTimes[this.tickTimes.length - 1] - this.tickTimes[0]) / 1000;
    const tickCount = this.tickTimes.length - 1;
    const tps = tickCount / elapsed;
    return Math.round(Math.min(tps, 20) * 100) / 100;
  }

  /**
   * 获取 TPS 状态文本
   */
  getTPSStatus(): string {
    const tps = this.getTPS();
    let color: string;
    if (tps >= 19.5) color = "§a";
    else if (tps >= 15) color = "§e";
    else if (tps >= 10) color = "§6";
    else color = "§c";
    return `§7[TPS] ${color}${tps} §7/ 20.00`;
  }

  init() {
    this.startRecord();
    this.registerCommands();
  }

  private startRecord() {
    system.runInterval(() => {
      this.tickTimes.push(Date.now());
      if (this.tickTimes.length > this.MAX_SAMPLES) {
        this.tickTimes.shift();
      }
    }, 1);
  }

  private registerCommands() {
    Permission.register('tps.see', Permission.Any);
    Command.register("tps", 'tps.see',
      (player: Player | undefined) => {
        const msg = this.getTPSStatus();
        if (player) {
          Msg.info(msg, player);
        } else {
          world.sendMessage(msg);
        }
      },
      "查看服务器 TPS"
    );
  }
}
