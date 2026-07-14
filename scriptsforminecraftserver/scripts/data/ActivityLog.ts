/**
 * ActivityLog — 玩家行为日志模块
 *
 * 订阅原版游戏事件，记录玩家行为到 db-server（sfmc_activities 表）。
 * 支持：高频事件节流、可配事件类型、自动清理。
 */

import { world, system, Player, Entity, Block, Vector3 } from "@minecraft/server";
import { HttpDB } from "../libs/HttpDB";
import { debug } from "../libs/DebugLog";

// ============================================
//  配置
// ============================================

/** 启用的日志事件类型 */
const ENABLED_EVENTS = new Set([
  "player.join",
  "player.leave",
  "player.spawn",
  "player.dimension",
  "player.gamemode",
  "player.chat",
  "block.break",
  "block.place",
  "entity.death",
  "entity.hit",
  "entity.hurt",
  "entity.interact",
  "entity.tame",
  "entity.spawn",
  "item.drop",
  "item.pickup",
  "container.open",
  "container.close",
  "world.explosion",
]);

/** 队列 flush 间隔（毫秒） */
const FLUSH_INTERVAL = 2000;

/** 自动清理间隔（毫秒） */
const CLEANUP_INTERVAL = 6 * 3600_000; // 6 小时

/** 日志保留天数 */
const KEEP_DAYS = 30;

// ============================================
//  内部队列
// ============================================

let queue: any[] = [];
let flushTimer: number | null = null;
let initialized = false;
let flushIntervalId: number | undefined;
let cleanupIntervalId: number | undefined;
let cleanupStartTimeoutId: number | undefined;

function enqueue(entry: any) {
  queue.push(entry);
  if (!flushTimer) {
    flushTimer = system.runTimeout(flush, FLUSH_INTERVAL / 50);
  }
}

async function flush() {
  flushTimer = null;
  if (queue.length === 0) return;
  const batch = queue;
  queue = [];
  try {
    const sent = await HttpDB.post("/api/sfmc/activities/batch", { entries: batch });
    if (!sent) queue = batch.concat(queue);
  } catch {
    queue = batch.concat(queue);
  }
}

// ============================================
//  辅助函数
// ============================================

function dimId(entityOrBlock: Entity | Block): string {
  try {
    return entityOrBlock.dimension?.id?.replace("minecraft:", "") || "";
  } catch {
    return "";
  }
}

function loc(v?: Vector3): [number, number, number] {
  if (!v) return [0, 0, 0];
  return [v.x, v.y, v.z];
}

function playerId(player: Player): string {
  try {
    return player.id || "";
  } catch {
    return "";
  }
}

function playerEntry(player: Player, eventType: string, extra: any = {}): any {
  const [x, y, z] = loc(player.location);
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    dimension: dimId(player),
    sourceType: "player",
    sourceid: playerId(player),
    sourceName: player.name,
    sourceX: x,
    sourceY: y,
    sourceZ: z,
    eventType,
    targetType: extra.targetType || "",
    targetid: extra.targetid || "",
    targetName: extra.targetName || "",
    targetX: extra.targetX ?? null,
    targetY: extra.targetY ?? null,
    targetZ: extra.targetZ ?? null,
    detail: extra.detail || {},
  };
}

function getTargetPlayerId(entity: Entity): string {
  if (entity.typeId !== "minecraft:player") return "";
  try {
    return (entity as Player).id || "";
  } catch {
    return "";
  }
}

function getTargetPlayerName(entity: Entity): string {
  if (entity.typeId !== "minecraft:player") return entity.typeId;
  try {
    return (entity as Player).name || entity.typeId;
  } catch {
    return entity.typeId;
  }
}

// ============================================
//  事件订阅
// ============================================

const subscriptions: Array<any> = [];

