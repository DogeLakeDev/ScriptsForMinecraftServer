/** 平台运行指标。TPS 为墙钟采样速率，不能当作单 tick 执行耗时（MSPT）。 */
export interface MetricsSample {
  recordedAt: number;
  bootId: string;
  tps: number | null;
  onlineCount: number;
  entities: Record<string, number | null>;
  entitiesUpdatedAt: number | null;
  chunkEstimate: number | null;
}
export interface ProcessResources {
  pid: number;
  running: boolean;
  memoryMb: number | null;
  /** 累计 CPU 秒数；不是 CPU 百分比。 */
  cpuSeconds: number | null;
}
/**
 * 除 BDS 和数据服务之外、这个实例自己登记过的进程。
 * 使用场景：内存侧栏和曲线。key 与资源历史 partsMb 的键一致；没有对应进程时不出现。
 */
export interface TrackedProcess extends ProcessResources {
  /** daemon、qq、tunnel、llbot，或 sidecar:<模块 id> */
  key: string;
  /** 界面上的名称，例如「守护进程」「bluemap」 */
  label: string;
}
export interface ResourceSample {
  recordedAt: number;
  hostUsedMb: number | null;
  dbMb: number | null;
  bdsMb: number | null;
  /**
   * 其余已登记进程的内存（MB）。
   * 使用场景：守护进程、QQ 桥、隧道、LLBot、附属进程的曲线。旧采样没有该字段。
   * 键缺省表示当时没采到，不是 0。
   */
  partsMb?: Record<string, number>;
}
export interface MetricsResult {
  fresh: boolean;
  updatedAt: number | null;
  current: MetricsSample | null;
  history: MetricsSample[];
  host: {
    memory: { totalMb: number; usedMb: number; usedPercent: number };
    cpu: { cores: number; model: string };
  } | null;
  processes: { db: ProcessResources; bds: ProcessResources | null; parts?: TrackedProcess[] } | null;
  resourcesUpdatedAt: number | null;
  /** 请求窗口内已落盘的主机与进程内存。缺省一小时；旧数据服务没有该字段。 */
  resourceHistory?: ResourceSample[];
  note?: string;
}
