/**
 * lifecycles/peace.ts — 区域和平
 *
 * 实体在开启 peace 的区域内且命中怪物过滤器时,生成即移除。
 * 过滤器读 configs/area.json 的 peace.filters。
 */

import { Entity, EntityInitializationCause, EntitySpawnAfterEvent, world } from "@minecraft/server";
import { config } from "@sfmc/sdk/sapi/config";
import type { ModuleLifecycle } from "@sfmc/sdk/module-loader";
import { isFeatureActive, pointInFeatureArea } from "../area-service.js";

interface PeaceFilter {
  family?: string;
  exclude_family?: string;
}

interface PeaceConfig {
  filters?: PeaceFilter[];
}

let _filters: PeaceFilter[] = [];
let _spawnCb: ((event: EntitySpawnAfterEvent) => void) | undefined = undefined;

/** 实体是否在开启 peace 的区域内 */
function inPeaceArea(entity: Entity): boolean {
  return (
    pointInFeatureArea("peace", entity.dimension.id, entity.location.x, entity.location.z) !== null
  );
}

/** 依据过滤器组装 EntityQueryOptions(families / excludeFamilies) */
function getPeaceEntityQO(): { families?: string[]; excludeFamilies?: string[] } {
  const qo: { families?: string[]; excludeFamilies?: string[] } = {};
  for (const f of _filters) {
    if (f.family) {
      if (!qo.families) qo.families = [];
      qo.families.push(f.family);
    }
    if (f.exclude_family) {
      if (!qo.excludeFamilies) qo.excludeFamilies = [];
      qo.excludeFamilies.push(f.exclude_family);
    }
  }
  return qo;
}

export const peaceLifecycle: ModuleLifecycle = {
  registerEvents() {
    if (_spawnCb) return;
    _spawnCb = world.afterEvents.entitySpawn.subscribe((event) => {
      if (!isFeatureActive("peace")) return;
      try {
        if (event.cause === EntityInitializationCause.Spawned) {
          const entity = event.entity;
          if (inPeaceArea(entity) && entity.matches(getPeaceEntityQO())) {
            entity.remove();
          }
        }
      } catch {
        /* 实体已失效等,忽略 */
      }
    });
  },

  async init() {
    const cfg = await config.get<PeaceConfig>("peace");
    _filters = Array.isArray(cfg?.filters) ? cfg!.filters : [];
    config.onChange((key, value) => {
      if (key === "peace" && value && typeof value === "object") {
        const filters = (value as PeaceConfig).filters;
        _filters = Array.isArray(filters) ? filters : [];
      }
    });
  },

  cleanup() {
    if (_spawnCb) {
      try {
        world.afterEvents.entitySpawn.unsubscribe(_spawnCb);
      } catch {
        /* ignore */
      }
      _spawnCb = undefined;
    }
  },
};
