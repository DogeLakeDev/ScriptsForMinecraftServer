/* ---------------------------------------- *\
 *  Name        :  区域和平                   *
 *  Description :  区域和平                   *
 *  Version     :  1.0.0                    *
 *  Author      :  ENIAC_Jushi              *
\* ---------------------------------------- */

import { world, Entity, EntityInitializationCause } from "@minecraft/server";
import { Config } from "../data/Config";
import * as Tool from "../libs/Tools"
import { Command } from "../libs/Command";
import { Permission } from "../libs/Permission";

export class Peace {
  static _instance: Peace;
  /**
   * @returns {Peace}
   */
  static getInstance() {
    if (!Peace._instance) {
      Peace._instance = new Peace();
    }
    return Peace._instance;
  }

  enable = true;
  init() {
    this.registerEvents();
    this.registerCommands();
  }

  registerEvents() {
    world.afterEvents.entitySpawn.subscribe(event => {
      if (!this.enable) return;
      try {
        if (event.cause === EntityInitializationCause.Spawned) {
          let entity = event.entity;
          if (this.inPeaceArea(entity)
            && entity.matches(Config.peaceAreaEntityQO)
          ) {
            event.entity.remove();
          }
        }
      }
      catch { }
    });
  }

  /**
   * 实体是否在和平区域内
   */
  inPeaceArea(entity: Entity) {
    for (let area of Config.peaceArea) {
      if (entity.dimension.id === area.dimension) {
        if (Tool.pointInArea_2D(entity.location.x, entity.location.z, area.start[0], area.start[1], area.end[0], area.end[1])) {
          return true;
        }
      }
    }
    return false;
  }

  switchPeace() {
    return this.enable = !this.enable;
  }

  registerCommands() {
    Permission.register('peace.toggle', Permission.OP);
    Command.register("peace", 'peace.toggle', () => {
      return Peace.getInstance().switchPeace() ? "开启区域和平" : "关闭区域和平";
    }, "切换区域和平")
  }
}
