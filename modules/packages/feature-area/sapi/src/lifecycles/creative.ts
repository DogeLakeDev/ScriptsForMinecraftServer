/**
 * lifecycles/creative.ts — 区域创造
 *
 * 进出创造区切换模式;限制放置/破坏;禁放违禁物;清刷怪。
 * 违禁物读 configs/area.json 的 creative.banned_items。
 * _chainEnabled 同时约束 creative + survival(供 survival 子生命周期读取)。
 */

import {
  Entity,
  EntityInitializationCause,
  EntitySpawnAfterEvent,
  GameMode,
  Player,
  PlayerBreakBlockBeforeEvent,
  PlayerDimensionChangeAfterEvent,
  PlayerPlaceBlockBeforeEvent,
  PlayerSpawnAfterEvent,
  system,
  world,
} from "@minecraft/server";
import { Msg, Permission, pointInArea_2D } from "@sfmc/sdk/sapi/runtime";
import { config } from "@sfmc/sdk/sapi/config";
import type { ModuleLifecycle } from "@sfmc/sdk/module-loader";
import { areasByFeature, pointInFeatureArea } from "../area-service.js";

interface CreativeConfig {
  banned_items?: string[];
}

const BORDER_THRESHOLD = 10;
const BUFFER_ZONE = 3;

/** 连锁开关:同时控制 creative + survival(等价 v1 CreativeArea.enable) */
let _chainEnabled = true;
let _bannedItems: string[] = [];

// 事件退订 thunk(SAPI 的 event.subscribe 返回回调本身,退订需 event.unsubscribe(cb))
const _eventCleanups: Array<() => void> = [];
const _tickRunIds: number[] = [];

/** 连锁开关状态(供 survival 子生命周期读取) */
export function isCreativeChainEnabled(): boolean {
  return _chainEnabled;
}

/* ── 区域判定 ─────────────────────────────────────────────── */

function inArea(entity: Entity): string | undefined {
  const area = pointInFeatureArea("creative", entity.dimension.id, entity.location.x, entity.location.z);
  return area ? area.name : undefined;
}

function inAreaByPos(x: number, z: number, dimensionId: string): boolean {
  for (const area of areasByFeature("creative")) {
    if (dimensionId === area.dimension) {
      if (pointInArea_2D(x, z, area.start[0], area.start[1], area.end[0], area.end[1])) {
        return true;
      }
    }
  }
  return false;
}

function isNearBorder(entity: Entity, threshold: number = BORDER_THRESHOLD): boolean {
  for (const area of areasByFeature("creative")) {
    if (entity.dimension.id !== area.dimension) continue;
    const minX = Math.min(area.start[0], area.end[0]) - threshold;
    const maxX = Math.max(area.start[0], area.end[0]) + threshold;
    const minZ = Math.min(area.start[1], area.end[1]) - threshold;
    const maxZ = Math.max(area.start[1], area.end[1]) + threshold;
    if (
      entity.location.x >= minX &&
      entity.location.x <= maxX &&
      entity.location.z >= minZ &&
      entity.location.z <= maxZ
    )
      return true;
  }
  return false;
}

function inBufferZone(entity: Entity): boolean {
  for (const area of areasByFeature("creative")) {
    if (entity.dimension.id !== area.dimension) continue;
    const minX = Math.min(area.start[0], area.end[0]);
    const maxX = Math.max(area.start[0], area.end[0]);
    const minZ = Math.min(area.start[1], area.end[1]);
    const maxZ = Math.max(area.start[1], area.end[1]);
    const x = entity.location.x;
    const z = entity.location.z;
    const inExpanded =
      x >= minX - BUFFER_ZONE && x <= maxX + BUFFER_ZONE && z >= minZ - BUFFER_ZONE && z <= maxZ + BUFFER_ZONE;
    if (!inExpanded) continue;
    if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) continue;
    return true;
  }
  return false;
}

function creativeDims(): Set<string> {
  const dims = new Set<string>();
  for (const area of areasByFeature("creative")) dims.add(area.dimension);
  return dims;
}

/* ── 进入 / 离开 处理(背包由 InventorySwitcher 接管) ─────── */

function enterArea(player: Player, areaName: string): void {
  saveScores(player);
  player.setGameMode(GameMode.Creative);
  player.setDynamicProperty("hpbe:creative_area", areaName);
  Msg.info(`进入 §a${areaName}创造区域§r ，切换为创造模式。`, player);
}

function leaveArea(player: Player, areaName: string): void {
  restoreScores(player);
  player.setGameMode(GameMode.Survival);
  player.setDynamicProperty("hpbe:creative_area", undefined);
  Msg.info(`离开 §a${areaName}创造区域§r ，恢复生存模式。`, player);
}

/* ── 计分项保存 / 恢复 ─────────────────────────────────────── */

function saveScores(player: Player): void {
  const identity = player.scoreboardIdentity;
  if (!identity) return;
  const scores: Record<string, number> = {};
  for (const obj of world.scoreboard.getObjectives()) {
    try {
      const score = obj.getScore(identity);
      if (score !== undefined) scores[obj.id] = score;
    } catch {
      /* ignore */
    }
  }
  if (Object.keys(scores).length > 0) {
    player.setDynamicProperty("hpbe:creative_scores", JSON.stringify(scores));
  }
}

function restoreScores(player: Player): void {
  const raw = player.getDynamicProperty("hpbe:creative_scores") as string | undefined;
  const scores: Record<string, number> | undefined = raw ? JSON.parse(raw) : undefined;
  if (!scores) return;
  const identity = player.scoreboardIdentity;
  if (!identity) return;
  for (const obj of world.scoreboard.getObjectives()) {
    const v = scores[obj.id];
    if (v !== undefined) {
      try {
        obj.setScore(identity, v);
      } catch {
        /* ignore */
      }
    }
  }
  player.setDynamicProperty("hpbe:creative_scores", undefined);
}

