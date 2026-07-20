/* ---------------------------------------- *\
 *  Name        :  生存区域                   *
 *  Description :  全图除创造区外强制生存（需配合创造区）       *
 *  Version     :  1.0.0                    *
 *  Author      :  Shiroha7z                *
\* ---------------------------------------- */

import {
  Entity,
  GameMode,
  PlayerDimensionChangeAfterEvent,
  PlayerGameModeChangeBeforeEvent,
  PlayerSpawnAfterEvent,
  system,
  world,
} from "@minecraft/server";
import { ConfigManager } from "../../../../../scriptsforminecraftserver/scripts/libs/ConfigManager.js";
import { Permission } from "../../../../../scriptsforminecraftserver/scripts/libs/Permission.js";
import * as Tool from "../../../../../scriptsforminecraftserver/scripts/libs/Tools.js";
import { Msg } from "../../../../../scriptsforminecraftserver/scripts/libs/Tools.js";
import { CreativeArea } from "@sfmc/module-creative";

export class SurvivalArea {
  static _instance: SurvivalArea;
  /**
   * @returns {SurvivalArea}
   */
  static getInstance(): SurvivalArea {
    if (!SurvivalArea._instance) {
      SurvivalArea._instance = new SurvivalArea();
    }
    return SurvivalArea._instance;
  }

  enable = true;

  private subscriptions: Array<any> = [];

  /** 注册命令和权限（由 entry.ts 在 startup 阶段调用） */
  registerCommandsAndPermissions() {
    Permission.register("survivalarea.gamemode.bypass", Permission.OP);
  }

  /** 注册事件（由 entry.ts 统一调用） */
  registerEvents() {
    if (this.subscriptions.length > 0) return;
    // 进服时检测
    this.subscriptions.push(
      world.afterEvents.playerSpawn.subscribe((event: PlayerSpawnAfterEvent) => {
        if (!event.initialSpawn) return;
        if (!CreativeArea.enable) return;
        if (!this.enable) return;

        const player = event.player;
        const mode = player.getGameMode();
        if (mode === GameMode.Survival || mode === GameMode.Adventure) return;

        system.runTimeout(() => {
          if (!this.inCreativeArea(player)) {
            this.forceSurvival(player);
          }
        }, 60);
      })
    );

    // 阻止手动切换到创造/旁观（区外）
    this.subscriptions.push(
      world.beforeEvents.playerGameModeChange.subscribe((event: PlayerGameModeChangeBeforeEvent) => {
        if (!CreativeArea.enable) return;
        if (!this.enable) return;
        if (event.toGameMode === GameMode.Creative || event.toGameMode === GameMode.Spectator) {
          if (Permission.check(event.player, "survivalarea.gamemode.bypass")) return;
          if (!this.inCreativeArea(event.player)) {
            event.cancel = true;
            Msg.error(`你当前不在创造区域内，无法切换到该模式。`, event.player);
          }
        }
      })
    );

    // 跨维度传送后检测
    this.subscriptions.push(
      world.afterEvents.playerDimensionChange.subscribe((event: PlayerDimensionChangeAfterEvent) => {
        if (!CreativeArea.enable) return;
        if (!this.enable) return;
        const player = event.player;
        const mode = player.getGameMode();
        if (mode === GameMode.Survival || mode === GameMode.Adventure) return;

        system.runTimeout(() => {
          if (!this.inCreativeArea(player)) {
            this.forceSurvival(player);
          }
        }, 10);
      })
    );
  }

  init() {
    // 核心逻辑已在 registerEvents 中订阅事件
  }

  cleanup() {
    for (const s of this.subscriptions) {
      try {
        s.unsubscribe();
      } catch {}
    }
    this.subscriptions = [];
  }

  private inCreativeArea(entity: Entity): boolean {
    for (const area of ConfigManager.getAreas("creative")) {
      if (entity.dimension.id === area.dimension) {
        if (
          Tool.pointInArea_2D(
            entity.location.x,
            entity.location.z,
            area.start[0],
            area.start[1],
            area.end[0],
            area.end[1]
          )
        ) {
          return true;
        }
      }
    }
    return false;
  }

  private forceSurvival(player: any) {
    player.setGameMode(GameMode.Survival);
    Msg.info(`已离开创造区域，强制切换为生存模式。`, player);
  }
}