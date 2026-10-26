/** 首页指标：服务端有界历史绘图，不补造采样；断采和重启分段展示。 */
import type { MetricsResult, ProcessResources, ResourceSample } from "@sfmc-bds/management";
import { useEffect, useState } from "react";
import { useDesktop } from "../app/desktop.js";
import { PALETTES, useAppearance } from "../app/theme.js";
import { fullTime } from "../lib/format.js";
import { cpuLines, entityLines, memoryLines, scalarLine } from "../lib/metric-series.js";
import { MetricChart, type MetricAxis } from "./MetricChart.js";
import { Segmented } from "./controls.js";
import { EmptyState, Surface } from "./ui.js";

/** 图表档位。1440 分钟就是一天，服务端按同样的毫秒窗口返回已落盘的采样。 */
export type MetricMinutes = "15" | "60" | "1440";

/** 对不同实例隔离轮询；失败后保留历史但不继续呈现实时数值。 */
export function useRuntimeMetrics() {
  const { model, request } = useDesktop();
  const supported = Boolean(model.handshake?.capabilities.includes("metrics"));
  const [minutes, setMinutes] = useState<MetricMinutes>("15");
  const [data, setData] = useState<MetricsResult>();
  const [localResources, setLocalResources] = useState<ResourceSample[]>([]);
  const [receivedAt, setReceivedAt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    setData(undefined);
    setLocalResources([]);
    setReceivedAt(0);
    setFailed(false);
    setMinutes("15");
  }, [request, supported, model.disconnected]);
  useEffect(() => {
    if (!supported || model.disconnected) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const spanMs = Number(minutes) * 60_000;
    const poll = async () => {
      try {
        const value = await request("metrics.read", { spanMs });
        if (!disposed) {
          setData(value);
          setReceivedAt(Date.now());
          setFailed(false);
          if (!Array.isArray(value.resourceHistory) && value.host && typeof value.resourcesUpdatedAt === "number") {
            const partsMb: Record<string, number> = {};
            const partsCpuPercent: Record<string, number> = {};
            for (const part of value.processes?.parts ?? []) {
              if (typeof part.memoryMb === "number") partsMb[part.key] = part.memoryMb;
              if (typeof part.cpuPercent === "number") partsCpuPercent[part.key] = part.cpuPercent;
            }
            const point: ResourceSample = {
              recordedAt: value.resourcesUpdatedAt,
              hostUsedMb: value.host.memory.usedMb,
              dbMb: value.processes?.db.memoryMb ?? null,
              bdsMb: value.processes?.bds?.memoryMb ?? null,
              ...(Object.keys(partsMb).length ? { partsMb } : {}),
              hostCpuPercent: value.host.cpu.usedPercent ?? null,
              dbCpuPercent: value.processes?.db.cpuPercent ?? null,
              bdsCpuPercent: value.processes?.bds?.cpuPercent ?? null,
              ...(Object.keys(partsCpuPercent).length ? { partsCpuPercent } : {}),
            };
            setLocalResources((current) => {
              const last = current.at(-1);
              if (last && point.recordedAt - last.recordedAt < 8_000) return current;
              const cutoff = point.recordedAt - spanMs;
              return [...current.filter((row) => row.recordedAt >= cutoff), point];
            });
          }
        }
      } catch {
        if (!disposed) setFailed(true);
      } finally {
        if (!disposed) timer = setTimeout(() => void poll(), 10_000);
      }
    };
    void poll();
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [request, supported, model.disconnected, minutes]);
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);
  const reachable = !model.disconnected && !failed && clock - receivedAt < 30_000;
  return {
    data,
    supported,
    reachable,
    fresh: reachable && Boolean(data?.fresh),
    loading: !receivedAt && !failed && !model.disconnected,
    resources: Array.isArray(data?.resourceHistory) ? data.resourceHistory : localResources,
    minutes,
    setMinutes,
  };
}

/**
 * TPS 低于该值时以警告色显示。
 * 使用场景：MetricsPanel 工具栏的实时 TPS、总览页顶部状态条的 TPS 格；两处共用同一判定。
 */
export const TPS_WARN_THRESHOLD = 19.5;

/**
 * 把 MB 数值格式化为 "1.3 GB" / "73 MB"，缺失时显示 "—"。
 * 使用场景：MetricsPanel 资源侧栏、总览页顶部状态条的主机内存格。
 */
export const formatMemoryMb = (value: number | null | undefined) =>
  value === null || value === undefined
    ? "—"
    : value >= 1024
      ? `${(value / 1024).toFixed(1)} GB`
      : `${Math.round(value)} MB`;

const memory = formatMemoryMb;

