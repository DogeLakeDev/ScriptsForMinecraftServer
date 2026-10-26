/**
 * format.ts — 小程序通用的文案与格式化工具
 *
 * 使用场景：所有页面展示时间、任务/阶段名称、错误信息时统一从这里取值。
 * 任务/阶段文案、耗时、告警合并等纯规则直接转发桌面端 renderer/lib 的同一份源码（经 vendor 打包，DRY）；
 * 本文件只保留小程序特有的部分：日期格式不依赖 Intl / toLocaleString（部分安卓基础库实现不完整），全部手工拼接。
 */
export {
  TASK_STATUS,
  duration,
  groupAlerts,
  hashHue,
  hostLabel,
  isTaskDone,
  phaseLabel,
  plainMinecraft,
  taskElapsed,
  taskLabel,
} from "../vendor/desktop-lib";

/** 补零 */
export const pad = (value: number, length = 2) => String(value).padStart(length, "0");

/** 时:分 */
function hourMinute(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 把任意异常规整为面向用户的单行文案；兼容 wx 接口失败时的 { errMsg } */
export function errorText(error: unknown): string {
  if (error && typeof error === "object" && !(error instanceof Error) && "errMsg" in error) return String((error as { errMsg: unknown }).errMsg);
  const raw = error instanceof Error ? error.message : String(error);
  return raw.replace(/^(?:[A-Z]\w*)?Error:\s*/, "");
}

/** 相对时间（"刚刚" / "5 分钟前" / "昨天 14:20" / "9月28日 08:00"），规则与桌面端 relativeTime 相同 */
export function relativeTime(value: string | number | undefined | null, now = Date.now()): string {
  if (value === undefined || value === null || value === "") return "—";
  const time = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(time)) return "—";
  const seconds = Math.round((now - time) / 1000);
  if (seconds < 10) return "刚刚";
  if (seconds < 60) return `${seconds} 秒前`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  const date = new Date(time);
  const hours = Math.round(minutes / 60);
  if (hours < 12) return `${hours} 小时前`;
  const today = new Date(now);
  const yesterday = new Date(now - 86_400_000);
  if (date.toDateString() === today.toDateString()) return `今天 ${hourMinute(date)}`;
  if (date.toDateString() === yesterday.toDateString()) return `昨天 ${hourMinute(date)}`;
  return `${date.getMonth() + 1}月${date.getDate()}日 ${hourMinute(date)}`;
}

/** 完整本地时间 "2026-10-24 18:12:05" */
export function fullTime(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === "") return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${hourMinute(date)}:${pad(date.getSeconds())}`;
}

/** 日志时间：HH:mm:ss，跨日时带 MM-DD */
export function clock(iso: string, withDate: boolean): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--:--:--";
  const time = `${hourMinute(date)}:${pad(date.getSeconds())}`;
  return withDate ? `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${time}` : time;
}

/** 本地日期键 YYYY-MM-DD，用于日志按日查询与 picker 的 value */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** MB → "1.3 GB" / "73 MB"，缺失时 "—"（与桌面端 MetricsPanel 的 formatMemoryMb 规则相同；那份位于 React 组件文件内无法打包） */
export function formatMemoryMb(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value >= 1024 ? `${(value / 1024).toFixed(1)} GB` : `${Math.round(value)} MB`;
}

/**
 * CPU 占用率 → "12.3%"，缺失时 "—"。
 * 使用场景：总览状态条的 CPU 格与资源清单；与桌面端 MetricsPanel 的 formatCpuPercent 规则相同。
 */
export function formatCpuPercent(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : `${value.toFixed(1)}%`;
}
