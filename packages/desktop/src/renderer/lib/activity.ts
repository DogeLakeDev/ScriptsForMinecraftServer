/**
 * activity.ts — 行为日志的文案、摘要、时间范围与 CSV 导出
 *
 * 使用场景：桌面端「行为日志」页与「玩家与权限」页的跳转；
 * 小程序管理端与玩家端「我的行为记录」通过 vendor/desktop-lib.js 共用同一份文案（DRY）。
 * 只依赖协议类型与 format.ts，不依赖 React / DOM，可被小程序打包。
 * 事件类型与 sfmc-module-activity-log 写入的 event_type 对应；未登记的类型原样显示。
 */
import type { ActivityLevel, ActivityRecord } from "@sfmc-bds/management";
import type { Tone } from "./format.js";

/** 事件分类：按 event_type 的前缀划分，供分类筛选 */
export interface ActivityCategory {
  /** event_type 前缀，如 "block." */
  prefix: string;
  label: string;
}

/** 行为日志模块的事件分类（展示顺序） */
export const ACTIVITY_CATEGORIES: readonly ActivityCategory[] = [
  { prefix: "player.", label: "玩家" },
  { prefix: "block.", label: "方块" },
  { prefix: "entity.", label: "实体" },
  { prefix: "item.", label: "物品" },
  { prefix: "container.", label: "容器" },
  { prefix: "world.", label: "世界" },
];

/** 已知事件类型 → 中文名称（与模块 subscribeNative 中的事件一一对应） */
const EVENT_LABELS: Record<string, string> = {
  "player.join": "加入服务器",
  "player.spawn": "重生",
  "player.leave": "离开服务器",
  "player.dimension": "切换维度",
  "player.gamemode": "切换游戏模式",
  "player.chat": "聊天",
  "block.break": "破坏方块",
  "block.place": "放置方块",
  "entity.kill": "击杀",
  "entity.death": "死亡",
  "entity.hit": "攻击",
  "entity.hurt": "受到伤害",
  "entity.interact": "与实体交互",
  "entity.tame": "驯服",
  "item.drop": "丢弃物品",
  "item.pickup": "拾取物品",
  "container.open": "打开容器",
  "container.close": "关闭容器",
  "world.explosion": "爆炸",
};

/** 已知事件类型（按分类顺序），供事件类型下拉 */
export const ACTIVITY_EVENT_TYPES: readonly string[] = Object.keys(EVENT_LABELS);

/** 事件类型的中文名称；未登记的类型（其它模块经 activity.record 写入）原样返回 */
export function activityLabel(eventType: string): string {
  return EVENT_LABELS[eventType] ?? eventType;
}

/** 事件所属分类；不属于已知分类时返回 undefined */
export function activityCategory(eventType: string): ActivityCategory | undefined {
  return ACTIVITY_CATEGORIES.find((category) => eventType.startsWith(category.prefix));
}

/** 行为记录用到的语义图标名（桌面端 IconName 与小程序 .i-* 遮罩类共有的子集） */
export type ActivityIcon = "message" | "user" | "cube" | "zap" | "package" | "archive" | "globe" | "activity";

/** 分类前缀 → 图标；聊天单独用消息图标 */
const CATEGORY_ICONS: Record<string, ActivityIcon> = {
  "player.": "user",
  "block.": "cube",
  "entity.": "zap",
  "item.": "package",
  "container.": "archive",
  "world.": "globe",
};

/** 事件的图标；未知分类用通用的 activity 图标 */
export function activityIcon(eventType: string): ActivityIcon {
  if (eventType === "player.chat") return "message";
  const category = activityCategory(eventType);
  return (category && CATEGORY_ICONS[category.prefix]) || "activity";
}

/** 记录级别的文案与语气 */
export const ACTIVITY_LEVELS: Record<ActivityLevel, { label: string; tone: Tone }> = {
  info: { label: "信息", tone: "neutral" },
  warn: { label: "警告", tone: "warning" },
  error: { label: "错误", tone: "danger" },
};

/** 原版维度 ID → 中文名称 */
const DIMENSION_LABELS: Record<string, string> = {
  "minecraft:overworld": "主世界",
  "minecraft:nether": "下界",
  "minecraft:the_end": "末地",
};

/** 去掉 minecraft: 命名空间前缀，其它命名空间保留，便于区分附加包内容 */
export function shortId(id: string): string {
  return id.startsWith("minecraft:") ? id.slice("minecraft:".length) : id;
}

/** 维度的中文名称；未知维度显示去掉前缀的 ID */
export function dimensionLabel(id: unknown): string {
  const text = typeof id === "string" ? id : "";
  return DIMENSION_LABELS[text] ?? shortId(text);
}

/** 执行者的展示名：优先玩家名，其次 ID */
export function activityActor(record: Pick<ActivityRecord, "actorName" | "actorId">): string {
  return record.actorName || record.actorId || "—";
}

/** 坐标文案，如 "主世界 12, 64, -5"；没有坐标时只返回维度，都没有时为空串 */
export function activityPosition(record: Pick<ActivityRecord, "dimension" | "x" | "y" | "z">): string {
  const dimension = record.dimension ? dimensionLabel(record.dimension) : "";
  const hasCoordinates = record.x !== null && record.y !== null && record.z !== null;
  const coordinates = hasCoordinates ? `${record.x}, ${record.y}, ${record.z}` : "";
  return [dimension, coordinates].filter(Boolean).join(" ");
}