/**
 * 把 CPU 占用率格式化为 "12.3%"，缺失时显示 "—"。
 * 使用场景：MetricsPanel 的 CPU 读数与侧栏、总览页顶部状态条的 CPU 格。
 */
export const formatCpuPercent = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : `${value.toFixed(1)}%`;

/**
 * 进程行下方的说明：新数据服务给出占用率时显示 CPU 百分比；旧数据服务或尚无基线时沿用累计 CPU 秒数。
 * 使用场景：MetricsPanel 资源侧栏的每个进程行。
 */
function processDetail(process: ProcessResources | null): string {
  if (!process) return "资源未知";
  if (!process.running) return "已停止";
  if (typeof process.cpuPercent === "number") return `CPU ${formatCpuPercent(process.cpuPercent)}`;
  return `累计 CPU ${process.cpuSeconds === null ? "未知" : `${process.cpuSeconds.toFixed(1)} s`}`;
}

/** 已采到的进程 CPU 占用率之和。缺数的进程不补 0；一个都没有时返回 null。 */
function measuredCpuPercent(rows: Array<{ process: ProcessResources | null }>): number | null {
  let sum = 0;
  let any = false;
  for (const row of rows) {
    const value = row.process?.cpuPercent;
    if (typeof value !== "number") continue;
    sum += value;
    any = true;
  }
  return any ? Math.min(100, sum) : null;
}

/** 侧栏里的一行进程。BDS 和数据服务始终占位，其余只在正在运行时出现。 */
function memoryRows(processes: MetricsResult["processes"] | undefined, reachable: boolean): Array<{ key: string; label: string; process: ProcessResources | null }> {
  const rows: Array<{ key: string; label: string; process: ProcessResources | null }> = [
    { key: "bds", label: "BDS", process: reachable ? processes?.bds ?? null : null },
    { key: "db", label: "数据服务", process: reachable ? processes?.db ?? null : null },
  ];
  if (reachable) for (const part of processes?.parts ?? []) rows.push({ key: part.key, label: part.label, process: part });
  return rows;
}

/** 已采到的进程工作集之和。缺数的进程不补 0。 */
function measuredMemoryMb(rows: Array<{ process: ProcessResources | null }>): number | null {
  let sum = 0;
  let any = false;
  for (const row of rows) {
    const value = row.process?.memoryMb;
    if (typeof value !== "number") continue;
    sum += value;
    any = true;
  }
  return any ? sum : null;
}

type MetricView = "tps" | "onlineCount" | "cpu" | "memory" | "entities";

/** 各视图的图表名称与纵轴类型。新增视图只需在这里登记一行。 */
const VIEW_CHART: Record<MetricView, { label: string; y: MetricAxis }> = {
  tps: { label: "TPS", y: "tps" },
  onlineCount: { label: "在线人数", y: "count" },
  cpu: { label: "CPU", y: "percent" },
  memory: { label: "内存", y: "memory" },
  entities: { label: "实体", y: "count" },
};

