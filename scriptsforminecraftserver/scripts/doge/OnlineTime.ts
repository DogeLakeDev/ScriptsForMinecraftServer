/* ---------------------------------------- *\
 *  Name        :  OnlineTime               *
 *  Description :  玩家在线时间统计           *
 *  Version     :  1.0.0                    *
 *  Author      :  Shiroha7z                *
\* ---------------------------------------- */

import { Player, system, world } from "@minecraft/server";
import { Permission } from "../libs/Permission";
import { Command } from "../libs/Command";
import { Msg } from "../libs/Tools";
import { Storage } from "../libs/Storage";

export class OnlineTime {
  static _instance: OnlineTime;
  /**
   * @returns {OnlineTime}
   */
  static getInstance() {
    if (!OnlineTime._instance) {
      OnlineTime._instance = new OnlineTime();
    }
    return OnlineTime._instance;
  }

  // 缓存键名
  readonly KEY_SESSION = "onlinetime:session";
  readonly KEY_TODAY = "onlinetime:today";
  readonly KEY_MONTH = "onlinetime:month";
  readonly KEY_TOTAL = "onlinetime:total";
  readonly KEY_LAST_DATE = "onlinetime:last_date";
  readonly KEY_LAST_MONTH = "onlinetime:last_month";

  init() {
    this.registerEvents();
    this.startTick();
    this.registerCommands();
  }

  /**
   * 将秒数格式化为可读文本
   */
  formatTime(seconds: number): string {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    const parts: string[] = [];
    if (d > 0) parts.push(`${d}天`);
    if (h > 0) parts.push(`${h}时`);
    if (m > 0) parts.push(`${m}分`);
    parts.push(`${s}秒`);
    return parts.join("");
  }

  /**
   * 读取玩家的缓存属性，不存在时返回 0
   */
  getProp(player: Player, key: string): number {
    return Storage.playerGet<number>(player, key, 0);
  }

  /**
   * 玩家进服时重置会话计数器
   */
  private onPlayerJoin(player: Player) {
    Storage.playerSet(player, this.KEY_SESSION, 0);
  }

  /**
   * 每秒为所有在线玩家增加时间
   * 使用 setThrottled 避免高频 HttpDB 写入，缓存实时更新
   */
  private tickSecond() {
    const now = new Date();
    const currentDate = now.getDate();
    const currentMonth = now.getMonth();

    for (const player of world.getAllPlayers()) {
      // 检查日期变更 -> 重置今日和会话
      if (this.getProp(player, this.KEY_LAST_DATE) !== currentDate) {
        Storage.playerSetThrottled(player, this.KEY_TODAY, 0);
        Storage.playerSetThrottled(player, this.KEY_LAST_DATE, currentDate);
      }

      // 检查月份变更 -> 重置本月
      if (this.getProp(player, this.KEY_LAST_MONTH) !== currentMonth) {
        Storage.playerSetThrottled(player, this.KEY_MONTH, 0);
        Storage.playerSetThrottled(player, this.KEY_LAST_MONTH, currentMonth);
      }

      // 所有计数器 +1 秒（节流写入 HttpDB）
      Storage.playerSetThrottled(player, this.KEY_SESSION, this.getProp(player, this.KEY_SESSION) + 1);
      Storage.playerSetThrottled(player, this.KEY_TODAY, this.getProp(player, this.KEY_TODAY) + 1);
      Storage.playerSetThrottled(player, this.KEY_MONTH, this.getProp(player, this.KEY_MONTH) + 1);
      Storage.playerSetThrottled(player, this.KEY_TOTAL, this.getProp(player, this.KEY_TOTAL) + 1);
    }
  }

  private registerEvents() {
    world.afterEvents.playerSpawn.subscribe(event => {
      if (event.initialSpawn) {
        this.onPlayerJoin(event.player);
      }
    });
  }

  private startTick() {
    system.runInterval(() => {
      this.tickSecond();
    }, 20);
  }

  private registerCommands() {
    Permission.register('onlinetime.see', Permission.Any);
    Command.register("onlinetime", 'onlinetime.see',
      (player: Player | undefined) => {
        if (!player) {
          world.sendMessage("§c该指令必须由玩家执行。");
          return;
        }

        const session = this.getProp(player, this.KEY_SESSION);
        const today = this.getProp(player, this.KEY_TODAY);
        const month = this.getProp(player, this.KEY_MONTH);
        const total = this.getProp(player, this.KEY_TOTAL);

        Msg.info(
          `玩家 §a${player.name}§r 的在线时间统计:\n` +
          `§e本次在线 §f${this.formatTime(session)}\n` +
          `§e今日在线 §f${this.formatTime(today)}\n` +
          `§e本月在线 §f${this.formatTime(month)}\n` +
          `§e总在线 §f${this.formatTime(total)}\n`,
          player
        );
      },
      "查看在线时间统计"
    );
  }
}
