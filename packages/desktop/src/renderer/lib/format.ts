/**
 * format.ts — 渲染层通用的文案与格式化工具
 *
 * 使用场景：所有页面展示时间、任务/阶段名称、错误信息时统一从这里取值，
 * 保证同一概念在界面各处只有一个权威文案来源（DRY）。
 */
import type { OperationRecord, OperationStatus } from "@sfmc-bds/management";

/** 视觉语气：与 CSS 中的 --tone-* 变量一一对应，用于徽章、状态点、提示条配色 */
export type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

/**
 * 把任意异常规整为面向用户的单行文案。
 * Electron 跨进程抛出的错误会带上 "Error invoking remote method 'sfmc:xxx': Error: " 前缀，这里统一剥离。
 */
/**
 * 去掉 Minecraft 格式化代码（§ 加一个字符）。
 * 使用场景：世界包清单里的名称常带颜色码，直接显示会在界面上留下乱码符号。
 */
export function plainMinecraft(text: string): string {
  return text.replace(/§./gu, "");
}

export function errorText(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.replace(/^Error invoking remote method '[^']+':\s*/, "").replace(/^(?:[A-Z]\w*)?Error:\s*/, "");
}

/** 相对时间（"刚刚" / "5 分钟前" / "昨天 14:20" / "9月28日 08:00"），用于任务、备份、同步时间展示 */
export function relativeTime(value: string | number | undefined, now = Date.now()): string {
  if (value === undefined || value === "") return "—";
  const time = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(time)) return "—";
  const seconds = Math.round((now - time) / 1000);
  if (seconds < 10) return "刚刚";
  if (seconds < 60) return `${seconds} 秒前`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  const date = new Date(time);
  const hm = date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  const hours = Math.round(minutes / 60);
  if (hours < 12) return `${hours} 小时前`;
  const today = new Date(now);
  const yesterday = new Date(now - 86_400_000);
  if (date.toDateString() === today.toDateString()) return `今天 ${hm}`;
  if (date.toDateString() === yesterday.toDateString()) return `昨天 ${hm}`;
  return `${date.getMonth() + 1}月${date.getDate()}日 ${hm}`;
}

/** 完整本地时间，用于悬浮提示中给出精确时间 */
export function fullTime(value: string | number | undefined): string {
  if (value === undefined || value === "") return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("zh-CN", { hour12: false });
}

/** 时长文案（毫秒 → "820 毫秒" / "4.5 秒" / "3 分 20 秒" / "2 小时 5 分"），用于任务耗时与守护进程运行时长 */
export function duration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${Math.round(ms)} 毫秒`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} 秒`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分 ${Math.round(seconds % 60)} 秒`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} 小时 ${minutes % 60} 分`;
  return `${Math.floor(hours / 24)} 天 ${hours % 24} 小时`;
}

/** 后台任务种类 → 中文名称；守护进程的 title 目前等于 kind，界面以此表补全可读名称 */
const TASK_LABELS: Record<string, string> = {
  "services.start": "启动服务",
  "services.stop": "停止服务",
  "services.restart": "重启服务",
  "modules.install": "安装模块",
  "modules.uninstall": "卸载模块",
  "modules.toggle": "切换模块状态",
  "config.apply": "保存并应用配置",
  "packs.import": "导入世界包",
  "packs.toggle": "切换世界包状态",
  "players.apply": "保存玩家权限",
  "updates.run": "执行更新",
  "attachment.apply": "接入部署",
  "deployment.create": "初始化部署",
  "backups.restore": "恢复备份",
};
/** 任务的展示名称：优先使用可读映射，未知种类回退到服务端 title */
export function taskLabel(task: Pick<OperationRecord, "kind" | "title">): string {
  return TASK_LABELS[task.kind] ?? (task.title && task.title !== task.kind ? task.title : task.kind);
}

/** 任务阶段标识 → 中文名称（与 CLI 维护执行器的阶段命名对齐） */
const PHASE_LABELS: Record<string, string> = {
  preflight: "预检",
  prepare: "准备",
  download: "下载",
  "stop-services": "停止服务",
  backup: "创建备份",
  execute: "执行",
  apply: "应用配置",
  verify: "验证",
  restore: "恢复运行",
  start: "启动服务",
  "restore-data": "恢复数据",
  "rollback-program": "回退程序",
};
export function phaseLabel(name: string): string {
  return PHASE_LABELS[name] ?? name;
}

/** 任务状态的文案与语气，供徽章与图标统一使用 */
export const TASK_STATUS: Record<OperationStatus, { label: string; tone: Tone }> = {
  queued: { label: "排队中", tone: "neutral" },
  running: { label: "进行中", tone: "info" },
  succeeded: { label: "已完成", tone: "success" },
  failed: { label: "失败", tone: "danger" },
  interrupted: { label: "已中断", tone: "warning" },
};
/** 任务是否已进入终态 */
export const isTaskDone = (status: OperationStatus) => status === "succeeded" || status === "failed" || status === "interrupted";

/** 任务耗时（终态用 updatedAt，进行中用当前时间） */
export function taskElapsed(task: OperationRecord, now = Date.now()): number {
  const start = Date.parse(task.createdAt);
  const end = isTaskDone(task.status) ? Date.parse(task.updatedAt) : now;
  return end - start;
}

/** 根据字符串稳定地生成色相（0-359），用于日志来源、玩家头像等需要"同名同色"的场景 */
export function hashHue(text: string): number {
  let hash = 0;
  for (let index = 0; index < text.length; index++) hash = (hash * 31 + text.charCodeAt(index)) | 0;
  return Math.abs(hash) % 360;
}

/** 宿主系统的友好名称 */
export function hostLabel(os: string | undefined, arch?: string): string {
  const name = os === "windows" ? "Windows" : os === "linux" ? "Linux" : os ?? "未知系统";
  return arch ? `${name} ${arch}` : name;
}
