/**
 * @sfmc/module-activity-log — v2 入口
 *
 * ModuleRegistry.register + 19 种 SAPI 事件订阅 + 内存队列 + 2s flush
 * 批量写 sfmc_activities(平台 bootstrap 表,非 defineTable)。
 *
 * 列名注意:v1 用 camelCase(`sourceid` / `targetid` / `sourceX` / `targetX` ...),
 * sfmc_activities schema 是 snake_case,在 flush 时映射。
 */

import { Block, Entity, Player, system, Vector3, world } from "@minecraft/server";
import { db } from "@sfmc/sdk/sapi/db";
import { debug } from "@sfmc/sdk/sapi/runtime";
import { ModuleRegistry } from "@sfmc/sdk/module-loader";

const MODULE_ID = "feature-activity-log";

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

const FLUSH_INTERVAL_TICKS = 40;
const CLEANUP_INTERVAL_TICKS = 6 * 72000;
const CLEANUP_START_DELAY_TICKS = 72000;
const KEEP_DAYS = 30;

interface Entry {
  id: string;
  timestamp: number;
  dimension: string;
  sourceType: string;
  sourceid: string;
  sourceName: string;
  sourceX: number | null;
  sourceY: number | null;
  sourceZ: number | null;
  eventType: string;
  targetType: string;
  targetid: string;
  targetName: string;
  targetX: number | null;
  targetY: number | null;
  targetZ: number | null;
  detail: Record<string, unknown>;
}

let queue: Entry[] = [];
let flushTimer: number | undefined;
const subscriptions: Array<{ unsubscribe(): void }> = [];
let flushIntervalId: number | undefined;
let cleanupStartTimeoutId: number | undefined;
let cleanupIntervalId: number | undefined;
let initialized = false;

function dimId(entityOrBlock: Entity | Block): string {
  try {
    return entityOrBlock.dimension?.id?.replace("minecraft:", "") || "";
  } catch {
    return "";
  }
}

function loc(v?: Vector3): [number | null, number | null, number | null] {
  if (!v) return [null, null, null];
  return [v.x, v.y, v.z];
}

function playerId(player: Player): string {
  try {
    return player.id || "";
  } catch {
    return "";
  }
}

function makeId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function playerEntry(player: Player, eventType: string, extra: Partial<Entry> = {}): Entry {
  const [x, y, z] = loc(player.location);
  return {
    id: makeId(),
    timestamp: Date.now(),
    dimension: dimId(player),
    sourceType: "player",
    sourceid: playerId(player),
    sourceName: player.name,
    sourceX: x,
    sourceY: y,
    sourceZ: z,
    eventType,
    targetType: extra.targetType ?? "",
    targetid: extra.targetid ?? "",
    targetName: extra.targetName ?? "",
    targetX: extra.targetX ?? null,
    targetY: extra.targetY ?? null,
    targetZ: extra.targetZ ?? null,
    detail: extra.detail ?? {},
  };
}