/** 物品 ID 列表文案（去前缀、相同物品合并计数） */
function itemList(value: unknown): string {
  if (!Array.isArray(value)) return "";
  const counts = new Map<string, number>();
  for (const item of value) {
    if (typeof item !== "string" || !item) continue;
    const name = shortId(item);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts].map(([name, count]) => (count > 1 ? `${name}×${count}` : name)).join("、");
}

/**
 * 一条记录的补充说明（事件名称之外的关键信息）：聊天内容、维度变化、物品、伤害、目标等。
 * 使用场景：列表行副标题、小程序卡片、CSV 的「详情」列。
 */
export function activityDetail(record: ActivityRecord): string {
  const payload = record.payload ?? {};
  switch (record.eventType) {
    case "player.chat":
      return typeof payload.message === "string" ? payload.message : "";
    case "player.dimension":
      return `${dimensionLabel(payload.from)} → ${dimensionLabel(payload.to)}`;
    case "player.gamemode":
      return `${String(payload.from ?? "?")} → ${String(payload.to ?? "?")}`;
    case "item.drop":
    case "item.pickup":
      return itemList(payload.items);
    case "entity.hurt": {
      const damage = Number(payload.damage);
      const parts = [Number.isFinite(damage) ? `${Math.round(damage * 10) / 10} 点伤害` : "", record.targetId ? shortId(record.targetId) : "", typeof payload.cause === "string" ? payload.cause : ""];
      return parts.filter(Boolean).join(" · ");
    }
    case "world.explosion": {
      const blocks = Number(payload.impactedBlocks);
      return Number.isFinite(blocks) ? `波及 ${blocks} 个方块` : "";
    }
    default:
      return record.targetId ? shortId(record.targetId) : "";
  }
}

/** 本地时间 "YYYY-MM-DD HH:mm:ss"；两端展示与 CSV 共用，不受各自 locale 实现差异影响 */
export function activityTime(ms: number): string {
  const date = new Date(ms);
  if (!Number.isFinite(ms) || Number.isNaN(date.getTime())) return "—";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** 快捷时间范围 */
export type ActivityRangePreset = "today" | "24h" | "7d" | "30d" | "all";

/** 快捷时间范围的文案（展示顺序） */
export const ACTIVITY_RANGE_PRESETS: readonly { value: ActivityRangePreset; label: string }[] = [
  { value: "today", label: "今天" },
  { value: "24h", label: "近 24 小时" },
  { value: "7d", label: "近 7 天" },
  { value: "30d", label: "近 30 天" },
  { value: "all", label: "全部" },
];

/**
 * 快捷时间范围 → activity.query 的 from / to（毫秒，含）。"all" 返回空对象表示不限时间。
 * 使用场景：小程序的范围切换；桌面端日历之外的快捷选项。
 */
export function activityRange(preset: ActivityRangePreset, now = Date.now()): { from?: number; to?: number } {
  const day = 86_400_000;
  switch (preset) {
    case "today": {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { from: start.getTime(), to: now };
    }
    case "24h":
      return { from: now - day, to: now };
    case "7d":
      return { from: now - 7 * day, to: now };
    case "30d":
      return { from: now - 30 * day, to: now };
    default:
      return {};
  }
}

/** CSV 单元格转义：含逗号、引号或换行时加引号；以公式字符开头的文本加前导单引号，防止表格软件执行 */
function csvCell(value: string | number | null): string {
  if (value === null) return "";
  if (typeof value === "number") return String(value);
  const guarded = /^[=+@\t\r]/.test(value) || /^-[^\d]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

/** CSV 列：表头 → 取值 */
const CSV_COLUMNS: readonly [string, (record: ActivityRecord) => string | number | null][] = [
  ["时间", (record) => activityTime(record.timestamp)],
  ["事件", (record) => activityLabel(record.eventType)],
  ["事件类型", (record) => record.eventType],
  ["玩家", (record) => record.actorName],
  ["玩家 ID", (record) => record.actorId],
  ["目标", (record) => record.targetId],
  ["维度", (record) => (record.dimension ? dimensionLabel(record.dimension) : "")],
  ["X", (record) => record.x],
  ["Y", (record) => record.y],
  ["Z", (record) => record.z],
  ["级别", (record) => ACTIVITY_LEVELS[record.level]?.label ?? record.level],
  ["详情", (record) => activityDetail(record)],
  ["附加数据", (record) => (record.payload && Object.keys(record.payload).length ? JSON.stringify(record.payload) : "")],
];

/**
 * 生成 CSV 文本（CRLF 换行，不含 BOM；需要 Excel 直接识别中文时由调用方在前面加 \uFEFF）。
 * 使用场景：桌面端「导出 CSV」。
 */
export function activityCsv(records: readonly ActivityRecord[]): string {
  const lines = [CSV_COLUMNS.map(([header]) => csvCell(header)).join(",")];
  for (const record of records) lines.push(CSV_COLUMNS.map(([, read]) => csvCell(read(record))).join(","));
  return lines.join("\r\n");
}
