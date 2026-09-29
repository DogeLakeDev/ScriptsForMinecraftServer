/**
 * account-profile.ts — 把经济插件和在线时长插件的实时结果推给 QQ 账号页。
 *
 * 走这两个模块自己注册的服务，不读它们的私有表。
 * 玩家在线时约每 30 秒推一次；离线后的数字仍以插件已经落库的记录为准。
 */

import { system, world, type Player } from "@minecraft/server";
import { HttpRequestMethod } from "@minecraft/server-net";
import { HttpDB } from "@sfmc-bds/sdk/sapi/runtime";
import { service } from "@sfmc-bds/sdk/sapi/service";

type EconomyGet = { balance?: number };
type OnlineByPlayer = {
  todaySeconds?: number;
  monthSeconds?: number;
  totalSeconds?: number;
};

async function readLiveProfile(player: Player): Promise<{
  xuid: string;
  name: string;
  balance: number | null;
  today_seconds: number | null;
  month_seconds: number | null;
  total_seconds: number | null;
} | null> {
  let balance: number | null = null;
  let today: number | null = null;
  let month: number | null = null;
  let total: number | null = null;
  try {
    const economy = await service.call<EconomyGet>("economy.account.get", {
      playerId: player.id,
      playerName: player.name,
    });
    if (typeof economy?.balance === "number" && Number.isFinite(economy.balance)) balance = economy.balance;
  } catch {
    balance = null;
  }
  try {
    const online = await service.call<OnlineByPlayer>("onlinetime.byPlayer", { playerId: player.id });
    if (online) {
      if (typeof online.todaySeconds === "number") today = online.todaySeconds;
      if (typeof online.monthSeconds === "number") month = online.monthSeconds;
      if (typeof online.totalSeconds === "number") total = online.totalSeconds;
    }
  } catch {
    today = null;
    month = null;
    total = null;
  }
  if (balance == null && today == null && month == null && total == null) return null;
  return {
    xuid: player.id,
    name: player.name,
    balance,
    today_seconds: today,
    month_seconds: month,
    total_seconds: total,
  };
}

/** 在线玩家的余额和在线时长同步。返回 interval id，cleanup 时 clearRun。 */
export function startAccountProfileReporter(): number {
  let busy = false;
  const report = () => {
    if (busy) return;
    let players: Player[];
    try {
      players = world.getAllPlayers();
    } catch {
      return;
    }
    if (!players.length) return;
    busy = true;
    void (async () => {
      for (const player of players) {
        const profile = await readLiveProfile(player);
        if (!profile) continue;
        try {
          await HttpDB.typedRequest(HttpRequestMethod.POST, "/api/sfmc/qq/bind/profile", profile);
        } catch {
          /* 网络失败留到下一轮，账号页仍可读插件已经落库的记录 */
        }
      }
    })().finally(() => {
      busy = false;
    });
  };
  system.run(report);
  return system.runInterval(report, 600);
}
