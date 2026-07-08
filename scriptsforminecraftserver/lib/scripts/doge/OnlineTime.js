/* ---------------------------------------- *\
 *  Name        :  OnlineTime               *
 *  Description :  玩家在线时间统计（纯 DB）   *
 *  Version     :  2.0.0                    *
 *  Author      :  Shiroha7z                *
\* ---------------------------------------- */
import { system, world } from "@minecraft/server";
import { Permission } from "../libs/Permission";
import { Command } from "../libs/Command";
import { Msg } from "../libs/Tools";
import { HttpDB } from "../libs/HttpDB";
export class OnlineTime {
    constructor() {
        this.dataMap = new Map();
    }
    static getInstance() {
        if (!OnlineTime._instance) {
            OnlineTime._instance = new OnlineTime();
        }
        return OnlineTime._instance;
    }
    registerCommandsAndPermissions() {
        Permission.register("onlinetime.see", Permission.Any);
        Command.register("onlinetime", "onlinetime.see", async (player) => {
            if (!player) {
                world.sendMessage("§c该指令必须由玩家执行。");
                return;
            }
            const data = await this.load(player);
            Msg.info(`玩家 §a${player.name}§r 的在线时间统计:\n` +
                `§e本次在线 §f${this.formatTime(data.session)}\n` +
                `§e今日在线 §f${this.formatTime(data.today)}\n` +
                `§e本月在线 §f${this.formatTime(data.month)}\n` +
                `§e总在线 §f${this.formatTime(data.total)}\n`, player);
        }, "查看在线时间统计");
    }
    registerEvents() {
        world.afterEvents.playerSpawn.subscribe((event) => {
            if (event.initialSpawn) {
                this.onPlayerJoin(event.player);
            }
        });
    }
    init() {
        this.startTick();
    }
    formatTime(seconds) {
        const d = Math.floor(seconds / 86400);
        const h = Math.floor((seconds % 86400) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        const parts = [];
        if (d > 0)
            parts.push(`${d}天`);
        if (h > 0)
            parts.push(`${h}时`);
        if (m > 0)
            parts.push(`${m}分`);
        parts.push(`${s}秒`);
        return parts.join("");
    }
    /** 从 DB 加载玩家在线时间数据 */
    async load(player) {
        const existing = this.dataMap.get(player.id);
        if (existing)
            return existing;
        const raw = await HttpDB.fetchJSON("/api/sfmc/players", player.id, "player");
        const def = (val, fallback) => (typeof val === "number" ? val : fallback);
        const data = {
            session: 0,
            today: def(raw?.onlinetime_today, 0),
            month: def(raw?.onlinetime_month, 0),
            total: def(raw?.onlinetime_total, 0),
            lastDate: def(raw?.onlinetime_last_date, new Date().getDate()),
            lastMonth: def(raw?.onlinetime_last_month, new Date().getMonth()),
        };
        this.dataMap.set(player.id, data);
        return data;
    }
    /** 持久化在线时间到 DB（排除 session，仅持久化跨重启字段） */
    async persist(player, data) {
        await HttpDB.patch(`/api/sfmc/players/${player.id}`, {
            player: {
                onlinetimeToday: data.today,
                onlinetimeMonth: data.month,
                onlinetimeTotal: data.total,
                onlinetimeLastDate: data.lastDate,
                onlinetimeLastMonth: data.lastMonth,
            },
        }).catch(() => { });
    }
    onPlayerJoin(player) {
        this.load(player).then((data) => {
            data.session = 0;
        });
    }
    onPlayerLeave(player) {
        const data = this.dataMap.get(player.id);
        if (data) {
            this.persist(player, data).catch(() => { });
            this.dataMap.delete(player.id);
        }
    }
    tickSecond() {
        const now = new Date();
        const currentDate = now.getDate();
        const currentMonth = now.getMonth();
        for (const player of world.getAllPlayers()) {
            const data = this.dataMap.get(player.id);
            if (!data) {
                this.load(player).then((d) => {
                    d.session++;
                    d.today++;
                    d.month++;
                    d.total++;
                });
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
            // 每秒持久化到 DB
            this.persist(player, data).catch(() => { });
        }
    }
    startTick() {
        system.runInterval(() => {
            this.tickSecond();
        }, 20);
    }
}
//# sourceMappingURL=OnlineTime.js.map