export function MetricsPanel({
  metrics,
  className,
}: {
  metrics: ReturnType<typeof useRuntimeMetrics>;
  /** 页面网格定位用，总览里放在服务区下方并横跨整行 */
  className?: string;
}) {
  const [field, setField] = useState<MetricView>("tps");
  const { dark } = useAppearance();
  const { data, supported, reachable, fresh, loading, resources, minutes, setMinutes } = metrics;
  const sample = fresh ? data?.current : null;
  const host = reachable ? data?.host : null;
  const rows = memoryRows(data?.processes, reachable);
  const sfmcMb = measuredMemoryMb(rows);
  const sfmcCpu = measuredCpuPercent(rows);
  const hostCpu = host?.cpu.usedPercent ?? null;
  const windowMinutes = Number(minutes);
  const end = Math.max(data?.resourcesUpdatedAt ?? 0, data?.history.at(-1)?.recordedAt ?? 0, resources.at(-1)?.recordedAt ?? 0) || Date.now();
  const from = end - windowMinutes * 60_000;
  const lines = !data
    ? []
    : field === "memory"
      ? memoryLines(resources, from, end)
      : field === "cpu"
        ? cpuLines(resources, from, end)
        : field === "entities"
          ? entityLines(data.history, from, end)
          : scalarLine(data.history, field, field === "tps" ? "TPS" : "在线人数", (dark ? PALETTES.dark : PALETTES.light).progress, from, end);
  return (
    <Surface
      className={className}
      title="实例状态"
      extra={
        <Segmented
          size="sm"
          label="时间范围"
          value={minutes}
          onChange={setMinutes}
          options={[
            { value: "15", label: "15 分钟" },
            { value: "60", label: "1 小时" },
            { value: "1440", label: "一天" },
          ]}
        />
      }
    >
      <div className="metrics-layout">
        <div className="metrics-trend">
          <div className="metrics-toolbar">
            <Segmented
              size="sm"
              label="指标"
              value={field}
              onChange={setField}
              options={[
                { value: "tps", label: "TPS" },
                { value: "onlineCount", label: "在线人数" },
                { value: "cpu", label: "CPU" },
                { value: "memory", label: "内存" },
                { value: "entities", label: "实体" },
              ]}
            />
            <span className="muted">
              {field === "onlineCount" && sample ? (
                `在线 ${sample.onlineCount}`
              ) : field === "cpu" && host ? (
                sfmcCpu === null ? `主机 ${formatCpuPercent(hostCpu)}` : `主机 ${formatCpuPercent(hostCpu)} · SFMC ${formatCpuPercent(sfmcCpu)}`
              ) : field === "memory" && host ? (
                sfmcMb === null ? `主机 ${memory(host.memory.usedMb)}` : `主机 ${memory(host.memory.usedMb)} · SFMC ${memory(sfmcMb)}`
              ) : sample?.tps !== null && sample?.tps !== undefined ? (
                <span className={sample.tps < TPS_WARN_THRESHOLD ? "tone-text-warning" : ""}>TPS {sample.tps.toFixed(2)} / 20</span>
              ) : (
                ""
              )}
            </span>
          </div>
          {data?.history.length || resources.length ? (
            <MetricChart
              lines={lines}
              from={from}
              end={end}
              minutes={windowMinutes}
              label={VIEW_CHART[field].label}
              y={VIEW_CHART[field].y}
            />
          ) : (
            <EmptyState
              compact
              icon="activity"
              title={
                !supported ? "暂不支持运行指标" : loading ? "正在读取指标…" : (data?.note ?? "暂时无法读取指标")
              }
            />
          )}
          <div className="metrics-meta">
            {data?.updatedAt ? `更新于 ${fullTime(data.updatedAt)}` : ""}
            {!fresh && data?.updatedAt ? "" : ""}
          </div>
        </div>
        <div className="metrics-resources">
          <div className="resource-row">
            <span>主机内存</span>
            <b>
              {memory(host?.memory.usedMb)} / {memory(host?.memory.totalMb)}
            </b>
          </div>
          <div
            className="memory-meter"
            role="meter"
            aria-label="内存使用率"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={host?.memory.usedPercent}
          >
            <span style={{ width: `${host?.memory.usedPercent ?? 0}%` }} />
          </div>
          {host ? <div className="muted resource-note">整机已用，含系统和其他程序</div> : null}
          {/* 主机 CPU：放在内存说明之后，窄布局下与内存同列（见 pages.css .resource-cpu） */}
          <div className="resource-cpu">
            <div className="resource-row">
              <span>主机 CPU</span>
              <b>{formatCpuPercent(hostCpu)}</b>
            </div>
            <div className="memory-meter" role="meter" aria-label="CPU 使用率" aria-valuemin={0} aria-valuemax={100} aria-valuenow={hostCpu ?? undefined}>
              <span style={{ width: `${hostCpu ?? 0}%` }} />
            </div>
            {host ? (
              <div className="muted resource-note">
                {host.cpu.cores} 核{sfmcCpu !== null ? ` · SFMC 合计 ${formatCpuPercent(sfmcCpu)}` : ""}
              </div>
            ) : null}
          </div>
          {sfmcMb !== null ? (
            <div className="resource-process">
              <span>SFMC 合计</span>
              <b>{memory(sfmcMb)}</b>
              <span className="muted">下列进程的工作集相加</span>
            </div>
          ) : null}
          {rows.map((row) => (
            <div className="resource-process" key={row.key}>
              <span>{row.label}</span>
              <b>{memory(row.process?.memoryMb)}</b>
              <span className="muted">{processDetail(row.process)}</span>
            </div>
          ))}
          <div className="resource-entities">
            <span className="muted">实体</span>
            {[
              ["minecraft:overworld", "主世界"],
              ["minecraft:nether", "下界"],
              ["minecraft:the_end", "末地"],
            ].map(([key, label]) => (
              <div className="resource-row" key={key}>
                <span>{label}</span>
                <span className="num">{sample?.entities[key!] ?? "—"}</span>
              </div>
            ))}
          </div>
          <div className="resource-row muted">
            <span>视距区块估算</span>
            <span className="num">{sample?.chunkEstimate ?? "—"}</span>
          </div>
        </div>
      </div>
    </Surface>
  );
}
