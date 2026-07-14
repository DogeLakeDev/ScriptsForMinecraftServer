/**
 * MonitorReporter.ts — 性能数据上报
 * 每 600 tick (30 秒) 向 db-server 汇报一次 TPS / 实体数 / 玩家区块估算
 */
import { world, system, Player, Entity } from "@minecraft/server";
import { HttpDB } from "../libs/HttpDB";
import { TPS } from "./TPS";

const REPORT_INTERVAL = 600; // 30 秒
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
      // 1. TPS + 实体数
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

      // 2. 玩家区块估算
      const players = world.getAllPlayers();
      const playerChunks = players.map((p: Player) => {
        const loc = p.location;
        const dim = p.dimension?.id || "minecraft:overworld";
        const rd = (p as any).clientSystemInfo?.maxRenderDistance || 8;
        const chunkX = Math.floor(loc.x / 16);
        const chunkZ = Math.floor(loc.z / 16);
        const side = rd + 1; // renderDistance * 2 + 1，减半 → 一侧长度
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
