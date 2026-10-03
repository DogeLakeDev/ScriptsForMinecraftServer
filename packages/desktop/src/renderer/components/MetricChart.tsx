/** ECharts 时间序列：按真实采样分段，断采、未知值和重启之间不连线。 */
import type { MetricsResult, MetricsSample } from "@sfmc-bds/management";
import { LineChart, type LineSeriesOption } from "echarts/charts";
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
import { metricSegments } from "../lib/metric-segments.js";
import { EmptyState } from "./ui.js";

use([LineChart, GridComponent, TooltipComponent, SVGRenderer]);
type ChartOption = ComposeOption<LineSeriesOption | GridComponentOption | TooltipComponentOption>;
type MetricField = "tps" | "onlineCount";

function TrendPlot({
  groups,
  field,
  from,
  end,
  minutes,
}: {
  groups: MetricsSample[][];
  field: MetricField;
  from: number;
  end: number;
  minutes: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<EChartsType>(undefined);
  const { dark } = useAppearance();
  const label = field === "tps" ? "TPS" : "在线人数";
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
    const option: ChartOption = {
      animation: false,
      textStyle: { fontFamily: font, fontSize: 11, color: palette.text3 },
      grid: { left: 36, right: 12, top: 20, bottom: 28 },
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
          formatter: (time: number) =>
            new Date(time).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }),
        },
      },
      yAxis: {
        type: "value",
        min: 0,
        ...(field === "tps" ? { max: 20, interval: 5 } : { minInterval: 1, splitNumber: 4 }),
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
          const row = Array.isArray(params) ? params[0] : params;
          if (!row || !Array.isArray(row.value)) return "";
          const [time, value] = row.value;
          if (typeof time !== "number" || typeof value !== "number") return "";
          return `${fullTime(time)}\n${label}  ${field === "tps" ? value.toFixed(2) : value}`;
        },
      },
      series: groups.map((group, index) => ({
        id: `segment-${index}`,
        name: label,
        type: "line",
        connectNulls: false,
        smooth: false,
        showSymbol: group.length === 1,
        symbol: "circle",
        symbolSize: 5,
        lineStyle: { color: palette.progress, width: 1.8 },
        itemStyle: { color: palette.progress },
        emphasis: { disabled: true },
        data: group.map((sample) => [sample.recordedAt, sample[field]!]),
      })),
    };
    chart.current?.setOption(option, { notMerge: true });
  }, [dark, end, field, from, groups, label, minutes]);
  return (
    <div
      ref={container}
      className="metric-chart"
      role="img"
      aria-label={`${label}，最近 ${minutes} 分钟，${groups.flat().length} 个采样点`}
    />
  );
}

export function MetricChart({ data, field, minutes }: { data: MetricsResult; field: MetricField; minutes: number }) {
  const end = data.resourcesUpdatedAt ?? data.history.at(-1)?.recordedAt ?? Date.now();
  const from = end - minutes * 60_000;
  const groups = metricSegments(data.history, field, from, end);
  if (!groups.length)
    return (
      <EmptyState compact icon="activity" title="暂无采样" />
    );
  return <TrendPlot groups={groups} field={field} from={from} end={end} minutes={minutes} />;
}
