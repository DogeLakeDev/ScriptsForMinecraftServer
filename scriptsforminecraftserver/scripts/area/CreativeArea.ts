/* ---------------------------------------- *\
 *  Name        :  区域创造                   *
 *  Description :  进出指定区域切换创造/生存模式     *
 *  Version     :  1.0.0                    *
 *  Author      :  Shiroha7z                *
\* ---------------------------------------- */

import {
  Player,
  system,
  world,
  GameMode,
  Entity,
  EntityInitializationCause,
  PlayerPlaceBlockBeforeEvent,
  PlayerBreakBlockBeforeEvent,
  PlayerDimensionChangeAfterEvent,
  PlayerSpawnAfterEvent,
  EntitySpawnAfterEvent,
} from "@minecraft/server";
import { ConfigManager } from "../libs/ConfigManager";
import * as Tool from "../libs/Tools";
import { Permission } from "../libs/Permission";
import { SurvivalArea } from "./SurvivalArea";

export class CreativeArea {
  static _instance: CreativeArea;
  static getInstance() {
    if (!CreativeArea._instance) {
      CreativeArea._instance = new CreativeArea();
    }
    return CreativeArea._instance;
  }

  /** 连锁开关（同时控制 CreativeArea + SurvivalArea） */
  static enable = true;

  private readonly BORDER_THRESHOLD = 10;
  private readonly BORDER_WARNING_DISTANCE = 5;
  private readonly BUFFER_ZONE = 3;

  private subscriptions: Array<any> = [];
  private tickRunIds: number[] = [];

  /** 注册命令和权限（由 entry.ts 在 startup 阶段调用） */
  registerCommandsAndPermissions() {
    Permission.register("creativearea.place_banned", Permission.Admin);
  }

  /** 注册事件（由 entry.ts 统一调用） */
  registerEvents() {
    if (this.subscriptions.length > 0) return;
    this.subscriptions.push(
      world.afterEvents.playerSpawn.subscribe((event: PlayerSpawnAfterEvent) => {
        if (!event.initialSpawn) return;
        system.runTimeout(() => {
          const areaName = this.inArea(event.player);
          if (areaName !== undefined) {
            this.enterArea(event.player, areaName);
          } else if (
            event.player.getGameMode() === GameMode.Creative ||
            event.player.getGameMode() === GameMode.Spectator
          ) {
            event.player.setGameMode(GameMode.Survival);
          }
        }, 60);
      })
    );

    this.subscriptions.push(
      world.afterEvents.playerDimensionChange.subscribe((event: PlayerDimensionChangeAfterEvent) => {
        if (!CreativeArea.enable) return;
        system.runTimeout(() => {
          const areaName = this.inArea(event.player);
          const currentArea = event.player.getDynamicProperty("hpbe:creative_area") as string | undefined;
          if (currentArea === undefined && areaName !== undefined) {
            this.enterArea(event.player, areaName);
          } else if (currentArea !== undefined && areaName === undefined) {
            this.leaveArea(event.player, currentArea);
          }
        }, 10);
      })
    );

    this.subscriptions.push(
      world.afterEvents.entitySpawn.subscribe((event: EntitySpawnAfterEvent) => {
        if (!CreativeArea.enable) return;
        if (!event.entity) return;
        if (event.entity.typeId === "minecraft:player") return;
        if (!this.creativeDims.has(event.entity.dimension.id)) return;
        try {
          if (event.cause === EntityInitializationCause.Spawned) {
            if (this.inArea(event.entity) !== undefined || this.inBufferZone(event.entity)) {
              event.entity.remove();
            }
          }
        } catch {}
      })
    );

    this.subscriptions.push(
      world.beforeEvents.playerPlaceBlock.subscribe((event: PlayerPlaceBlockBeforeEvent) => {
        if (!CreativeArea.enable) return;
        const player = event.player;
        if (player.getGameMode() !== GameMode.Creative) return;
        if (!this.inAreaByPos(event.block.location.x, event.block.location.z, player.dimension.id)) {
          event.cancel = true;
          Tool.Msg.error(`你只能在创造区域内放置方块。`, player);
          return;
        }
        if (ConfigManager.getBannedItems().indexOf(event.permutationToPlace.type.id) !== -1) {
          if (!Permission.check(player, "creativearea.place_banned")) {
            event.cancel = true;
            Tool.Msg.error(`创造区域内禁止放置 ${event.permutationToPlace.type.id}。`, player);
          }
        }
      })
    );

    this.subscriptions.push(
      world.beforeEvents.playerBreakBlock.subscribe((event: PlayerBreakBlockBeforeEvent) => {
        if (!CreativeArea.enable) return;
        if (event.player.getGameMode() !== GameMode.Creative) return;
        if (!this.inAreaByPos(event.block.location.x, event.block.location.z, event.player.dimension.id)) {
          event.cancel = true;
          Tool.Msg.error(`你只能破坏创造区域内的方块。`, event.player);
        }
      })
    );
  }

