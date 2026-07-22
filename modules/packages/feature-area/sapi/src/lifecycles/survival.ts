/**
 * lifecycles/survival.ts — 区域生存
 *
 * 创造区以外强制生存,阻止在创造区外切到创造/旁观。
 * 依赖 creative 子功能的连锁开关与创造区判定。
 */

import {
  Entity,
  GameMode,
  Player,
  PlayerDimensionChangeAfterEvent,
  PlayerGameModeChangeBeforeEvent,
  PlayerSpawnAfterEvent,
  system,
  world,
} from "@minecraft/server";
import { Msg, Permission } from "@sfmc/sdk/sapi/runtime";
import type { ModuleLifecycle } from "@sfmc/sdk/module-loader";
import { pointInFeatureArea } from "../area-service.js";
import { isCreativeChainEnabled } from "./creative.js";

let _enabled = true;
// 事件退订 thunk(SAPI 的 event.subscribe 返回回调本身,退订需 event.unsubscribe(cb))
const _eventCleanups: Array<() => void> = [];

/** 实体是否在开启 creative 的区域内 */
function inCreativeArea(entity: Entity): boolean {
  return (
    pointInFeatureArea("creative", entity.dimension.id, entity.location.x, entity.location.z) !== null
  );
}

function forceSurvival(player: Player): void {
  player.setGameMode(GameMode.Survival);
  Msg.info(`已离开创造区域，强制切换为生存模式。`, player);
}

export const survivalLifecycle: ModuleLifecycle = {
  registerPermissions() {
    Permission.register("survivalarea.gamemode.bypass", Permission.OP);
  },

  registerEvents() {
    if (_eventCleanups.length > 0) return;

    // 进服时检测
    const spawnCb = world.afterEvents.playerSpawn.subscribe((event: PlayerSpawnAfterEvent) => {
      if (!event.initialSpawn) return;
      if (!isCreativeChainEnabled()) return;
      if (!_enabled) return;

      const player = event.player;
      const mode = player.getGameMode();
      if (mode === GameMode.Survival || mode === GameMode.Adventure) return;

      system.runTimeout(() => {
        if (!inCreativeArea(player)) {
          forceSurvival(player);
        }
      }, 60);
    });
    _eventCleanups.push(() => world.afterEvents.playerSpawn.unsubscribe(spawnCb));

    // 阻止手动切换到创造/旁观(区外)
    const gmCb = world.beforeEvents.playerGameModeChange.subscribe((event: PlayerGameModeChangeBeforeEvent) => {
      if (!isCreativeChainEnabled()) return;
      if (!_enabled) return;
      if (event.toGameMode === GameMode.Creative || event.toGameMode === GameMode.Spectator) {
        if (Permission.check(event.player, "survivalarea.gamemode.bypass")) return;
        if (!inCreativeArea(event.player)) {
          event.cancel = true;
          Msg.error(`你当前不在创造区域内，无法切换到该模式。`, event.player);
        }
      }
    });
    _eventCleanups.push(() => world.beforeEvents.playerGameModeChange.unsubscribe(gmCb));

    // 跨维度传送后检测
    const dimCb = world.afterEvents.playerDimensionChange.subscribe((event: PlayerDimensionChangeAfterEvent) => {
      if (!isCreativeChainEnabled()) return;
      if (!_enabled) return;
      const player = event.player;
      const mode = player.getGameMode();
      if (mode === GameMode.Survival || mode === GameMode.Adventure) return;

      system.runTimeout(() => {
        if (!inCreativeArea(player)) {
          forceSurvival(player);
        }
      }, 10);
    });
    _eventCleanups.push(() => world.afterEvents.playerDimensionChange.unsubscribe(dimCb));
  },

  init() {
    // 核心逻辑已在 registerEvents 中订阅事件
    void _enabled;
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
  },
};
