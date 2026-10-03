/** 平台基础运行监控：不依赖可选 monitor 模块，随行为包宿主启动。 */
import { system, world } from "@minecraft/server";
import { HttpDB, SafeHttpMethod } from "./httpdb.js";
import { TickSampler } from "./tick-sampler.js";

export interface RuntimeMetrics {
  bootId: string;
  tps: number | null;
  onlineCount: number;
  entities: Record<string, number | null>;
  entitiesUpdatedAt: number | null;
  /** 按客户端视距累加的估算，不能视为真实已加载区块数。 */
  chunkEstimate: number | null;
}

type MonitoringState = { sampler: TickSampler; snapshot?: RuntimeMetrics; stop?: () => void };
// SDK 子路径独立打包，采样状态必须跨 install 与 runtime 门面共享。
const globals = globalThis as unknown as { __sfmcRuntimeMonitoringState?: MonitoringState };
const state = (globals.__sfmcRuntimeMonitoringState ??= { sampler: new TickSampler() });
const sampler = state.sampler;

/** 模块可直接读取平台快照，无需安装 monitor 或访问任意数据库。 */
export function getRuntimeMetrics(): RuntimeMetrics | undefined {
  return state.snapshot
    ? { ...state.snapshot, tps: sampler.current(), entities: { ...state.snapshot.entities } }
    : undefined;
}

export function getRuntimeTpsStatus() {
  const tps = sampler.current();
  const grade = tps === null ? "unknown" : tps >= 19.5 ? "green" : tps >= 15 ? "yellow" : tps >= 10 ? "gold" : "red";
  return { tps, grade, text: `§7[TPS] §f${tps?.toFixed(2) ?? "未知"} §7/ 20.00` };
}

export function stopRuntimeMonitoring(): void {
  state.stop?.();
}

/** 世界加载完成后启动；每 tick 采 TPS，每 5 秒报告，实体枚举每约 30 秒一次。 */
export function startRuntimeMonitoring(): () => void {
  if (state.stop) return state.stop;
  const bootId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  let busy = false;
  let disposed = false;
  let lastEntities = 0;
  let lastWarning = 0;
  const warn = () => {
    if (Date.now() - lastWarning > 60_000) {
      lastWarning = Date.now();
      console.warn("[SFMC] 运行指标上报失败，请检查数据服务连接与鉴权");
    }
  };
  const report = () => {
    if (busy || disposed) return;
    try {
      const players = world.getAllPlayers();
      let entities = state.snapshot?.entities ?? {};
      let entitiesUpdatedAt = state.snapshot?.entitiesUpdatedAt ?? null;
      if (Date.now() - lastEntities >= 30_000) {
        entities = {};
        for (const id of ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"]) {
          try {
            entities[id] = world.getDimension(id).getEntities().length;
          } catch {
            entities[id] = null;
          }
        }
        lastEntities = Date.now();
        entitiesUpdatedAt = lastEntities;
      }
      let chunkEstimate: number | null = 0;
      for (const player of players) {
        const distance = player.clientSystemInfo?.maxRenderDistance;
        if (typeof distance !== "number") {
          chunkEstimate = null;
          break;
        }
        chunkEstimate += (distance + 2) ** 2;
      }
      state.snapshot = {
        bootId,
        tps: sampler.current(),
        onlineCount: players.length,
        entities,
        entitiesUpdatedAt,
        chunkEstimate,
      };
      busy = true;
      void HttpDB.typedRequest(SafeHttpMethod.Post, "/api/sfmc/metrics/live", {
        ...state.snapshot,
        players: players.map((player) => player.name),
        day: world.getDay(),
        difficulty: String(world.getDifficulty()),
      })
        .then((result) => {
          if (!result.ok && !disposed) warn();
        })
        .catch(() => {
          if (!disposed) warn();
        })
        .finally(() => {
          busy = false;
        });
    } catch {
      /* 世界关闭期间不继续读取原生对象。 */
    }
  };
  const tick = system.runInterval(() => sampler.push(Date.now()), 1);
  const reportTick = system.runInterval(report, 100);
  report();
  state.stop = () => {
    disposed = true;
    system.clearRun(tick);
    system.clearRun(reportTick);
    sampler.reset();
    delete state.snapshot;
    delete state.stop;
  };
  return state.stop;
}
