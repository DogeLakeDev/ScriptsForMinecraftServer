/**
 * scoreboard.ts — 计分板的展示文案、统计、排行与分布
 *
 * 使用场景：桌面端「计分板」页；小程序管理端「计分板」页通过 vendor/desktop-lib.js 共用同一份规则（DRY）。
 * 只依赖协议类型与 format.ts，不依赖 React / DOM，可被小程序打包。
 * 操作校验、目标可否编辑与命令生成属于协议规则，在 @sfmc-bds/management 的 scoreboard.ts 中，这里只调用不重复；
 * 表单校验（objectiveFormError / scoreForm）在协议规则之上补充“与现有数据重名”等界面层检查。
 */
import type {
  ScoreboardDisplaySlot,
  ScoreboardObjectiveRow,
  ScoreboardOperation,
  ScoreboardParticipant,
  ScoreboardReadResult,
  ScoreboardScoreMode,
} from "@sfmc-bds/management";
import { scoreboardOperationError } from "@sfmc-bds/management";
import { plainMinecraft, type Tone } from "./format.js";

/** 显示位的中文名称 */
export const SCOREBOARD_SLOT_LABELS: Record<ScoreboardDisplaySlot, string> = {
  sidebar: "侧边栏",
  list: "玩家列表",
  belowName: "名字下方",
};

/** 修改分数的方式（展示顺序） */
export const SCORE_MODES: readonly { value: ScoreboardScoreMode; label: string }[] = [
  { value: "set", label: "设为" },
  { value: "add", label: "增加" },
  { value: "remove", label: "减少" },
];

/** 参与者排序方式 */
export type ScoreboardSort = "score-desc" | "score-asc" | "name";

/** 参与者排序选项（展示顺序） */
export const SCOREBOARD_SORTS: readonly { value: ScoreboardSort; label: string }[] = [
  { value: "score-desc", label: "分数从高到低" },
  { value: "score-asc", label: "分数从低到高" },
  { value: "name", label: "按名称" },
];

/** 计分项标题：显示名去掉 § 格式码；为空时用 ID */
export function objectiveTitle(objective: Pick<ScoreboardObjectiveRow, "id" | "displayName">): string {
  return plainMinecraft(objective.displayName).trim() || objective.id;
}

/** 参与者显示名去掉 § 格式码；为空时用身份 ID */
export function participantName(participant: Pick<ScoreboardParticipant, "id" | "name">): string {
  return plainMinecraft(participant.name).trim() || `#${participant.id}`;
}

/** 参与者类型标签（在线 / 离线玩家、虚拟玩家、实体） */
export function participantTag(participant: Pick<ScoreboardParticipant, "type" | "online">): { label: string; tone: Tone } {
  if (participant.type === "player") return participant.online ? { label: "在线玩家", tone: "success" } : { label: "离线玩家", tone: "neutral" };
  if (participant.type === "fakePlayer") return { label: "虚拟玩家", tone: "info" };
  return { label: "实体", tone: "warning" };
}

/** 计分项当前绑定的显示位名称（如「侧边栏 · 降序」） */
export function objectiveSlots(result: Pick<ScoreboardReadResult, "displaySlots"> | undefined, objectiveId: string): string[] {
  return (result?.displaySlots ?? [])
    .filter((row) => row.objectiveId === objectiveId)
    .map((row) => `${SCOREBOARD_SLOT_LABELS[row.slot]} · ${row.sortOrder === "ascending" ? "升序" : "降序"}`);
}