function subscribe() {
  // ---- 玩家加入 ----
  // 辅助：安全订阅事件，若事件不存在则静默跳过
  function safeSubscribe(signal: any, cb: (arg: any) => void) {
    if (signal && typeof signal.subscribe === "function") {
      const sub = signal.subscribe(cb);
      if (sub && typeof sub.unsubscribe === "function") {
        subscriptions.push(sub);
      }
    }
  }

  const AE = world.afterEvents;

  // ---- 玩家加入 ----
  safeSubscribe(AE.playerSpawn, (event: any) => {
    if (!event.initialSpawn) return;
    if (!ENABLED_EVENTS.has("player.join")) return;
    enqueue(playerEntry(event.player, "player.join"));
  });

  // ---- 玩家离开 ----
  safeSubscribe(AE.playerLeave, (event: any) => {
    if (!ENABLED_EVENTS.has("player.leave")) return;
    enqueue({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      dimension: "",
      sourceType: "player",
      sourceid: "",
      sourceName: event.playerName,
      sourceX: null,
      sourceY: null,
      sourceZ: null,
      eventType: "player.leave",
      targetType: "",
      targetid: "",
      targetName: "",
      targetX: null,
      targetY: null,
      targetZ: null,
      detail: { playerId: event.playerId },
    });
  });

  // ---- 玩家重生 ----
  safeSubscribe(AE.playerSpawn, (event: any) => {
    if (event.initialSpawn) return;
    if (!ENABLED_EVENTS.has("player.spawn")) return;
    enqueue(playerEntry(event.player, "player.spawn"));
  });

  // ---- 维度切换 ----
  safeSubscribe(AE.playerDimensionChange, (event: any) => {
    if (!ENABLED_EVENTS.has("player.dimension")) return;
    const [fx, fy, fz] = loc(event.fromLocation);
    const [tx, ty, tz] = loc(event.toLocation);
    enqueue(
      playerEntry(event.player, "player.dimension", {
        targetX: tx,
        targetY: ty,
        targetZ: tz,
        detail: {
          from: event.fromDimension.id.replace("minecraft:", ""),
          to: event.toDimension.id.replace("minecraft:", ""),
          fromLoc: { x: fx, y: fy, z: fz },
          toLoc: { x: tx, y: ty, z: tz },
        },
      })
    );
  });

  // ---- 游戏模式切换 ----
  safeSubscribe(AE.playerGameModeChange, (event: any) => {
    if (!ENABLED_EVENTS.has("player.gamemode")) return;
    enqueue(
      playerEntry(event.player, "player.gamemode", {
        detail: {
          from: event.fromGameMode,
          to: event.toGameMode,
        },
      })
    );
  });

  // ---- 聊天 ----
  safeSubscribe(AE.chatSend, (event: any) => {
    if (!ENABLED_EVENTS.has("player.chat")) return;
    const targets = event.targets?.map((p: any) => p.name) || [];
    enqueue(
      playerEntry(event.sender, "player.chat", {
        detail: {
          message: event.message,
          targets: targets.length > 0 ? targets : undefined,
        },
      })
    );
  });

  // ---- 破坏方块 ----
  safeSubscribe(AE.playerBreakBlock, (event: any) => {
    if (!ENABLED_EVENTS.has("block.break")) return;
    const [bx, by, bz] = loc(event.block.location);
    enqueue(
      playerEntry(event.player, "block.break", {
        targetType: "block",
        targetName: event.brokenBlockPermutation.type.id,
        targetX: bx,
        targetY: by,
        targetZ: bz,
        detail: {
          itemBefore: event.itemStackBeforeBreak?.type?.id || null,
          itemAfter: event.itemStackAfterBreak?.type?.id || null,
        },
      })
    );
  });

  // ---- 放置方块 ----
  safeSubscribe(AE.playerPlaceBlock, (event: any) => {
    if (!ENABLED_EVENTS.has("block.place")) return;
    const [bx, by, bz] = loc(event.block.location);
    enqueue(
      playerEntry(event.player, "block.place", {
        targetType: "block",
        targetName: event.block.typeId,
        targetX: bx,
        targetY: by,
        targetZ: bz,
        detail: {},
      })
    );
  });

  // ---- 生物死亡 ----
  safeSubscribe(AE.entityDie, (event: any) => {
    if (!ENABLED_EVENTS.has("entity.death")) return;
    const dead = event.deadEntity;
    const [dx, dy, dz] = loc(dead.location);
    const ds = event.damageSource;
    const cause = ds.cause;
    const killer = ds.damagingEntity;

    const targetType = dead.typeId === "minecraft:player" ? "player" : "entity";
    const targetid = getTargetPlayerId(dead);
    const targetName = getTargetPlayerName(dead);

    // 如果凶手是玩家，以玩家为主体记录
    if (killer && killer.typeId === "minecraft:player") {
      const player = killer as Player;
      const proj = ds.damagingProjectile;
      enqueue(
        playerEntry(player, "entity.death", {
          targetType,
          targetid,
          targetName,
          targetX: dx,
          targetY: dy,
          targetZ: dz,
          detail: { cause, projectile: proj?.typeId || null },
        })
      );
    } else {
      // 非玩家击杀（环境/生物击杀）
      enqueue({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        dimension: dimId(dead),
        sourceType: killer ? "entity" : "world",
        sourceid: "",
        sourceName: killer?.typeId || cause,
        sourceX: killer ? loc(killer.location)[0] : null,
        sourceY: killer ? loc(killer.location)[1] : null,
        sourceZ: killer ? loc(killer.location)[2] : null,
        eventType: "entity.death",
        targetType,
        targetid,
        targetName,
        targetX: dx,
        targetY: dy,
        targetZ: dz,
        detail: { cause, projectile: ds.damagingProjectile?.typeId || null },
      });
    }
  });

  // ---- 实体攻击实体 (PvP / 生物互殴) ----
  safeSubscribe(AE.entityHitEntity, (event: any) => {
    if (!ENABLED_EVENTS.has("entity.hit")) return;
    const attacker = event.damagingEntity;
    const victim = event.hitEntity;
    const [ax, ay, az] = loc(attacker.location);
    const [vx, vy, vz] = loc(victim.location);

    // 玩家攻击（PvP 或打怪）
    if (attacker.typeId === "minecraft:player") {
      enqueue(
        playerEntry(attacker as Player, "entity.hit", {
          targetType: victim.typeId === "minecraft:player" ? "player" : "entity",
          targetid: getTargetPlayerId(victim),
          targetName: getTargetPlayerName(victim),
          targetX: vx,
          targetY: vy,
          targetZ: vz,
        })
      );
    }
    // 生物攻击玩家也记录
    if (victim.typeId === "minecraft:player" && attacker.typeId !== "minecraft:player") {
      enqueue({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        dimension: dimId(attacker),
        sourceType: "entity",
        sourceid: "",
        sourceName: attacker.typeId,
        sourceX: ax,
        sourceY: ay,
        sourceZ: az,
        eventType: "entity.hit",
        targetType: "player",
        targetid: getTargetPlayerId(victim),
        targetName: getTargetPlayerName(victim),
        targetX: vx,
        targetY: vy,
        targetZ: vz,
        detail: {},
      });
    }
  });

  // ---- 实体受伤 ----
  safeSubscribe(AE.entityHurt, (event: any) => {
    if (!ENABLED_EVENTS.has("entity.hurt")) return;
    const hurt = event.hurtEntity;
    const ds = event.damageSource;

    // 只记录玩家受伤
    if (hurt.typeId !== "minecraft:player") return;
    const player = hurt as Player;
    enqueue(
      playerEntry(player, "entity.hurt", {
        detail: {
          damage: event.damage,
          cause: ds.cause,
          damager: ds.damagingEntity?.typeId || null,
          projectile: ds.damagingProjectile?.typeId || null,
        },
      })
    );
  });

  // ---- 交互实体 ----
  safeSubscribe(AE.playerInteractWithEntity, (event: any) => {
    if (!ENABLED_EVENTS.has("entity.interact")) return;
    const target = event.target;
    const [tx, ty, tz] = loc(target.location);
    enqueue(
      playerEntry(event.player, "entity.interact", {
        targetType: target.typeId === "minecraft:player" ? "player" : "entity",
        targetid: getTargetPlayerId(target),
        targetName: getTargetPlayerName(target),
        targetX: tx,
        targetY: ty,
        targetZ: tz,
        detail: {
          item: event.itemStack?.type?.id || null,
          itemBefore: event.beforeItemStack?.type?.id || null,
        },
      })
    );
  });

  // ---- 驯服实体 ----
  safeSubscribe(AE.entityTamed, (event: any) => {
    if (!ENABLED_EVENTS.has("entity.tame")) return;
    const tamer = event.tamingEntity;
    if (!tamer || tamer.typeId !== "minecraft:player") return;
    const target = event.entity;
    const [tx, ty, tz] = loc(target.location);
    enqueue(
      playerEntry(tamer as Player, "entity.tame", {
        targetType: "entity",
        targetName: target.typeId,
        targetX: tx,
        targetY: ty,
        targetZ: tz,
      })
    );
  });

  // ---- 生物生成 ----
  safeSubscribe(AE.entitySpawn, (event: any) => {
    if (!ENABLED_EVENTS.has("entity.spawn")) return;
    const e = event.entity;
    // 忽略玩家生成（由 playerSpawn 处理）
    if (e.typeId === "minecraft:player") return;
    const [ex, ey, ez] = loc(e.location);
    enqueue({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      dimension: dimId(e),
      sourceType: "entity",
      sourceid: "",
      sourceName: e.typeId,
      sourceX: ex,
      sourceY: ey,
      sourceZ: ez,
      eventType: "entity.spawn",
      targetType: "",
      targetid: "",
      targetName: "",
      targetX: null,
      targetY: null,
      targetZ: null,
      detail: { cause: event.cause },
    });
  });

  // ---- 掉落物品 ----
  safeSubscribe(AE.entityItemDrop, (event: any) => {
    if (!ENABLED_EVENTS.has("item.drop")) return;
    const e = event.entity;
    const [ex, ey, ez] = loc(e.location);
    if (e.typeId === "minecraft:player") {
      enqueue(
        playerEntry(e as Player, "item.drop", {
          detail: {
            items: event.items.map((item: any) => item.typeId).filter(Boolean),
          },
        })
      );
    } else {
      enqueue({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        dimension: dimId(e),
        sourceType: "entity",
        sourceid: "",
        sourceName: e.typeId,
        sourceX: ex,
        sourceY: ey,
        sourceZ: ez,
        eventType: "item.drop",
        targetType: "",
        targetid: "",
        targetName: "",
        targetX: null,
        targetY: null,
        targetZ: null,
        detail: {
          items: event.items.map((item: any) => item.typeId).filter(Boolean),
        },
      });
    }
  });

  // ---- 拾取物品 ----
  safeSubscribe(AE.entityItemPickup, (event: any) => {
    if (!ENABLED_EVENTS.has("item.pickup")) return;
    const e = event.entity;
    const [ex, ey, ez] = loc(e.location);
    if (e.typeId === "minecraft:player") {
      enqueue(
        playerEntry(e as Player, "item.pickup", {
          detail: {
            items: event.items.map((item: any) => item.type.id),
          },
        })
      );
    }
  });

  // ---- 容器打开 ----
  safeSubscribe(AE.blockContainerOpened, (event: any) => {
    if (!ENABLED_EVENTS.has("container.open")) return;
    const source = event.openSource.entity;
    if (!source || source.typeId !== "minecraft:player") return;
    const [bx, by, bz] = loc(event.block.location);
    enqueue(
      playerEntry(source as Player, "container.open", {
        targetType: "block",
        targetName: event.block.typeId,
        targetX: bx,
        targetY: by,
        targetZ: bz,
      })
    );
  });

  // ---- 容器关闭 ----
  safeSubscribe(AE.blockContainerClosed, (event: any) => {
    if (!ENABLED_EVENTS.has("container.close")) return;
    const source = event.closeSource.entity;
    if (!source || source.typeId !== "minecraft:player") return;
    const [bx, by, bz] = loc(event.block.location);
    enqueue(
      playerEntry(source as Player, "container.close", {
        targetType: "block",
        targetName: event.block.typeId,
        targetX: bx,
        targetY: by,
        targetZ: bz,
      })
    );
  });

  // ---- 爆炸 ----
  safeSubscribe(AE.explosion, (event: any) => {
    if (!ENABLED_EVENTS.has("world.explosion")) return;
    const source = event.source;
    const dimension = event.dimension.id.replace("minecraft:", "");
    const [sx, sy, sz] = source ? loc(source.location) : [0, 0, 0];
    enqueue({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      dimension,
      sourceType: source ? (source.typeId === "minecraft:player" ? "player" : "entity") : "world",
      sourceid: source?.typeId === "minecraft:player" ? playerId(source as Player) : "",
      sourceName: source?.typeId || "unknown",
      sourceX: sx,
      sourceY: sy,
      sourceZ: sz,
      eventType: "world.explosion",
      targetType: "",
      targetid: "",
      targetName: "",
      targetX: null,
      targetY: null,
      targetZ: null,
      detail: { impactedBlocks: event.getImpactedBlocks().length },
    });
  });
}

