/**
 * events.ts — 游戏事件上报到 db-server（join/leave/death）与实时状态
 *
 * 由 db-server /api/sfmc/qq/events 负责按开关过滤并实时推群。
 * 当前由平台宿主 qq-link 在世界加载后注册，fire-and-forget。
 */

import { system, world, type Player } from "@minecraft/server";
import { HttpRequestMethod } from "@minecraft/server-net";
import { HttpDB } from "../httpdb.js";

export type QqGameEvent = {
  type: "join" | "leave" | "death";
  player: string;
  cause?: string;
};

export type QqEventReporter = (ev: QqGameEvent) => void;

/** 默认：POST /api/sfmc/qq/events */
export async function postQqEvent(ev: QqGameEvent): Promise<void> {
  try {
    const body: Record<string, unknown> = { type: ev.type, player: ev.player };
    if (ev.cause) body.cause = ev.cause;
    const result = await HttpDB.typedRequest(HttpRequestMethod.POST, "/api/sfmc/qq/events", body);
    if (!result.ok) warnReportFailure(`事件 HTTP ${result.status}`);
  } catch {
    warnReportFailure("事件请求异常");
  }
}

let lastReportWarning = 0;
function warnReportFailure(reason: string): void {
  const now = Date.now();
  if (now - lastReportWarning < 60_000) return;
  lastReportWarning = now;
  console.warn(`[SFMC] QQ 事件上报失败: ${reason}，请检查数据服务连接与鉴权`);
}

/** 实时玩家列表与世界信息每 20 秒同步，供 QQ 查服使用。 */
export function startLiveStatusReporter(): number {
  let busy = false;
  const report = () => {
    if (busy) return;
    let players: string[];
    let day: number;
    let difficulty: string;
    try {
      players = world.getAllPlayers().map((player) => player.name);
      day = world.getDay();
      difficulty = String(world.getDifficulty());
    } catch {
      return;
    }
    busy = true;
    void HttpDB.typedRequest(HttpRequestMethod.POST, "/api/sfmc/status/live", {
      players,
      day,
      difficulty,
    })
      .then((result) => {
        if (!result.ok) warnReportFailure(`实时状态 HTTP ${result.status}`);
      })
      .catch(() => warnReportFailure("实时状态请求异常"))
      .finally(() => {
        busy = false;
      });
  };
  system.run(report);
  return system.runInterval(report, 400);
}

let reporter: QqEventReporter = (ev) => {
  void postQqEvent(ev);
};

/** 单测可注入 spy；cleanup 时 reset */
export function setQqEventReporter(fn: QqEventReporter | null): void {
  reporter =
    fn ??
    ((ev) => {
      void postQqEvent(ev);
    });
}

function report(ev: QqGameEvent): void {
  try {
    reporter(ev);
  } catch {
    /* ignore */
  }
}

function isPlayerEntity(e: { typeId?: string } | undefined | null): boolean {
  return !!e && e.typeId === "minecraft:player";
}

type Sub = { unsubscribe: (cb: unknown) => void };

let onSpawn: ((ev: { player?: Player; initialSpawn?: boolean }) => void) | null = null;
let onLeave: ((ev: { playerName?: string; playerId?: string }) => void) | null = null;
let onDie:
  | ((ev: {
      deadEntity?: { typeId?: string; name?: string };
      damageSource?: { cause?: string; damagingEntity?: { name?: string; typeId?: string } };
    }) => void)
  | null = null;

/**
 * 订阅世界事件；返回取消订阅函数。
 * 由平台宿主 startPlatformQqLink / stopPlatformQqLink 调用。
 */
export function registerGameEventReporters(): () => void {
  onSpawn = (ev) => {
    if (!ev.initialSpawn) return;
    const name = String(ev.player?.name ?? "").trim();
    if (!name) return;
    report({ type: "join", player: name });
  };
  onLeave = (ev) => {
    const name = String(ev.playerName ?? "").trim();
    if (!name) return;
    report({ type: "leave", player: name });
  };
  onDie = (ev) => {
    const dead = ev.deadEntity;
    if (!isPlayerEntity(dead)) return;
    const name = String(dead?.name ?? "").trim();
    if (!name) return;
    const causeRaw = String(ev.damageSource?.cause ?? "").trim();
    const attacker = ev.damageSource?.damagingEntity;
    let cause = causeRaw;
    if (attacker && (causeRaw === "entityAttack" || causeRaw === "projectile")) {
      const an = String(attacker.name ?? attacker.typeId ?? "").trim();
      if (an) cause = an;
    }
    if (cause) report({ type: "death", player: name, cause });
    else report({ type: "death", player: name });
  };

  world.afterEvents.playerSpawn.subscribe(onSpawn as never);
  world.afterEvents.playerLeave.subscribe(onLeave as never);
  world.afterEvents.entityDie.subscribe(onDie as never);

  return () => {
    try {
      if (onSpawn) (world.afterEvents.playerSpawn as unknown as Sub).unsubscribe(onSpawn);
    } catch {
      /* ignore */
    }
    try {
      if (onLeave) (world.afterEvents.playerLeave as unknown as Sub).unsubscribe(onLeave);
    } catch {
      /* ignore */
    }
    try {
      if (onDie) (world.afterEvents.entityDie as unknown as Sub).unsubscribe(onDie);
    } catch {
      /* ignore */
    }
    onSpawn = null;
    onLeave = null;
    onDie = null;
    setQqEventReporter(null);
  };
}

/** 供单测：同步上报（经当前 reporter） */
export function reportGameEventForTest(ev: QqGameEvent): void {
  report(ev);
}
