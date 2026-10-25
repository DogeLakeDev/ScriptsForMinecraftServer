/**
 * domain/scoreboard.ts — 世界计分板快照的接收与读取
 *
 * 使用场景：
 *   - 游戏内平台脚本（SDK runtime/scoreboard-sync）每约 2 秒 POST /api/sfmc/scoreboard/live；
 *   - CLI 的 scoreboard.read 经 GET /api/sfmc/scoreboard 读取，供桌面端与小程序「计分板」页展示。
 *
 * 遍历全部计分项有开销，所以只在有人查看时同步：每次读取把「关注期」延长 WATCH_MS，
 * 游戏内脚本从上报的响应里得知 watching 后才计算快照；无人查看时只发空闲探询。
 * 快照内容不变时只上报哈希（kind: "same"），数据服务据此确认快照仍然新鲜；
 * 数据服务重启丢失快照、或哈希对不上时，响应 needFull 让脚本下次补发完整快照。
 * 快照只保存在内存中，不落库。
 */

/** 参与者类型（与 @sfmc-bds/management 的 ScoreboardParticipantType 一致） */
export type ScoreboardParticipantType = "player" | "fakePlayer" | "entity";
/** 显示位（与 @sfmc-bds/management 的 ScoreboardDisplaySlot 一致） */
export type ScoreboardDisplaySlot = "sidebar" | "list" | "belowName";

/** 上报中的参与者（各计分项共用，分数按 ID 引用） */
export interface ScoreboardReportParticipant {
  id: number;
  name: string;
  type: ScoreboardParticipantType;
  online: boolean;
}

/** 上报中的计分项；scores 为 [参与者 ID, 分数] 对，避免在每个计分项里重复参与者信息 */
export interface ScoreboardReportObjective {
  id: string;
  displayName: string;
  scores: Array<[number, number]>;
}

/** 上报中的显示位 */
export interface ScoreboardReportDisplay {
  slot: ScoreboardDisplaySlot;
  objectiveId: string;
  sortOrder: "ascending" | "descending";
}

/** 完整快照 */
export interface ScoreboardSnapshot {
  hash: string;
  /** 游戏内生成快照的时间（毫秒时间戳） */
  generatedAt: number;
  participants: ScoreboardReportParticipant[];
  objectives: ScoreboardReportObjective[];
  displaySlots: ScoreboardReportDisplay[];
  truncated: boolean;
}

/** 解析后的上报：空闲探询 / 内容未变 / 完整快照 */
export type ScoreboardReport =
  | { kind: "idle" }
  | { kind: "same"; hash: string; generatedAt: number }
  | ({ kind: "full" } & ScoreboardSnapshot);

/** 上报的响应：是否有人在看（决定脚本是否计算快照），以及是否需要补发完整快照 */
export interface ScoreboardReportReply {
  watching: boolean;
  needFull: boolean;
}

/** 与 @sfmc-bds/management 的 ScoreboardReadResult 同构；CLI 侧由类型检查保证两边不漂移 */
export interface ScoreboardReadView {
  available: boolean;
  fresh: boolean;
  updatedAt: number | null;
  objectives: Array<{
    id: string;
    displayName: string;
    participants: Array<ScoreboardReportParticipant & { score: number }>;
  }>;
  displaySlots: ScoreboardReportDisplay[];
  truncated: boolean;
  note?: string;
  /**
   * 游戏内脚本最近是否上报过（含空闲探询）。不属于管理协议，CLI 用来判断是否值得等待新快照：
   * 脚本没在上报（BDS 未运行或平台脚本未加载）时直接返回，不空等。
   */
  scriptConnected: boolean;
}

/**
 * 上报体积上限：超过即视为异常请求拒收。游戏内脚本有自己的更小上限（超出时截断并标记 truncated），
 * 这里只防止异常请求占满内存。
 */
export const SCOREBOARD_REPORT_LIMITS = { objectives: 2000, participants: 100_000, scores: 500_000, name: 512 } as const;
/** 一次读取后保持「有人在看」的时长 */
export const SCOREBOARD_WATCH_MS = 30_000;
/** 快照在最后一次确认后多久内视为新鲜（脚本约 2 秒确认一次，留出几次失败的余量） */
export const SCOREBOARD_FRESH_MS = 10_000;

const PARTICIPANT_TYPES = new Set<string>(["player", "fakePlayer", "entity"]);
const DISPLAY_SLOTS = new Set<string>(["sidebar", "list", "belowName"]);

/** 有限长度的文本 */
const isText = (value: unknown, allowEmpty = true): value is string =>
  typeof value === "string" && value.length <= SCOREBOARD_REPORT_LIMITS.name && (allowEmpty || value.length > 0);
/** 32 位有符号整数（计分板分数与身份 ID 的取值范围） */
const isInt32 = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= -2147483648 && value <= 2147483647;
/** 合理的时间戳；缺省时用接收时间 */
const timestamp = (value: unknown, now: number): number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : now;

/**
 * 校验并解析一次上报；格式不对时返回 null。
 * 使用场景：POST /api/sfmc/scoreboard/live 收到的请求体。
 */