// ============================================
//  定时清理
// ============================================

async function doCleanup() {
  try {
    await HttpDB.post("/api/sfmc/activities/cleanup", { keepDays: KEEP_DAYS, keepAdmin: true });
  } catch {
    // 忽略清理失败
  }
}

// ============================================
//  公开 API
// ============================================

export class ActivityLog {
  /** 注册事件（由 entry.ts 统一调用） */
  static registerEvents(): void {
    debug.i("DATA", "ActivityLog.registerEvents");
    if (subscriptions.length > 0) return;
    subscribe();
  }

  static cleanup(): void {
    debug.i("DATA", "ActivityLog.cleanup");
    for (const s of subscriptions) {
      try {
        s.unsubscribe();
      } catch {}
    }
    subscriptions.length = 0;
    if (flushTimer !== null) {
      try {
        system.clearRun(flushTimer);
      } catch {}
      flushTimer = null;
    }
    if (flushIntervalId !== undefined) {
      try {
        system.clearRun(flushIntervalId);
      } catch {}
      flushIntervalId = undefined;
    }
    if (cleanupStartTimeoutId !== undefined) {
      try {
        system.clearRun(cleanupStartTimeoutId);
      } catch {}
      cleanupStartTimeoutId = undefined;
    }
    if (cleanupIntervalId !== undefined) {
      try {
        system.clearRun(cleanupIntervalId);
      } catch {}
      cleanupIntervalId = undefined;
    }
    initialized = false;
  }

  static init(): void {
    debug.i("DATA", "ActivityLog.init");
    if (initialized) return;
    initialized = true;

    console.info("[ActivityLog] 事件订阅完成");

    // 定时 flush 队列
    flushIntervalId = system.runInterval(flush, FLUSH_INTERVAL / 50);

    // 定时清理（首次 1 小时后，之后每 6 小时）
    cleanupStartTimeoutId = system.runTimeout(() => {
      cleanupStartTimeoutId = undefined;
      doCleanup();
      cleanupIntervalId = system.runInterval(doCleanup, CLEANUP_INTERVAL / 50);
    }, 72000 / 50); // 1 小时后
  }
}
