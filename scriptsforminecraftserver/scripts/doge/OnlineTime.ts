/* ---------------------------------------- *\
 *  Name        :  OnlineTime               *
 *  Description :  玩家在线时间统计（纯 DB）   *
 *  Version     :  2.0.0                    *
 *  Author      :  Shiroha7z                *
\* ---------------------------------------- */

import { Player, system, world } from "@minecraft/server";
import { Permission } from "../libs/Permission";
import { Command } from "../libs/Command";
import { Msg } from "../libs/Tools";
import { HttpDB } from "../libs/HttpDB";

interface OnlineTimeData {
  session: number;
  today: number;
  month: number;
  total: number;
  lastDate: number;
  lastMonth: number;
}

const FLUSH_INTERVAL_TICKS = 1200;

export class OnlineTime {
  static _instance: OnlineTime;
  static getInstance(): OnlineTime {
    if (!OnlineTime._instance) {
      OnlineTime._instance = new OnlineTime();
    }
    return OnlineTime._instance;
  }

  private dataMap = new Map<string, OnlineTimeData>();
  private loading = new Map<string, Promise<OnlineTimeData>>();
  private playerNames = new Map<string, string>();
  private playerLeaveSub: any = undefined;
  private flushRunId: number | undefined;
  private flushInFlight = false;

  registerCommandsAndPermissions() {
    Permission.register("onlinetime.see", Permission.Any);
    Command.register(
      "onlinetime",
      "onlinetime.see",
      async (player: Player | undefined) => {
        if (!player) {
          world.sendMessage("§c该指令必须由玩家执行。");
          return;
        }
        const data = await this.load(player);
        Msg.info(
          `玩家 §a${player.name}§r 的在线时间统计:\n` +
            `§e本次在线 §f${this.formatTime(data.session)}\n` +
            `§e今日在线 §f${this.formatTime(data.today)}\n` +
            `§e本月在线 §f${this.formatTime(data.month)}\n` +
            `§e总在线 §f${this.formatTime(data.total)}\n`,
          player
        );
      },
      "查看在线时间统计",
      "onlineTime"
    );
  }

  registerEvents() {
    if (this.playerLeaveSub) return;
    this.playerLeaveSub = world.afterEvents.playerSpawn.subscribe((event) => {
      if (event.initialSpawn) {
        this.onPlayerJoin(event.player);
      }
    });
  }

  init() {
    this.startTick();
    this.flushRunId = system.runInterval(() => this.flushAll(), FLUSH_INTERVAL_TICKS);
  }

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

  /** 从 DB 加载玩家在线时间数据 */
  private async load(player: Player): Promise<OnlineTimeData> {
    this.playerNames.set(player.id, player.name);
    const existing = this.dataMap.get(player.id);
    if (existing) return existing;

    const pending = this.loading.get(player.id);
    if (pending) return pending;

    const promise = (async () => {
      const raw = await HttpDB.fetchJSON<Record<string, unknown>>("/api/sfmc/players", player.id, "player");
      const def = (val: unknown, fallback: number) => (typeof val === "number" ? val : fallback);
      const data: OnlineTimeData = {
        session: 0,
        today: def(raw?.onlinetime_today, 0),
        month: def(raw?.onlinetime_month, 0),
        total: def(raw?.onlinetime_total, 0),
        lastDate: def(raw?.onlinetime_last_date, new Date().getDate()),
        lastMonth: def(raw?.onlinetime_last_month, new Date().getMonth()),
      };
      this.dataMap.set(player.id, data);
      return data;
    })();
    this.loading.set(player.id, promise);
    try { return await promise; } finally { this.loading.delete(player.id); }
  }

  /** 持久化在线时间到 DB（排除 session，仅持久化跨重启字段） */
  private async persist(playerId: string, data: OnlineTimeData): Promise<void> {
    await HttpDB.patch(`/api/sfmc/players/${playerId}`, {
      player: {
        onlinetimeToday: data.today,
        onlinetimeMonth: data.month,
        onlinetimeTotal: data.total,
        onlinetimeLastDate: data.lastDate,
        onlinetimeLastMonth: data.lastMonth,
      },
    }).catch(() => {});
  }

  private onPlayerJoin(player: Player) {
    this.load(player).then((data) => {
      data.session = 0;
    });
  }

  onPlayerLeave(player: Player | { id: string; name?: string }) {
    const playerId = player.id;
    if (player.name) this.playerNames.set(playerId, player.name);
    const data = this.dataMap.get(playerId);
    if (data) {
      this.persist(playerId, data).catch(() => {});
      this.dataMap.delete(playerId);
    }
    this.playerNames.delete(playerId);
  }

  private tickSecond() {
    const now = new Date();
    const currentDate = now.getDate();
    const currentMonth = now.getMonth();

    for (const player of world.getAllPlayers()) {
      const data = this.dataMap.get(player.id);
      if (!data) {
        this.load(player).then((d) => this.increment(d));
        continue;
      }

      if (data.lastDate !== currentDate) {
        data.today = 0;
        data.lastDate = currentDate;
      }
      if (data.lastMonth !== currentMonth) {
        data.month = 0;
        data.lastMonth = currentMonth;
      }

      data.session++;
      data.today++;
      data.month++;
      data.total++;
    }
  }

  private increment(data: OnlineTimeData): void {
    data.session++;
    data.today++;
    data.month++;
    data.total++;
  }

  private async flushAll(): Promise<void> {
    if (this.flushInFlight) return;
    this.flushInFlight = true;
    try {
      await Promise.all([...this.dataMap.entries()].map(([id, data]) => this.persist(id, data)));
    } finally {
      this.flushInFlight = false;
    }
  }

  private startTick() {
    this.tickRunId = system.runInterval(() => {
      this.tickSecond();
    }, 20);
  }

  private tickRunId: number | undefined;

  stop() {
    if (this.tickRunId !== undefined) {
      try { system.clearRun(this.tickRunId); } catch {}
      this.tickRunId = undefined;
    }
    if (this.flushRunId !== undefined) {
      try { system.clearRun(this.flushRunId); } catch {}
      this.flushRunId = undefined;
    }
    if (this.playerLeaveSub?.unsubscribe) {
      try { this.playerLeaveSub.unsubscribe(); } catch {}
      this.playerLeaveSub = undefined;
    }
    void this.flushAll();
  }
}
