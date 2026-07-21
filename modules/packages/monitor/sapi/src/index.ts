/**
 * @sfmc/module-monitor — v2 入口
 *
 * ModuleRegistry.register + 周期上报:
 *   - TPS (from service tps.current)
 *   - 各维度实体数
 *   - 玩家区块估算
 * 写入 db.tx 到 monitor_metrics / monitor_player_chunks(自有表)。
 */

import { Player, system, world } from "@minecraft/server";
import { db } from "@sfmc/sdk/sapi/db";
import { service } from "@sfmc/sdk/sapi/service";
import { debug } from "@sfmc/sdk/sapi/runtime";
import { ModuleRegistry } from "@sfmc/sdk/module-loader";

const MODULE_ID = "feature-monitor";

const REPORT_INTERVAL_TICKS = 600;
const DIMENSIONS = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"];

let runId: number | undefined;

async function snapshotEntities(): Promise<Record<string, number>> {
  const entities: Record<string, number> = {};
  for (const dim of DIMENSIONS) {
    try {
      entities[dim] = world.getDimension(dim).getEntities().length;
    } catch {
      entities[dim] = 0;
    }
  }
  return entities;
}

function snapshotPlayerChunks(): Array<Record<string, unknown>> {
  return world.getAllPlayers().map((p: Player) => {
    const loc = p.location;
    const dim = p.dimension?.id || "minecraft:overworld";
    const info = p.clientSystemInfo;
    const rd = info?.maxRenderDistance ?? 8;
    const side = rd + 1;
    return {
      player_id: p.id,
      player_name: p.name,
      dimension: dim,
      pos_x: Math.round(loc.x),
      pos_z: Math.round(loc.z),
      render_distance: rd,
      chunk_estimate: (1 + side) * (1 + side),
      updated_at: Date.now(),
    };
  });
}

async function report(): Promise<void> {
  try {
    const tps = await service.get<number>("tps.current");
    const entities = await snapshotEntities();
    const recordedAt = Date.now();

    await db.tx(async (tx) => {
      for (const [dim, count] of Object.entries(entities)) {
        await tx.insert("monitor_metrics", {
          id: `${recordedAt}-${dim}`,
          recorded_at: recordedAt,
          tps,
          dimension: dim,
          entity_count: count,
        });
      }
    });

    const playerChunks = snapshotPlayerChunks();
    await db.tx(async (tx) => {
      for (const row of playerChunks) {
        await tx.insert("monitor_player_chunks", row);
      }
    });
  } catch (e) {
    debug.w("Monitor", `report failed: ${(e as Error).message}`);
  }
}

ModuleRegistry.register({
  id: MODULE_ID,
  afterWorldLoad: true,
  lifecycle: {
    registerPermissions() {
      // 纯上报,无对外命令
    },
    async init() {
      await db.defineTable(
        "monitor_metrics",
        {
          id: { type: "TEXT", primary: true },
          recorded_at: { type: "INTEGER", notNull: true, index: true },
          tps: { type: "REAL", notNull: true },
          dimension: { type: "TEXT", notNull: true },
          entity_count: { type: "INTEGER", default: 0 },
        }
      );
      await db.defineTable(
        "monitor_player_chunks",
        {
          id: { type: "INTEGER", primary: true },
          player_id: { type: "TEXT", notNull: true },
          player_name: { type: "TEXT", notNull: true },
          dimension: { type: "TEXT", notNull: true },
          pos_x: { type: "INTEGER", default: 0 },
          pos_z: { type: "INTEGER", default: 0 },
          render_distance: { type: "INTEGER", default: 0 },
          chunk_estimate: { type: "INTEGER", default: 0 },
          updated_at: { type: "INTEGER", notNull: true, index: true },
        }
      );

      runId = system.runInterval(() => void report(), REPORT_INTERVAL_TICKS);
      debug.i("Monitor", "init");
    },
    cleanup() {
      if (runId !== undefined) {
        try {
          system.clearRun(runId);
        } catch {
          /* ignore */
        }
      }
    },
  },
});