  cleanup() {
    for (const s of this.subscriptions) {
      try {
        s.unsubscribe();
      } catch {}
    }
    this.subscriptions = [];
    for (const id of this.tickRunIds) {
      try {
        system.clearRun(id);
      } catch {}
    }
    this.tickRunIds = [];
  }

  init() {
    this.startTick();
    this.startBorderFastCheck();
    //this.startBorderWarning();
  }

  // ==========================================
  //  区域判定
  // ==========================================

  private inArea(entity: Entity): string | undefined {
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
          return area.name;
        }
      }
    }
    return undefined;
  }

  private inAreaByPos(x: number, z: number, dimensionId: string): boolean {
    for (const area of ConfigManager.getAreas("creative")) {
      if (dimensionId === area.dimension) {
        if (Tool.pointInArea_2D(x, z, area.start[0], area.start[1], area.end[0], area.end[1])) {
          return true;
        }
      }
    }
    return false;
  }

  private isNearBorder(entity: Entity, threshold: number = this.BORDER_THRESHOLD): boolean {
    for (const area of ConfigManager.getAreas("creative")) {
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

  private inBufferZone(entity: Entity): boolean {
    for (const area of ConfigManager.getAreas("creative")) {
      if (entity.dimension.id !== area.dimension) continue;
      const minX = Math.min(area.start[0], area.end[0]);
      const maxX = Math.max(area.start[0], area.end[0]);
      const minZ = Math.min(area.start[1], area.end[1]);
      const maxZ = Math.max(area.start[1], area.end[1]);
      const x = entity.location.x,
        z = entity.location.z;
      const inExpanded =
        x >= minX - this.BUFFER_ZONE &&
        x <= maxX + this.BUFFER_ZONE &&
        z >= minZ - this.BUFFER_ZONE &&
        z <= maxZ + this.BUFFER_ZONE;
      if (!inExpanded) continue;
      if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) continue;
      return true;
    }
    return false;
  }

  private get creativeDims(): Set<string> {
    const dims = new Set<string>();
    for (const area of ConfigManager.getAreas("creative")) dims.add(area.dimension);
    return dims;
  }

  // ==========================================
  //  进入 / 离开 处理（背包由 InventorySwitcher 接管）
  // ==========================================

  private enterArea(player: Player, areaName: string) {
    this.saveScores(player);
    player.setGameMode(GameMode.Creative);
    player.setDynamicProperty("hpbe:creative_area", areaName);
    Tool.Msg.info(`进入 §a${areaName}创造区域§r ，切换为创造模式。`, player);
  }

  private leaveArea(player: Player, areaName: string) {
    this.restoreScores(player);
    player.setGameMode(GameMode.Survival);
    player.setDynamicProperty("hpbe:creative_area", undefined);
    Tool.Msg.info(`离开 §a${areaName}创造区域§r ，恢复生存模式。`, player);
  }

  // ==========================================
  //  计分项保存 / 恢复
  // ==========================================

  private saveScores(player: Player) {
    const identity = player.scoreboardIdentity;
    if (!identity) return;
    const scores: Record<string, number> = {};
    for (const obj of world.scoreboard.getObjectives()) {
      try {
        const score = obj.getScore(identity);
        if (score !== undefined) scores[obj.id] = score;
      } catch {}
    }
    if (Object.keys(scores).length > 0) {
      player.setDynamicProperty("hpbe:creative_scores", JSON.stringify(scores));
    }
  }

  private restoreScores(player: Player) {
    const raw = player.getDynamicProperty("hpbe:creative_scores") as string | undefined;
    const scores: Record<string, number> | undefined = raw ? JSON.parse(raw) : undefined;
    if (!scores) return;
    const identity = player.scoreboardIdentity;
    if (!identity) return;
    for (const obj of world.scoreboard.getObjectives()) {
      if (scores[obj.id] !== undefined) {
        try {
          obj.setScore(identity, scores[obj.id]);
        } catch {}
      }
    }
    player.setDynamicProperty("hpbe:creative_scores", undefined);
  }

  // ==========================================
  //  定时扫描（进出检测）
  // ==========================================

  private startTick() {
    this.tickRunIds.push(
      system.runInterval(() => {
        if (!CreativeArea.enable) return;
        for (const player of world.getPlayers()) {
          if (player.getGameMode() === GameMode.Spectator) continue;
          const currentArea = player.getDynamicProperty("hpbe:creative_area") as string | undefined;
          if (currentArea === undefined) {
            const areaName = this.inArea(player);
            if (areaName !== undefined) this.enterArea(player, areaName);
          } else {
            if (this.inArea(player) === undefined) this.leaveArea(player, currentArea);
          }
        }
      }, 10)
    );
  }

  // ==========================================
  //  边界快速检测
  // ==========================================

  private startBorderFastCheck() {
    this.tickRunIds.push(
      system.runInterval(() => {
        if (!CreativeArea.enable) return;
        for (const player of world.getPlayers()) {
          if (player.getGameMode() !== GameMode.Creative) continue;
          if (!this.isNearBorder(player)) continue;
          const currentArea = player.getDynamicProperty("hpbe:creative_area") as string | undefined;
          if (currentArea !== undefined && this.inArea(player) === undefined) {
            this.leaveArea(player, currentArea);
          }
        }
      }, 2)
    );
  }

  // ==========================================
  //  边界视觉警告
  // ==========================================

  private startBorderWarning() {
    this.tickRunIds.push(
      system.runInterval(() => {
        if (!CreativeArea.enable) return;
        for (const player of world.getPlayers()) {
          for (const area of ConfigManager.getAreas("creative")) {
            if (player.dimension.id !== area.dimension) continue;
            const pos = player.location;
            const minX = Math.min(area.start[0], area.end[0]);
            const maxX = Math.max(area.start[0], area.end[0]);
            const minZ = Math.min(area.start[1], area.end[1]);
            const maxZ = Math.max(area.start[1], area.end[1]);
            const d = this.BORDER_WARNING_DISTANCE;
            if (pos.x < minX - d || pos.x > maxX + d || pos.z < minZ - d || pos.z > maxZ + d) continue;

            const cx = Math.max(minX, Math.min(maxX, pos.x));
            const cz = Math.max(minZ, Math.min(maxZ, pos.z));
            let bx = cx,
              bz = cz;
            if (cx === pos.x && cz === pos.z) {
              const dx = Math.min(pos.x - minX, maxX - pos.x);
              const dz = Math.min(pos.z - minZ, maxZ - pos.z);
              if (dx < dz) bx = pos.x - minX < maxX - pos.x ? minX : maxX;
              else bz = pos.z - minZ < maxZ - pos.z ? minZ : maxZ;
            }
            const y = Math.floor(pos.y);
            try {
              for (let dy = -1; dy <= 2; dy++) {
                player.dimension.spawnParticle("minecraft:colored_flame_particle", { x: bx, y: y + dy, z: bz });
              }
            } catch {}
            break;
          }
        }
      }, 20)
    );
  }
}