/** 分数加千位分隔符（小程序运行环境的 toLocaleString 不一定分组，所以手写） */
export function formatScore(value: number): string {
  const sign = value < 0 ? "-" : "";
  const digits = String(Math.abs(Math.trunc(value)));
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * 统计卡片的数值：整数部分加千位分隔符，保留至多一位小数（平均值、中位数可能带 .5 等小数）；null 显示「—」。
 * 使用场景：桌面端与小程序计分板的统计卡片。
 */
export function formatStat(value: number | null): string {
  if (value === null) return "—";
  const tenths = Math.round(Math.abs(value) * 10);
  const fraction = tenths % 10;
  return (value < 0 ? "-" : "") + formatScore(Math.floor(tenths / 10)) + (fraction ? `.${fraction}` : "");
}

/** 计分项分数统计 */
export interface ScoreStats {
  count: number;
  sum: number;
  /** 平均值（保留一位小数）；没有参与者时为 null */
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
}

/** 统计一组参与者的分数 */
export function scoreStats(participants: readonly Pick<ScoreboardParticipant, "score">[]): ScoreStats {
  const scores = participants.map((row) => row.score).sort((a, b) => a - b);
  const count = scores.length;
  if (!count) return { count: 0, sum: 0, mean: null, median: null, min: null, max: null };
  const sum = scores.reduce((total, score) => total + score, 0);
  const middle = Math.floor(count / 2);
  const median = count % 2 ? scores[middle]! : (scores[middle - 1]! + scores[middle]!) / 2;
  return { count, sum, mean: Math.round((sum / count) * 10) / 10, median, min: scores[0]!, max: scores[count - 1]! };
}

/** 按关键词（名称包含，不区分大小写）筛选参与者 */
export function filterParticipants<T extends Pick<ScoreboardParticipant, "id" | "name">>(participants: readonly T[], keyword: string): T[] {
  const text = keyword.trim().toLowerCase();
  if (!text) return [...participants];
  return participants.filter((row) => participantName(row).toLowerCase().includes(text));
}

/** 排序参与者；分数相同时按名称 */
export function sortParticipants<T extends Pick<ScoreboardParticipant, "id" | "name" | "score">>(participants: readonly T[], sort: ScoreboardSort): T[] {
  const byName = (a: T, b: T) => participantName(a).localeCompare(participantName(b), "zh-CN");
  return [...participants].sort((a, b) => {
    if (sort === "name") return byName(a, b);
    return (sort === "score-desc" ? b.score - a.score : a.score - b.score) || byName(a, b);
  });
}

/** 排行条目：ratio 为条形长度占最大绝对值的百分比（0–100） */
export interface ScoreRankRow<T> {
  rank: number;
  participant: T;
  ratio: number;
}

/**
 * 分数排行（默认从高到低）的前 limit 名，条形长度按绝对值缩放，负分也能看出大小。
 * 并列分数共享名次（1、1、3）。
 */
export function scoreRanking<T extends Pick<ScoreboardParticipant, "id" | "name" | "score">>(
  participants: readonly T[],
  limit: number,
  order: "desc" | "asc" = "desc"
): ScoreRankRow<T>[] {
  const sorted = sortParticipants(participants, order === "desc" ? "score-desc" : "score-asc");
  const top = sorted.slice(0, Math.max(0, limit));
  const maxAbs = Math.max(1, ...top.map((row) => Math.abs(row.score)));
  let rank = 0;
  return top.map((participant, index) => {
    if (index === 0 || participant.score !== top[index - 1]!.score) rank = index + 1;
    return { rank, participant, ratio: Math.round((Math.abs(participant.score) / maxAbs) * 1000) / 10 };
  });
}

/** 分布直方图的一个区间：[from, to] 闭区间的整数分数 */
export interface ScoreBin {
  from: number;
  to: number;
  count: number;
  /** 柱高占最高柱的百分比（0–100） */
  ratio: number;
}

/**
 * 分数分布：把 [最小值, 最大值] 等分成至多 binCount 个整数区间。
 * 分数种类少于 binCount 时每个分数单独成柱；没有参与者时返回空数组。
 */
export function scoreHistogram(participants: readonly Pick<ScoreboardParticipant, "score">[], binCount: number): ScoreBin[] {
  if (!participants.length || binCount < 1) return [];
  const scores = participants.map((row) => row.score);
  // 参与者可能上万，不用展开参数求最值，避免超出调用参数个数上限
  const min = scores.reduce((low, score) => Math.min(low, score), scores[0]!);
  const max = scores.reduce((high, score) => Math.max(high, score), scores[0]!);
  const span = max - min + 1;
  const bins = Math.min(binCount, span);
  const width = Math.ceil(span / bins);
  const counts = new Array<number>(Math.ceil(span / width)).fill(0);
  for (const score of scores) counts[Math.floor((score - min) / width)]! += 1;
  const peak = counts.reduce((high, count) => Math.max(high, count), 1);
  return counts.map((count, index) => ({
    from: min + index * width,
    to: Math.min(max, min + (index + 1) * width - 1),
    count,
    ratio: Math.round((count / peak) * 1000) / 10,
  }));
}

/** 直方图区间文案：单个分数显示该分数，否则显示「a ~ b」 */
export function binLabel(bin: Pick<ScoreBin, "from" | "to">): string {
  return bin.from === bin.to ? formatScore(bin.from) : `${formatScore(bin.from)} ~ ${formatScore(bin.to)}`;
}

/**
 * 组装一条修改分数的操作。修改已有参与者时传入其身份 ID，CLI 据此复核其仍可经命令定位。
 * 使用场景：桌面端与小程序的「修改分数」「添加参与者」表单。
 */
export function scoreOperation(
  mode: ScoreboardScoreMode,
  objective: string,
  target: string,
  value: number,
  participantId?: number
): ScoreboardOperation {
  const op = `score.${mode}` as "score.set" | "score.add" | "score.remove";
  return { op, objective, target, value, ...(participantId === undefined ? {} : { participantId }) };
}

/** 修改后的预计分数（用于表单中「当前 → 修改后」的提示） */
export function previewScore(current: number, mode: ScoreboardScoreMode, value: number): number {
  if (mode === "set") return value;
  return mode === "add" ? current + value : current - value;
}

/**
 * 「新建计分项」表单的校验：已有同名计分项或参数不合法时返回说明，合法时返回 null。
 * 使用场景：桌面端与小程序的新建计分项表单（参数规则来自协议的 scoreboardOperationError）。
 */
export function objectiveFormError(objectives: readonly Pick<ScoreboardObjectiveRow, "id">[], operation: ScoreboardOperation): string | null {
  if (objectives.some((row) => row.id === operation.objective)) return "已存在同名计分项";
  return scoreboardOperationError(operation);
}

/**
 * 「修改分数 / 添加参与者」表单：组装操作并给出校验结果。
 * participant 为 null 表示添加参与者，此时 target 为填写的名称，且不能与计分项中已有参与者同名（应在列表里直接修改）；
 * value 为 null 表示尚未填写分数。
 * 使用场景：桌面端与小程序的分数表单。
 */
export function scoreForm(
  objective: Pick<ScoreboardObjectiveRow, "id" | "participants">,
  participant: Pick<ScoreboardParticipant, "id" | "name"> | null,
  mode: ScoreboardScoreMode,
  target: string,
  value: number | null
): { operation: ScoreboardOperation; error: string | null } {
  const adding = participant === null;
  const operation = scoreOperation(mode, objective.id, adding ? target : participant.name, value ?? Number.NaN, participant?.id);
  if (value === null) return { operation, error: "请填写分数" };
  if (adding && objective.participants.some((row) => row.name === target)) return { operation, error: "该计分项中已有同名参与者，请在列表中直接修改" };
  return { operation, error: scoreboardOperationError(operation) };
}
