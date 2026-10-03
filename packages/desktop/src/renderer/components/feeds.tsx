/**
 * feeds.tsx — 动态信息流：任务动态、服务状态、告警日志
 *
 * 使用场景：右侧"动态"栏、服务总览页区块、标题栏告警弹层复用同一组组件（DRY），
 * 版式对应 SnowUI 右侧栏的 Notifications / Activities / Contacts 条目（24px 图标色块 + 14px 正文 + 12px 元信息）。
 * 组件只接收数据与回调，不读取全局状态（迪米特法则），由调用方决定数据来源与跳转行为。
 */
import type { LogEntryWire, OperationRecord, ServiceStatusRow } from "@sfmc-bds/management";
import { groupAlerts } from "../lib/alerts.js";
import { cx } from "../lib/cx.js";
import { fullTime, phaseLabel, relativeTime, taskLabel, TASK_STATUS, type Tone } from "../lib/format.js";
import type { IconName } from "./icons.js";
import { EmptyState, IconTile, StatusDot } from "./ui.js";

/** 服务名 → 图标与一句话说明（总览页服务列表、右侧栏服务状态共用） */
const SERVICE_META: Record<string, { icon: IconName; text: string }> = {
  bds: { icon: "cube", text: "基岩版服务端" },
  db: { icon: "database", text: "数据库与 HTTP 接口" },
  qq: { icon: "message", text: "QQ 群消息互通桥" },
  llbot: { icon: "bot", text: "QQ 机器人后端" },
  tunnel: { icon: "globe", text: "内网穿透隧道" },
};
/** 读取服务的展示信息，未知服务回退为通用图标 */
export function serviceMeta(name: string): { icon: IconName; text: string } {
  return SERVICE_META[name] ?? { icon: "server", text: "受管服务" };
}

/** 服务的状态语义（运行中 / 外部进程 / 已停止） */
export function serviceState(row: ServiceStatusRow): { tone: Tone; label: string } {
  if (!row.running) return { tone: "neutral", label: "已停止" };
  if (row.ownership === "external") return { tone: "warning", label: "外部进程" };
  return { tone: "success", label: "运行中" };
}

/** 告警列表：错误用红色色块、警告用琥珀色块，正文取日志首行 */
export function AlertFeed({ logs, now, limit = 6, onSelect, emptyText = "已加载日志中没有警告或错误" }: { logs: LogEntryWire[]; now: number; limit?: number; onSelect?: () => void; emptyText?: string }) {
  const alerts = groupAlerts(logs, limit);
  if (!alerts.length) return <EmptyState compact icon="bell" title="暂无告警" description={emptyText} />;
  return (
    <ul className="feed">
      {alerts.map(({ log, count, firstTime }, index) => (
        <li key={`${log.time}-${index}`}>
          <button type="button" className="feed-item" onClick={onSelect} disabled={!onSelect}>
            <IconTile icon={log.level === "error" ? "bug" : "warning"} tone={log.level === "error" ? "danger" : "warning"} />
            <span className="feed-text">
              <span className="feed-title truncate" title={log.text}>{log.text.split("\n")[0]}</span>
              <span className="feed-meta"><span className="mono">{log.source}</span> {relativeTime(log.time, now)}</span>
            </span>
            {count > 1 && <span className="alert-count" title={`出现 ${count} 次；首次 ${fullTime(firstTime)}，最近 ${fullTime(log.time)}`}>×{count}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** 任务状态 → 图标 */
function taskIcon(task: OperationRecord): IconName {
  if (task.status === "running") return "loader";
  if (task.status === "queued") return "clock";
  if (task.status === "succeeded") return "check";
  if (task.status === "interrupted") return "warning";
  return "x";
}

/** 任务动态时间线：图标色块之间以 1px 竖线相连（SnowUI Activities 样式） */
export function TaskFeed({ tasks, now, limit = 6, onSelect }: { tasks: OperationRecord[]; now: number; limit?: number; onSelect?: (task: OperationRecord) => void }) {
  if (!tasks.length) return <EmptyState compact icon="history" title="暂无任务" />;
  return (
    <ul className="feed feed-timeline">
      {tasks.slice(0, limit).map((task) => {
        const status = TASK_STATUS[task.status];
        const phase = task.phases.at(-1);
        return (
          <li key={task.id}>
            <button type="button" className="feed-item" onClick={() => onSelect?.(task)} disabled={!onSelect}>
              <IconTile icon={taskIcon(task)} tone={status.tone} spin={task.status === "running"} />
              <span className="feed-text">
                <span className="feed-title truncate">{taskLabel(task)}</span>
                <span className="feed-meta">
                  <span className={cx(`tone-text-${status.tone}`)}>{task.status === "running" && phase ? phaseLabel(phase.name) : status.label}</span> {relativeTime(task.updatedAt, now)}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** 服务状态列表（SnowUI Contacts 样式：色块图标 + 名称 + 右侧状态） */
export function ServiceFeed({ services, onSelect, stale = false }: { services: ServiceStatusRow[]; onSelect?: (row: ServiceStatusRow) => void; stale?: boolean }) {
  if (!services.length) return <EmptyState compact icon="server" title="暂无服务信息" />;
  return (
    <ul className="feed">
      {services.map((row) => {
        const state = stale ? { tone: "neutral" as const, label: "状态未知" } : serviceState(row);
        return (
          <li key={row.name}>
            <button type="button" className="feed-item" onClick={() => onSelect?.(row)} disabled={!onSelect}>
              <IconTile icon={serviceMeta(row.name).icon} />
              <span className="feed-text feed-text-row">
                <span className="feed-title truncate">{row.title}</span>
                <span className={cx("feed-state", `tone-text-${state.tone}`)}><StatusDot tone={state.tone} />{state.label}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