function genericEntry(opts: Partial<Entry> & { eventType: string }): Entry {
  return {
    id: makeId(),
    timestamp: Date.now(),
    dimension: opts.dimension ?? "",
    sourceType: opts.sourceType ?? "world",
    sourceid: opts.sourceid ?? "",
    sourceName: opts.sourceName ?? "",
    sourceX: opts.sourceX ?? null,
    sourceY: opts.sourceY ?? null,
    sourceZ: opts.sourceZ ?? null,
    eventType: opts.eventType,
    targetType: opts.targetType ?? "",
    targetid: opts.targetid ?? "",
    targetName: opts.targetName ?? "",
    targetX: opts.targetX ?? null,
    targetY: opts.targetY ?? null,
    targetZ: opts.targetZ ?? null,
    detail: opts.detail ?? {},
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
  if (entity.typeId === "minecraft:player") return entity.typeId;
  try {
    return (entity as Player).name || entity.typeId;
  } catch {
    return entity.typeId;
  }
}

function enqueue(entry: Entry): void {
  queue.push(entry);
  if (flushTimer === undefined) {
    flushTimer = system.runInterval(() => void flush(), FLUSH_INTERVAL_TICKS);
  }
}

async function flush(): Promise<void> {
  if (queue.length === 0) {
    if (flushTimer !== undefined) {
      try {
        system.clearRun(flushTimer);
      } catch {
        /* ignore */
      }
      flushTimer = undefined;
    }
    return;
  }
  const batch = queue;
  queue = [];
  const createdAt = Date.now();
  try {
    await db.tx(async (tx) => {
      for (const e of batch) {
        await tx.insert("sfmc_activities", {
          id: e.id,
          timestamp: e.timestamp,
          dimension: e.dimension,
          source_type: e.sourceType,
          source_id: e.sourceid,
          source_name: e.sourceName,
          source_x: e.sourceX,
          source_y: e.sourceY,
          source_z: e.sourceZ,
          event_type: e.eventType,
          target_type: e.targetType,
          target_id: e.targetid,
          target_name: e.targetName,
          target_x: e.targetX,
          target_y: e.targetY,
          target_z: e.targetZ,
          detail: JSON.stringify(e.detail ?? {}),
          created_at: createdAt,
        });
      }
    });
  } catch (err) {
    debug.w("ActivityLog", `flush failed (${batch.length} entries retained): ${(err as Error).message}`);
    queue = batch.concat(queue);
  }
}

async function doCleanup(): Promise<void> {
  try {
    const cutoff = Date.now() - KEEP_DAYS * 86400_000;
    const old = await db.query<{ id: string }>("sfmc_activities", {
      where: { lt: ["timestamp", cutoff] },
      limit: 1000,
    });
    if (old.length === 0) return;
    await db.tx(async (tx) => {
      for (const row of old) await tx.delete("sfmc_activities", row.id);
    });
  } catch (err) {
    debug.w("ActivityLog", `cleanup failed: ${(err as Error).message}`);
  }
}

function safeSubscribe(signal: { subscribe?: (cb: (arg: unknown) => void) => unknown }, cb: (arg: any) => void): void {
  if (signal && typeof signal.subscribe === "function") {
    const sub = signal.subscribe(cb) as { unsubscribe?: () => void };
    if (sub && typeof sub.unsubscribe === "function") {
      subscriptions.push(sub as { unsubscribe(): void });
    }
  }
}

function subscribe(): void {
  const AE = world.afterEvents;

  safeSubscribe(AE.playerSpawn, (event: any) => {
    if (!event.initialSpawn) return;
    if (!ENABLED_EVENTS.has("player.join")) return;
    enqueue(playerEntry(event.player, "player.join"));
  });

  safeSubscribe(AE.playerLeave, (event: any) => {
    if (!ENABLED_EVENTS.has("player.leave")) return;
    enqueue({
      ...genericEntry({
        eventType: "player.leave",
        sourceType: "player",
        sourceid: "",
        sourceName: event.playerName,
        detail: { playerId: event.playerId },
      }),
    });
  });

  safeSubscribe(AE.playerSpawn, (event: any) => {
    if (event.initialSpawn) return;
    if (!ENABLED_EVENTS.has("player.spawn")) return;
    enqueue(playerEntry(event.player, "player.spawn"));
  });

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

  safeSubscribe(AE.playerGameModeChange, (event: any) => {
    if (!ENABLED_EVENTS.has("player.gamemode")) return;
    enqueue(
      playerEntry(event.player, "player.gamemode", {
        detail: { from: event.fromGameMode, to: event.toGameMode },
      })
    );
  });

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
      })
    );
  });

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
      const [kx, ky, kz] = killer ? loc(killer.location) : [null, null, null];
      enqueue(
        genericEntry({
          eventType: "entity.death",
          dimension: dimId(dead),
          sourceType: killer ? "entity" : "world",
          sourceid: "",
          sourceName: killer?.typeId || cause,
          sourceX: kx,
          sourceY: ky,
          sourceZ: kz,
          targetType,
          targetid,
          targetName,
          targetX: dx,
          targetY: dy,
          targetZ: dz,
          detail: { cause, projectile: ds.damagingProjectile?.typeId || null },
        })
      );
    }
  });

  safeSubscribe(AE.entityHitEntity, (event: any) => {
    if (!ENABLED_EVENTS.has("entity.hit")) return;
    const attacker = event.damagingEntity;
    const victim = event.hitEntity;
    const [vx, vy, vz] = loc(victim.location);

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
    if (victim.typeId === "minecraft:player" && attacker.typeId !== "minecraft:player") {
      const [ax, ay, az] = loc(attacker.location);
      enqueue(
        genericEntry({
          eventType: "entity.hit",
          dimension: dimId(attacker),
          sourceType: "entity",
          sourceid: "",
          sourceName: attacker.typeId,
          sourceX: ax,
          sourceY: ay,
          sourceZ: az,
          targetType: "player",
          targetid: getTargetPlayerId(victim),
          targetName: getTargetPlayerName(victim),
          targetX: vx,
          targetY: vy,
          targetZ: vz,
        })
      );
    }
  });

  safeSubscribe(AE.entityHurt, (event: any) => {
    if (!ENABLED_EVENTS.has("entity.hurt")) return;
    const hurt = event.hurtEntity;
    const ds = event.damageSource;
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

  safeSubscribe(AE.entitySpawn, (event: any) => {
    if (!ENABLED_EVENTS.has("entity.spawn")) return;
    const e = event.entity;
    if (e.typeId === "minecraft:player") return;
    const [ex, ey, ez] = loc(e.location);
    enqueue(
      genericEntry({
        eventType: "entity.spawn",
        dimension: dimId(e),
        sourceType: "entity",
        sourceid: "",
        sourceName: e.typeId,
        sourceX: ex,
        sourceY: ey,
        sourceZ: ez,
        detail: { cause: event.cause },
      })
    );
  });

  safeSubscribe(AE.entityItemDrop, (event: any) => {
    if (!ENABLED_EVENTS.has("item.drop")) return;
    const e = event.entity;
    const [ex, ey, ez] = loc(e.location);
    const itemList = event.items.map((item: any) => item.typeId).filter(Boolean);
    if (e.typeId === "minecraft:player") {
      enqueue(playerEntry(e as Player, "item.drop", { detail: { items: itemList } }));
    } else {
      enqueue(
        genericEntry({
          eventType: "item.drop",
          dimension: dimId(e),
          sourceType: "entity",
          sourceid: "",
          sourceName: e.typeId,
          sourceX: ex,
          sourceY: ey,
          sourceZ: ez,
          detail: { items: itemList },
        })
      );
    }
  });

  safeSubscribe(AE.entityItemPickup, (event: any) => {
    if (!ENABLED_EVENTS.has("item.pickup")) return;
    const e = event.entity;
    if (e.typeId !== "minecraft:player") return;
    enqueue(
      playerEntry(e as Player, "item.pickup", {
        detail: {
          items: event.items.map((item: any) => item.type.id),
        },
      })
    );
  });

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

  safeSubscribe(AE.explosion, (event: any) => {
    if (!ENABLED_EVENTS.has("world.explosion")) return;
    const source = event.source;
    const dimension = event.dimension.id.replace("minecraft:", "");
    const [sx, sy, sz] = source ? loc(source.location) : [null, null, null];
    enqueue(
      genericEntry({
        eventType: "world.explosion",
        dimension,
        sourceType: source ? (source.typeId === "minecraft:player" ? "player" : "entity") : "world",
        sourceid: source?.typeId === "minecraft:player" ? playerId(source as Player) : "",
        sourceName: source?.typeId || "unknown",
        sourceX: sx,
        sourceY: sy,
        sourceZ: sz,
        detail: { impactedBlocks: event.getImpactedBlocks().length },
      })
    );
  });
}

ModuleRegistry.register({
  id: MODULE_ID,
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions() {
      // 纯日志收集,无对外命令
    },
    async init() {
      if (initialized) return;
      initialized = true;
      console.info("[ActivityLog] 事件订阅完成");

      subscribe();

      flushIntervalId = system.runInterval(() => void flush(), FLUSH_INTERVAL_TICKS);

      cleanupStartTimeoutId = system.runTimeout(() => {
        cleanupStartTimeoutId = undefined;
        void doCleanup();
        cleanupIntervalId = system.runInterval(() => void doCleanup(), CLEANUP_INTERVAL_TICKS);
      }, CLEANUP_START_DELAY_TICKS);

      debug.i("DATA", "ActivityLog.init");
    },
    cleanup() {
      for (const s of subscriptions) {
        try {
          s.unsubscribe();
        } catch {
          /* ignore */
        }
      }
      subscriptions.length = 0;
      if (flushTimer !== undefined) {
        try {
          system.clearRun(flushTimer);
        } catch {
          /* ignore */
        }
        flushTimer = undefined;
      }
      if (flushIntervalId !== undefined) {
        try {
          system.clearRun(flushIntervalId);
        } catch {
          /* ignore */
        }
        flushIntervalId = undefined;
      }
      if (cleanupStartTimeoutId !== undefined) {
        try {
          system.clearRun(cleanupStartTimeoutId);
        } catch {
          /* ignore */
        }
        cleanupStartTimeoutId = undefined;
      }
      if (cleanupIntervalId !== undefined) {
        try {
          system.clearRun(cleanupIntervalId);
        } catch {
          /* ignore */
        }
        cleanupIntervalId = undefined;
      }
      void flush();
      initialized = false;
      debug.i("DATA", "ActivityLog.cleanup");
    },
  },
});