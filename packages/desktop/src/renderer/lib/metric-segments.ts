import type { MetricsSample } from "@sfmc-bds/management";
export function metricSegments(
  samples: MetricsSample[],
  field: "tps" | "onlineCount",
  from: number,
  end: number
): MetricsSample[][] {
  const groups: MetricsSample[][] = [];
  let group: MetricsSample[] = [];
  for (const sample of samples) {
    const value = sample[field];
    if (sample.recordedAt < from || sample.recordedAt > end) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      group = [];
      continue;
    }
    const previous = group.at(-1);
    if (!previous || sample.bootId !== previous.bootId || sample.recordedAt - previous.recordedAt > 20_000) {
      group = [];
      groups.push(group);
    }
    group.push(sample);
  }
  return groups;
}
