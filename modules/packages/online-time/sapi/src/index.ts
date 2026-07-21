/**
 * @sfmc/module-online-time — v2 入口
 *
 * ModuleRegistry.register + own db table `player_onlinetime`.
 * - 20 tick 累加 session/today/month/total
 * - 1200 tick flush 写回 db
 * - 提供 onlinetime.byPlayer service 供其他模块消费
 */

import { Player, system, world } from "@minecraft/server";
import { Command, debug, Msg, Permission } from "@sfmc/sdk/sapi/runtime";
import { db } from "@sfmc/sdk/sapi/db";
import { ModuleRegistry } from "@sfmc/sdk/module-loader";

const MODULE_ID = "feature-online-time";

interface PlayerState {
  session: number;
  today: number;
  month: number;
  total: number;
  lastDate: number;
  lastMonth: number;
  loaded: boolean;
}

const data = new Map<string, PlayerState>();
let tickRunId: number | undefined;
let flushRunId: number | undefined;

const FLUSH_INTERVAL_TICKS = 1200;

function formatTime(seconds: number): string {
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

async function loadPlayer(player: Player): Promise<void> {
  const id = player.id;
  if (data.has(id)) return;
  const result = await db.get("player_onlinetime", id);
  const now = new Date();
  if (result.ok && result.row) {
    const lastDate = typeof result.row.last_date === "number" ? result.row.last_date : now.getDate();
    const lastMonth = typeof result.row.last_month === "number" ? result.row.last_month : now.getMonth();
    data.set(id, {
      session: 0,
      today: typeof result.row.today_seconds === "number" ? result.row.today_seconds : 0,
      month: typeof result.row.month_seconds === "number" ? result.row.month_seconds : 0,
      total: typeof result.row.total_seconds === "number" ? result.row.total_seconds : 0,
      lastDate,
      lastMonth,
      loaded: true,
    });
  } else {
    data.set(id, {
      session: 0,
      today: 0,
      month: 0,
      total: 0,
      lastDate: now.getDate(),
      lastMonth: now.getMonth(),
      loaded: true,
    });
  }
}

async function flushAll(): Promise<void> {
  const now = new Date();
  const writes: Array<Promise<unknown>> = [];
  for (const [id, s] of data.entries()) {
    writes.push(
      db
        .insert("player_onlinetime", {
          player_id: id,
          today_seconds: s.today,
          month_seconds: s.month,
          total_seconds: s.total,
          last_date: s.lastDate,
          last_month: s.lastMonth,
          updated_at: now.getTime(),
        })
        .catch((e) => debug.e("ONLINE", `flush ${id}: ${(e as Error).message}`))
    );
  }
  await Promise.all(writes);
}

function tickAll(): void {
  const now = new Date();
  const currentDate = now.getDate();
  const currentMonth = now.getMonth();
  for (const player of world.getAllPlayers()) {
    const s = data.get(player.id);
    if (!s || !s.loaded) continue;
    if (s.lastDate !== currentDate) {
      s.today = 0;
      s.lastDate = currentDate;
    }
    if (s.lastMonth !== currentMonth) {
      s.month = 0;
      s.lastMonth = currentMonth;
    }
    s.session++;
    s.today++;
    s.month++;
    s.total++;
  }
}

ModuleRegistry.register({
  id: MODULE_ID,
  afterWorldLoad: true,
  lifecycle: {
    registerPermissions() {
      Permission.register("onlinetime.see", Permission.Any);
    },
    async init() {
      await db.defineTable(
        "player_onlinetime",
        {
          player_id: { type: "TEXT", primary: true },
          today_seconds: { type: "INTEGER", default: 0 },
          month_seconds: { type: "INTEGER", default: 0 },
          total_seconds: { type: "INTEGER", default: 0 },
          last_date: { type: "INTEGER", default: 0 },
          last_month: { type: "INTEGER", default: 0 },
          updated_at: { type: "INTEGER", default: 0 },
        }
      );

      tickRunId = system.runInterval(tickAll, 20);
      flushRunId = system.runInterval(() => void flushAll(), FLUSH_INTERVAL_TICKS);

      world.afterEvents.playerSpawn.subscribe((event) => {
        if (event.initialSpawn) void loadPlayer(event.player);
      });

      for (const p of world.getAllPlayers()) void loadPlayer(p);
      debug.i("ONLINE", "init");
    },
    registerCommands() {
      Command.register(
        "onlinetime",
        "onlinetime.see",
        async (player: Player | undefined) => {
          if (!player) {
            world.sendMessage("§c该指令必须由玩家执行。");
            return;
          }
          const s = data.get(player.id);
          if (!s) {
            Msg.info("在线时长数据加载中,请稍后再试。", player);
            return;
          }
          Msg.info(
            `玩家 §a${player.name}§r 的在线时间统计:\n` +
              `§e本次在线 §f${formatTime(s.session)}\n` +
              `§e今日在线 §f${formatTime(s.today)}\n` +
              `§e本月在线 §f${formatTime(s.month)}\n` +
              `§e总在线 §f${formatTime(s.total)}\n`,
            player
          );
        },
        "查看在线时间统计",
        "onlineTime"
      );
    },
    cleanup() {
      if (tickRunId !== undefined) {
        try {
          system.clearRun(tickRunId);
        } catch {
          /* ignore */
        }
      }
      if (flushRunId !== undefined) {
        try {
          system.clearRun(flushRunId);
        } catch {
          /* ignore */
        }
      }
      void flushAll();
      data.clear();
      debug.i("ONLINE", "stop");
    },
  },
});