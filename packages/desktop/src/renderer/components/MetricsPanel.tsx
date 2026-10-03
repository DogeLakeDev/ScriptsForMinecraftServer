/** 首页指标：服务端有界历史绘图，不补造采样；断采和重启分段展示。 */
import type { MetricsResult } from "@sfmc-bds/management";
import { useEffect, useState } from "react";
import { useDesktop } from "../app/desktop.js";
import { fullTime } from "../lib/format.js";
import { MetricChart } from "./MetricChart.js";
import { Segmented } from "./controls.js";
import { EmptyState, Surface } from "./ui.js";

/** 对不同实例隔离轮询；失败后保留历史但不继续呈现实时数值。 */
export function useRuntimeMetrics() {
  const { model, request } = useDesktop();
  const supported = Boolean(model.handshake?.capabilities.includes("metrics"));
  const [data, setData] = useState<MetricsResult>();
  const [receivedAt, setReceivedAt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    setData(undefined);
    setReceivedAt(0);
    setFailed(false);
    if (!supported || model.disconnected) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const value = await request("metrics.read");
        if (!disposed) {
          setData(value);
          setReceivedAt(Date.now());
          setFailed(false);
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
  }, [request, supported, model.disconnected]);
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
  };
}

const memory = (value: number | null | undefined) =>
  value === null || value === undefined
    ? "—"
    : value >= 1024
      ? `${(value / 1024).toFixed(1)} GB`
      : `${Math.round(value)} MB`;

export function MetricsPanel({ metrics }: { metrics: ReturnType<typeof useRuntimeMetrics> }) {
  const [field, setField] = useState<"tps" | "onlineCount">("tps");
  const [minutes, setMinutes] = useState<"15" | "60">("15");
  const { data, supported, reachable, fresh, loading } = metrics;
  const sample = fresh ? data?.current : null;
  const host = reachable ? data?.host : null;
  return (
    <Surface
      title="运行指标"
      extra={
        <Segmented
          size="sm"
          label="时间范围"
          value={minutes}
          onChange={setMinutes}
          options={[
            { value: "15", label: "15 分钟" },
            { value: "60", label: "1 小时" },
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
              ]}
            />
            <span className="muted">
              {sample?.tps !== null && sample?.tps !== undefined ? (
                <span className={sample.tps < 19.5 ? "tone-text-warning" : ""}>TPS {sample.tps.toFixed(2)} / 20</span>
              ) : (
                ""
              )}
            </span>
          </div>
          {data?.history.length ? (
            <MetricChart data={data} field={field} minutes={Number(minutes)} />
          ) : (
            <EmptyState
              compact
              icon="activity"
              title={
                !supported ? "此平台暂不支持运行指标" : loading ? "正在读取指标…" : (data?.note ?? "暂时无法读取指标")
              }
            />
          )}
          <div className="metrics-meta">
            {data?.updatedAt ? `最后采样 ${fullTime(data.updatedAt)}` : ""}
            {!fresh && data?.updatedAt ? "（实时状态未知）" : ""}
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
            aria-label="主机内存使用率"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={host?.memory.usedPercent}
          >
            <span style={{ width: `${host?.memory.usedPercent ?? 0}%` }} />
          </div>
          {(["bds", "db"] as const).map((key) => {
            const process = reachable ? data?.processes?.[key] : null;
            return (
              <div className="resource-process" key={key}>
                <span>{key === "bds" ? "BDS" : "数据服务"}</span>
                <b>{memory(process?.memoryMb)}</b>
                <span className="muted">
                  {process
                    ? process.running
                      ? `累计 CPU ${process.cpuSeconds === null ? "未知" : `${process.cpuSeconds.toFixed(1)} 秒`}`
                      : "已停止"
                    : "资源未知"}
                </span>
              </div>
            );
          })}
          <div className="resource-entities">
            <span className="muted">维度实体</span>
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
