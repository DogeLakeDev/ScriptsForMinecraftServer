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
export interface ResourceSample {
  recordedAt: number;
  hostUsedMb: number | null;
  dbMb: number | null;
  bdsMb: number | null;
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
  processes: { db: ProcessResources; bds: ProcessResources | null } | null;
  resourcesUpdatedAt: number | null;
  /** 最近一小时的主机已用内存与托管进程内存。旧数据服务没有该字段。 */
  resourceHistory?: ResourceSample[];
  note?: string;
}
