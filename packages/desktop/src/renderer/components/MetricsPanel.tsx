/** 首页指标：服务端有界历史绘图，不补造采样；断采和重启分段展示。 */
import type { MetricsResult, ProcessResources, ResourceSample } from "@sfmc-bds/management";
import { useEffect, useState } from "react";
import { useDesktop } from "../app/desktop.js";
import { PALETTES, useAppearance } from "../app/theme.js";
import { fullTime } from "../lib/format.js";
import { entityLines, memoryLines, scalarLine } from "../lib/metric-series.js";
import { MetricChart } from "./MetricChart.js";
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
            for (const part of value.processes?.parts ?? []) {
              if (typeof part.memoryMb === "number") partsMb[part.key] = part.memoryMb;
            }
            const point: ResourceSample = {
              recordedAt: value.resourcesUpdatedAt,
              hostUsedMb: value.host.memory.usedMb,
              dbMb: value.processes?.db.memoryMb ?? null,
              bdsMb: value.processes?.bds?.memoryMb ?? null,
              ...(Object.keys(partsMb).length ? { partsMb } : {}),
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

type MetricView = "tps" | "onlineCount" | "memory" | "entities";

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
  const windowMinutes = Number(minutes);
  const end = Math.max(data?.resourcesUpdatedAt ?? 0, data?.history.at(-1)?.recordedAt ?? 0, resources.at(-1)?.recordedAt ?? 0) || Date.now();
  const from = end - windowMinutes * 60_000;
  const lines = !data
    ? []
    : field === "memory"
      ? memoryLines(resources, from, end)
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
                { value: "memory", label: "内存" },
                { value: "entities", label: "实体" },
              ]}
            />
            <span className="muted">
              {field === "onlineCount" && sample ? (
                `在线 ${sample.onlineCount}`
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
              label={field === "memory" ? "内存" : field === "entities" ? "实体" : field === "tps" ? "TPS" : "在线人数"}
              y={field === "memory" ? "memory" : field === "tps" ? "tps" : "count"}
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
              <span className="muted">
                {row.process
                  ? row.process.running
                    ? `累计 CPU ${row.process.cpuSeconds === null ? "未知" : `${row.process.cpuSeconds.toFixed(1)} s`}`
                    : "已停止"
                  : "资源未知"}
              </span>
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
