/**
 * views.ts — 协议数据 → 页面展示数据的映射
 *
 * 使用场景：WXML 不能调用函数，页面在 setData 前把服务、任务、告警、阶段转换成纯展示字段。
 * 总览、任务、更新等页面共用这里的映射，保证同一概念在各页面文案和语气一致（DRY）。
 * 语义与桌面端 components/feeds.tsx（serviceMeta / serviceState / taskIcon）一致；那份在 React 组件文件中，无法直接打包复用。
 */
import { fullTime, groupAlerts, phaseLabel, relativeTime, taskElapsed, taskLabel, TASK_STATUS, duration } from "./format";
import type { LogEntryWire, OperationRecord, ServiceStatusRow, Tone } from "./types";

/** 服务名 → 图标（连字符语义名） */
const SERVICE_ICONS: Record<string, string> = {
  bds: "cube",
  db: "database",
  qq: "message",
  llbot: "bot",
  tunnel: "globe",
};

/** 服务行展示数据 */
export function serviceView(row: ServiceStatusRow, stale: boolean) {
  const external = row.ownership === "external";
  const tone: Tone = stale ? "neutral" : !row.running ? "neutral" : external ? "warning" : "success";
  const label = stale ? "状态未知" : !row.running ? "已停止" : external ? "外部进程" : "运行中";
  const owner = external ? "外部进程，无法安全停止" : row.ownership === "managed" ? "SFMC 托管" : "尚未启动";
  // 列表只放运行时长；PID 在点开服务的操作菜单标题里显示（overview.serviceMenu）。
  const detail = !stale && row.running ? row.uptime : owner;
  return {
    name: row.name,
    title: row.title,
    icon: SERVICE_ICONS[row.name] ?? "server",
    running: !stale && row.running,
    tone,
    label,
    detail,
  };
}

/** 任务状态 → 图标 */
function taskIcon(task: OperationRecord): string {
  if (task.status === "running") return "loader";
  if (task.status === "queued") return "clock";
  if (task.status === "succeeded") return "check";
  if (task.status === "interrupted") return "warning";
  return "x";
}

/** 任务当前阶段的文案 */
function phaseText(task: OperationRecord): string {
  const phase = task.phases[task.phases.length - 1];
  if (task.status === "running" || task.status === "queued") return phase ? phaseLabel(phase.name) : "等待执行";
  return phase ? phaseLabel(phase.name) : "无阶段记录";
}

/** 任务行展示数据（列表与动态流） */
export function taskView(task: OperationRecord, now: number) {
  const status = TASK_STATUS[task.status];
  return {
    id: task.id,
    label: taskLabel(task),
    icon: taskIcon(task),
    spin: task.status === "running",
    tone: status.tone,
    statusLabel: status.label,
    phase: phaseText(task),
    elapsed: duration(taskElapsed(task, now)),
    time: relativeTime(task.updatedAt, now),
  };
}

/** 阶段状态 → 图标与语气 */
const PHASE_STATE: Record<string, { icon: string; tone: Tone; label: string }> = {
  pending: { icon: "clock", tone: "neutral", label: "等待" },
  running: { icon: "loader", tone: "info", label: "进行中" },
  done: { icon: "check", tone: "success", label: "完成" },
  failed: { icon: "x", tone: "danger", label: "失败" },
  skipped: { icon: "arrow-right", tone: "neutral", label: "跳过" },
};

/** 任务展开详情（阶段时间线、错误、结果） */
export function taskDetailView(task: OperationRecord) {
  return {
    kind: task.kind,
    createdAt: fullTime(task.createdAt),
    updatedAt: fullTime(task.updatedAt),
    phases: task.phases.map((phase, index) => {
      const state = PHASE_STATE[phase.status] ?? PHASE_STATE.pending!;
      const spent = phase.startedAt && phase.finishedAt ? duration(Date.parse(phase.finishedAt) - Date.parse(phase.startedAt)) : "";
      return {
        key: `${index}-${phase.name}`,
        name: phaseLabel(phase.name),
        message: phase.message ?? "",
        icon: state.icon,
        tone: state.tone,
        spin: phase.status === "running",
        label: state.label,
        spent,
      };
    }),
    errorCode: task.error?.code ?? "",
    errorMessage: task.error?.message ?? "",
    errorDetails: task.error?.details !== undefined ? JSON.stringify(task.error.details, null, 2) : "",
    result: task.result !== undefined ? JSON.stringify(task.result, null, 2) : "",
  };
}

/** 告警动态（同来源、级别、正文合并计数，规则来自桌面端 groupAlerts） */
export function alertViews(logs: LogEntryWire[], limit: number, now: number) {
  return groupAlerts(logs, limit).map(({ log, count, firstTime }, index) => ({
    key: `${log.time}-${index}`,
    error: log.level === "error",
    text: log.text.split("\n")[0],
    source: log.source,
    time: relativeTime(log.time, now),
    count,
    first: fullTime(firstTime),
    // 跳转控制台定位时使用
    at: log.time,
  }));
}