export function parseScoreboardReport(data: Record<string, unknown>, now = Date.now()): ScoreboardReport | null {
  if (data.kind === "idle") return { kind: "idle" };
  if (!isText(data.hash, false)) return null;
  if (data.kind === "same") return { kind: "same", hash: data.hash, generatedAt: timestamp(data.generatedAt, now) };
  if (data.kind !== "full") return null;

  const rawParticipants = data.participants;
  const rawObjectives = data.objectives;
  const rawDisplay = data.displaySlots ?? [];
  if (!Array.isArray(rawParticipants) || rawParticipants.length > SCOREBOARD_REPORT_LIMITS.participants) return null;
  if (!Array.isArray(rawObjectives) || rawObjectives.length > SCOREBOARD_REPORT_LIMITS.objectives) return null;
  if (!Array.isArray(rawDisplay) || rawDisplay.length > DISPLAY_SLOTS.size) return null;

  const participants: ScoreboardReportParticipant[] = [];
  const known = new Set<number>();
  for (const row of rawParticipants) {
    if (!row || typeof row !== "object") return null;
    const { id, name, type, online } = row as Record<string, unknown>;
    if (!isInt32(id) || known.has(id) || !isText(name) || typeof type !== "string" || !PARTICIPANT_TYPES.has(type) || typeof online !== "boolean") return null;
    known.add(id);
    participants.push({ id, name, type: type as ScoreboardParticipantType, online });
  }

  const objectives: ScoreboardReportObjective[] = [];
  const objectiveIds = new Set<string>();
  let scoreCount = 0;
  for (const row of rawObjectives) {
    if (!row || typeof row !== "object") return null;
    const { id, displayName, scores } = row as Record<string, unknown>;
    if (!isText(id, false) || objectiveIds.has(id) || !isText(displayName) || !Array.isArray(scores)) return null;
    scoreCount += scores.length;
    if (scoreCount > SCOREBOARD_REPORT_LIMITS.scores) return null;
    const pairs: Array<[number, number]> = [];
    for (const pair of scores) {
      if (!Array.isArray(pair) || pair.length !== 2 || !known.has(pair[0]) || !isInt32(pair[1])) return null;
      pairs.push([pair[0], pair[1]]);
    }
    objectiveIds.add(id);
    objectives.push({ id, displayName, scores: pairs });
  }

  const displaySlots: ScoreboardReportDisplay[] = [];
  for (const row of rawDisplay) {
    if (!row || typeof row !== "object") return null;
    const { slot, objectiveId, sortOrder } = row as Record<string, unknown>;
    if (typeof slot !== "string" || !DISPLAY_SLOTS.has(slot) || !isText(objectiveId, false)) return null;
    if (sortOrder !== "ascending" && sortOrder !== "descending") return null;
    displaySlots.push({ slot: slot as ScoreboardDisplaySlot, objectiveId, sortOrder });
  }

  return {
    kind: "full",
    hash: data.hash,
    generatedAt: timestamp(data.generatedAt, now),
    participants,
    objectives,
    displaySlots,
    truncated: data.truncated === true,
  };
}

/**
 * 内存中的计分板快照与关注状态。
 * 使用场景：routes/scoreboard.ts 每个数据服务进程持有一个实例。
 */
export class ScoreboardStore {
  private snapshot: ScoreboardSnapshot | null = null;
  /** 脚本最后一次确认快照与世界一致的时间（游戏内时间戳） */
  private verifiedAt = 0;
  /** 数据服务最后一次收到确认的时间（本机时间），用于判断新鲜度 */
  private confirmedAt = 0;
  /** 在此之前视为有人在看 */
  private watchUntil = 0;
  /** 最后一次收到任意上报的时间（本机时间）；从未收到时为 null */
  private reportedAt: number | null = null;

  /** 处理一次上报，返回给脚本的指示 */
  report(report: ScoreboardReport, now = Date.now()): ScoreboardReportReply {
    this.reportedAt = now;
    if (report.kind === "full") {
      const { kind: _kind, ...snapshot } = report;
      this.snapshot = snapshot;
      this.verifiedAt = snapshot.generatedAt;
      this.confirmedAt = now;
    } else if (report.kind === "same") {
      if (!this.snapshot || this.snapshot.hash !== report.hash) return { watching: this.watching(now), needFull: true };
      this.verifiedAt = Math.max(this.verifiedAt, report.generatedAt);
      this.confirmedAt = now;
    }
    return { watching: this.watching(now), needFull: false };
  }

  /** 读取快照并延长关注期，使脚本继续同步 */
  read(now = Date.now()): ScoreboardReadView {
    this.watchUntil = now + SCOREBOARD_WATCH_MS;
    const snapshot = this.snapshot;
    const fresh = snapshot !== null && now - this.confirmedAt <= SCOREBOARD_FRESH_MS;
    const scriptConnected = this.reportedAt !== null && now - this.reportedAt <= SCOREBOARD_FRESH_MS;
    if (!snapshot) {
      return {
        available: false,
        fresh: false,
        updatedAt: null,
        objectives: [],
        displaySlots: [],
        truncated: false,
        note: scriptConnected ? "正在等待游戏内同步计分板" : "游戏内平台脚本未连接，请确认 BDS 正在运行",
        scriptConnected,
      };
    }
    const byId = new Map(snapshot.participants.map((row) => [row.id, row]));
    return {
      available: true,
      fresh,
      updatedAt: this.verifiedAt,
      objectives: snapshot.objectives.map((objective) => ({
        id: objective.id,
        displayName: objective.displayName,
        participants: objective.scores.map(([id, score]) => ({ ...byId.get(id)!, score })),
      })),
      displaySlots: snapshot.displaySlots,
      truncated: snapshot.truncated,
      ...(fresh ? {} : { note: scriptConnected ? "计分板快照已过期，正在等待游戏内重新同步" : "游戏内平台脚本未连接，显示的是最后一次同步的计分板" }),
      scriptConnected,
    };
  }

  private watching(now: number): boolean {
    return now < this.watchUntil;
  }
}
