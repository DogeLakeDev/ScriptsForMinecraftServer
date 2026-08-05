import { STRUCTURED_LOG_LEVEL_RANK, type StructuredLogEvent } from "../graph/logBuffer";
import type { SceneSummary } from "./metaForm";
import type { StimulusNodeData } from "./StimulusNode";

export type EventLogNodeProps = {
  data: StimulusNodeData;
  scene: SceneSummary | null;
  onSnapshot: (snapshot: StructuredLogEvent[]) => void;
};

function formatTime(t: number): string {
  const date = new Date(t);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(
    date.getSeconds()
  ).padStart(2, "0")}.${String(date.getMilliseconds()).padStart(3, "0")}`;
}

function summaryOf(event: StructuredLogEvent): string {
  const text = event.text.replace(/\s+/g, " ").trim();
  return text.length > 100 ? `${text.slice(0, 99)}…` : text;
}

export function matchesEventLogFilter(
  event: StructuredLogEvent,
  channel: string | undefined,
  data: StimulusNodeData
): boolean {
  const wantedChannel = data.eventlogFilterChannel?.trim();
  if (wantedChannel && channel !== wantedChannel) return false;
  const wantedSource = data.eventlogFilterSource?.trim().toLowerCase();
  if (wantedSource && !event.source.toLowerCase().includes(wantedSource)) return false;
  const minLevel = data.eventlogMinLevel;
  if (minLevel && STRUCTURED_LOG_LEVEL_RANK[event.level] < STRUCTURED_LOG_LEVEL_RANK[minLevel]) return false;
  return true;
}

export function EventLogNode({ data }: EventLogNodeProps) {
  const entries = [...(data.eventlogSnapshot ?? [])].sort((a, b) => b.t - a.t);
  return (
    <div className="eventlog-body">
      {entries.length === 0 ? (
        <div className="eventlog-empty">（暂无事件）</div>
      ) : (
        entries.map((event, index) => (
          <details className="eventlog-entry" key={`${event.t}-${event.source}-${index}`}>
            <summary>
              <span className="eventlog-time">{formatTime(event.t)}</span>
              <span className={`eventlog-level eventlog-level-${event.level}`}>{event.level}</span>
              <span className="eventlog-source">{event.source}</span>
              <span className="eventlog-summary">{summaryOf(event)}</span>
            </summary>
            <pre className="eventlog-payload">{event.text}</pre>
          </details>
        ))
      )}
    </div>
  );
}
