/**
 * MonitorReporter.ts — 性能数据上报
 * 每 600 tick (30 秒) 向 db-server 汇报一次 TPS / 实体数 / 玩家区块估算
 */
import { Player, system, world } from "@minecraft/server";
import { TPS } from "@sfmc/module-tps";
import { HttpDB } from "@sfmc/sdk/sapi/runtime";

const REPORT_INTERVAL = 600;
const DIMENSIONS = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"];

export class MonitorReporter {
  private static runId: number | undefined;

  static init() {
    if (this.runId !== undefined) return;
    this.runId = system.runInterval(() => {
      this.report();
    }, REPORT_INTERVAL);
  }

  static stop() {
    if (this.runId !== undefined) {
      try {
        system.clearRun(this.runId);
      } catch {}
      this.runId = undefined;
    }
  }

  private static async report() {
    try {
      const tps = TPS.getTPS();
      const entities: Record<string, number> = {};
      for (const dim of DIMENSIONS) {
        try {
          entities[dim] = world.getDimension(dim).getEntities().length;
        } catch (e) {
          entities[dim] = 0;
        }
      }
      await HttpDB.post("/api/sfmc/monitor/metrics", { tps, entities });

      const players = world.getAllPlayers();
      const playerChunks = players.map((p: Player) => {
        const loc = p.location;
        const dim = p.dimension?.id || "minecraft:overworld";
        const rd = (p as any).clientSystemInfo?.maxRenderDistance || 8;
        const side = rd + 1;
        const estimate = (1 + side) * (1 + side);
        return {
          id: p.id,
          name: p.name,
          dimension: dim,
          pos: { x: Math.round(loc.x), z: Math.round(loc.z) },
          renderDistance: rd,
          chunkEstimate: estimate,
        };
      });

      await HttpDB.post("/api/sfmc/monitor/player-chunks", { players: playerChunks });
    } catch (e) {
      // 静默失败 — db-server 可能未运行
    }
  }
}