/* ── 定时扫描(进出检测) ───────────────────────────────────── */

function startTick(): void {
  _tickRunIds.push(
    system.runInterval(() => {
      if (!_chainEnabled) return;
      for (const player of world.getPlayers()) {
        if (player.getGameMode() === GameMode.Spectator) continue;
        const currentArea = player.getDynamicProperty("hpbe:creative_area") as string | undefined;
        if (currentArea === undefined) {
          const areaName = inArea(player);
          if (areaName !== undefined) enterArea(player, areaName);
        } else if (inArea(player) === undefined) {
          leaveArea(player, currentArea);
        }
      }
    }, 10)
  );
}

function startBorderFastCheck(): void {
  _tickRunIds.push(
    system.runInterval(() => {
      if (!_chainEnabled) return;
      for (const player of world.getPlayers()) {
        if (player.getGameMode() !== GameMode.Creative) continue;
        if (!isNearBorder(player)) continue;
        const currentArea = player.getDynamicProperty("hpbe:creative_area") as string | undefined;
        if (currentArea !== undefined && inArea(player) === undefined) {
          leaveArea(player, currentArea);
        }
      }
    }, 2)
  );
}

export const creativeLifecycle: ModuleLifecycle = {
  registerPermissions() {
    Permission.register("creativearea.place_banned", Permission.Admin);
  },

  registerEvents() {
    if (_eventCleanups.length > 0) return;

    const spawnCb = world.afterEvents.playerSpawn.subscribe((event: PlayerSpawnAfterEvent) => {
      if (!event.initialSpawn) return;
      system.runTimeout(() => {
        const areaName = inArea(event.player);
        if (areaName !== undefined) {
          enterArea(event.player, areaName);
        } else if (
          event.player.getGameMode() === GameMode.Creative ||
          event.player.getGameMode() === GameMode.Spectator
        ) {
          event.player.setGameMode(GameMode.Survival);
        }
      }, 60);
    });
    _eventCleanups.push(() => world.afterEvents.playerSpawn.unsubscribe(spawnCb));

    const dimCb = world.afterEvents.playerDimensionChange.subscribe((event: PlayerDimensionChangeAfterEvent) => {
      if (!_chainEnabled) return;
      system.runTimeout(() => {
        const areaName = inArea(event.player);
        const currentArea = event.player.getDynamicProperty("hpbe:creative_area") as string | undefined;
        if (currentArea === undefined && areaName !== undefined) {
          enterArea(event.player, areaName);
        } else if (currentArea !== undefined && areaName === undefined) {
          leaveArea(event.player, currentArea);
        }
      }, 10);
    });
    _eventCleanups.push(() => world.afterEvents.playerDimensionChange.unsubscribe(dimCb));

    const entityCb = world.afterEvents.entitySpawn.subscribe((event: EntitySpawnAfterEvent) => {
      if (!_chainEnabled) return;
      if (!event.entity) return;
      if (event.entity.typeId === "minecraft:player") return;
      if (!creativeDims().has(event.entity.dimension.id)) return;
      try {
        if (event.cause === EntityInitializationCause.Spawned) {
          if (inArea(event.entity) !== undefined || inBufferZone(event.entity)) {
            event.entity.remove();
          }
        }
      } catch {
        /* ignore */
      }
    });
    _eventCleanups.push(() => world.afterEvents.entitySpawn.unsubscribe(entityCb));

    const placeCb = world.beforeEvents.playerPlaceBlock.subscribe((event: PlayerPlaceBlockBeforeEvent) => {
      if (!_chainEnabled) return;
      const player = event.player;
      if (player.getGameMode() !== GameMode.Creative) return;
      if (!inAreaByPos(event.block.location.x, event.block.location.z, player.dimension.id)) {
        event.cancel = true;
        Msg.error(`你只能在创造区域内放置方块。`, player);
        return;
      }
      if (_bannedItems.indexOf(event.permutationToPlace.type.id) !== -1) {
        if (!Permission.check(player, "creativearea.place_banned")) {
          event.cancel = true;
          Msg.error(`创造区域内禁止放置 ${event.permutationToPlace.type.id}。`, player);
        }
      }
    });
    _eventCleanups.push(() => world.beforeEvents.playerPlaceBlock.unsubscribe(placeCb));

    const breakCb = world.beforeEvents.playerBreakBlock.subscribe((event: PlayerBreakBlockBeforeEvent) => {
      if (!_chainEnabled) return;
      if (event.player.getGameMode() !== GameMode.Creative) return;
      if (!inAreaByPos(event.block.location.x, event.block.location.z, event.player.dimension.id)) {
        event.cancel = true;
        Msg.error(`你只能破坏创造区域内的方块。`, event.player);
      }
    });
    _eventCleanups.push(() => world.beforeEvents.playerBreakBlock.unsubscribe(breakCb));
  },

  async init() {
    const cfg = await config.get<CreativeConfig>("creative");
    _bannedItems = Array.isArray(cfg?.banned_items) ? cfg!.banned_items : [];
    config.onChange((key, value) => {
      if (key === "creative" && value && typeof value === "object") {
        const items = (value as CreativeConfig).banned_items;
        _bannedItems = Array.isArray(items) ? items : [];
      }
    });
    startTick();
    startBorderFastCheck();
  },

  cleanup() {
    for (const off of _eventCleanups) {
      try {
        off();
      } catch {
        /* ignore */
      }
    }
    _eventCleanups.length = 0;
    for (const id of _tickRunIds) {
      try {
        system.clearRun(id);
      } catch {
        /* ignore */
      }
    }
    _tickRunIds.length = 0;
  },
};
