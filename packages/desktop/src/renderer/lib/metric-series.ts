import type { MetricsSample, ResourceSample } from "@sfmc-bds/management";
import { CHART_COLORS } from "../app/theme.js";

export interface ChartLine {
  name: string;
  color: string;
  axis: 0 | 1;
  points: [number, number | null][];
}

const DIMENSIONS: [string, string, string][] = [
  ["minecraft:overworld", "主世界", CHART_COLORS[4]],
  ["minecraft:nether", "下界", CHART_COLORS[7]],
  ["minecraft:the_end", "末地", CHART_COLORS[3]],
];

export function trendPoints<T extends { recordedAt: number; bootId?: string }>(
  samples: T[],
  pick: (sample: T) => number | null | undefined,
  from: number,
  end: number,
  gapMs: number
): [number, number | null][] {
  const points: [number, number | null][] = [];
  let previous: T | undefined;
  for (const sample of samples) {
    if (sample.recordedAt < from || sample.recordedAt > end) continue;
    const value = pick(sample);
    const numeric = typeof value === "number" && Number.isFinite(value) ? value : null;
    const restarted = Boolean(previous?.bootId && sample.bootId && previous.bootId !== sample.bootId);
    if (previous && (restarted || sample.recordedAt - previous.recordedAt > gapMs)) points.push([sample.recordedAt - 1, null]);
    points.push([sample.recordedAt, numeric]);
    previous = sample;
  }
  return points;
}

function hasValue(points: [number, number | null][]) {
  return points.some((point) => typeof point[1] === "number");
}

export function scalarLine(samples: MetricsSample[], field: "tps" | "onlineCount", name: string, color: string, from: number, end: number): ChartLine[] {
  const points = trendPoints(samples, (sample) => sample[field], from, end, 20_000);
  return hasValue(points) ? [{ name, color, axis: 0, points }] : [];
}

export function memoryLines(samples: ResourceSample[], from: number, end: number): ChartLine[] {
  const series: [string, string, 0 | 1, (sample: ResourceSample) => number | null][] = [
    ["总占用", CHART_COLORS[2], 0, (sample) => sample.hostUsedMb],
    ["BDS", CHART_COLORS[6], 1, (sample) => sample.bdsMb],
    ["数据服务", CHART_COLORS[1], 1, (sample) => sample.dbMb],
  ];
  return series.flatMap(([name, color, axis, pick]) => {
    const points = trendPoints(samples, pick, from, end, 45_000);
    return hasValue(points) ? [{ name, color, axis, points }] : [];
  });
}

export function entityLines(samples: MetricsSample[], from: number, end: number): ChartLine[] {
  const extra = new Set<string>();
  for (const sample of samples) for (const key of Object.keys(sample.entities)) extra.add(key);
  const rows: [string, string, string][] = [
    ...DIMENSIONS,
    ...[...extra]
      .filter((key) => !DIMENSIONS.some((row) => row[0] === key))
      .sort()
      .map((key, index): [string, string, string] => [key, key.replace(/^minecraft:/, ""), CHART_COLORS[index % CHART_COLORS.length]]),
  ];
  return rows.flatMap(([key, name, color]) => {
    if (!samples.some((sample) => key in sample.entities)) return [];
    const points = trendPoints(samples, (sample) => sample.entities[key], from, end, 20_000);
    return hasValue(points) ? [{ name, color, axis: 0 as const, points }] : [];
  });
}
