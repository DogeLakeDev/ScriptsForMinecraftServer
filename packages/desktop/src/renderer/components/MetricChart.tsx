/** ECharts 时间序列：断采和未知值不连线。内存图左侧是主机已用，右侧是进程。 */
import type { LineSeriesOption } from "echarts/charts";
import { LineChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  type GridComponentOption,
  type TooltipComponentOption,
} from "echarts/components";
import { init, use, type ComposeOption, type EChartsType } from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import { useEffect, useRef } from "react";
import { PALETTES, useAppearance } from "../app/theme.js";
import { fullTime } from "../lib/format.js";
import type { ChartLine } from "../lib/metric-series.js";
import { EmptyState } from "./ui.js";

use([LineChart, GridComponent, TooltipComponent, SVGRenderer]);
type ChartOption = ComposeOption<LineSeriesOption | GridComponentOption | TooltipComponentOption>;

function axisMb(value: number) {
  if (value === 0) return "0";
  const gb = value / 1024;
  return `${gb >= 10 ? Math.round(gb) : gb.toFixed(1)}G`;
}

function formatValue(y: "tps" | "count" | "memory", value: number) {
  if (y === "tps") return value.toFixed(2);
  if (y === "memory") return value >= 1024 ? `${(value / 1024).toFixed(1)} GB` : `${Math.round(value)} MB`;
  return String(Math.round(value));
}

function TrendPlot({
  lines,
  from,
  end,
  minutes,
  label,
  y,
}: {
  lines: ChartLine[];
  from: number;
  end: number;
  minutes: number;
  label: string;
  y: "tps" | "count" | "memory";
}) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<EChartsType>(undefined);
  const { dark } = useAppearance();
  useEffect(() => {
    if (!container.current) return;
    const instance = init(container.current, undefined, { renderer: "svg" });
    chart.current = instance;
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      instance.dispose();
      chart.current = undefined;
    };
  }, []);
  useEffect(() => {
    const palette = dark ? PALETTES.dark : PALETTES.light;
    const font = getComputedStyle(document.documentElement).getPropertyValue("--font-sans").trim();
    const memory = y === "memory";
    const option: ChartOption = {
      animation: false,
      textStyle: { fontFamily: font, fontSize: 11, color: palette.text3 },
      grid: { left: 40, right: memory ? 40 : 12, top: 16, bottom: 28 },
      xAxis: {
        type: "time",
        min: from,
        max: end,
        splitNumber: minutes === 15 ? 4 : 6,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: {
          color: palette.text3,
          hideOverlap: true,
          formatter: (time: number) => {
            const date = new Date(time);
            const clock = date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
            if (minutes < 24 * 60) return clock;
            return `${date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })} ${clock}`;
          },
        },
      },
      yAxis: memory
        ? [0, 1].map((index) => ({
            type: "value" as const,
            min: 0,
            position: index === 0 ? ("left" as const) : ("right" as const),
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { color: palette.text3, formatter: axisMb },
            splitLine: { show: index === 0, lineStyle: { color: palette.line, width: 0.5 } },
          }))
        : {
            type: "value",
            min: 0,
            ...(y === "tps" ? { max: 20, interval: 5 } : { minInterval: 1, splitNumber: 4 }),
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { color: palette.text3 },
            splitLine: { lineStyle: { color: palette.line, width: 0.5 } },
          },
      tooltip: {
        trigger: "axis",
        renderMode: "richText",
        confine: true,
        backgroundColor: palette.block,
        borderColor: palette.line,
        borderWidth: 1,
        padding: [10, 12],
        textStyle: { color: palette.text, fontFamily: font, fontSize: 12 },
        axisPointer: { type: "line", snap: true, lineStyle: { color: palette.text4, type: "dashed" } },
        formatter: (params) => {
          const rows = (Array.isArray(params) ? params : [params]).flatMap((row) => {
            if (!row || !Array.isArray(row.value)) return [];
            const [time, value] = row.value;
            if (typeof time !== "number" || typeof value !== "number") return [];
            return [{ time, text: `${row.seriesName}  ${formatValue(y, value)}` }];
          });
          const first = rows[0];
          if (!first) return "";
          return [fullTime(first.time), ...rows.map((row) => row.text)].join("\n");
        },
      },
      series: lines.map((line) => ({
        id: line.name,
        name: line.name,
        type: "line" as const,
        yAxisIndex: memory ? line.axis : 0,
        connectNulls: false,
        smooth: false,
        showSymbol: line.points.filter((point) => typeof point[1] === "number").length < 2,
        symbol: "circle",
        symbolSize: 5,
        lineStyle: { color: line.color, width: 1.8 },
        itemStyle: { color: line.color },
        emphasis: { disabled: true },
        data: line.points,
      })),
    };
    chart.current?.setOption(option, { notMerge: true });
  }, [dark, end, from, label, lines, minutes, y]);
  return (
    <div
      ref={container}
      className="metric-chart"
      role="img"
      aria-label={`${label}，最近 ${minutes >= 24 * 60 ? "1 天" : `${minutes} 分钟`}`}
    />
  );
}

export function MetricChart({
  lines,
  from,
  end,
  minutes,
  label,
  y,
}: {
  lines: ChartLine[];
  from: number;
  end: number;
  minutes: number;
  label: string;
  y: "tps" | "count" | "memory";
}) {
  if (!lines.length) return <EmptyState compact icon="activity" title="暂无采样" />;
  return (
    <>
      {lines.length > 1 && (
        <div className="metric-legend">
          {lines.map((line) => (
            <span key={line.name}>
              <i style={{ background: line.color }} />
              {line.name}
            </span>
          ))}
        </div>
      )}
      <TrendPlot lines={lines} from={from} end={end} minutes={minutes} label={label} y={y} />
    </>
  );
}
