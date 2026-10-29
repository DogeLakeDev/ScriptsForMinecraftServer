/**
 * scoreboard.ts — 计分板查看与编辑的协议类型与规则
 *
 * 使用场景：桌面端「计分板」页与小程序管理端调用 scoreboard.read / scoreboard.apply。
 * 读取：游戏内平台脚本把世界计分板快照推到数据服务，CLI 再从数据服务读取（只在有人查看时同步，见 db-server 的 scoreboard 领域）。
 * 写入：CLI 把结构化操作转成 `scoreboard` 控制台命令，经 BDS 标准输入下发；结果由下一次快照体现。
 * 握手带 "scoreboard" 能力时才可调用。
 *
 * 本文件同时提供纯函数：操作校验（scoreboardOperationError）、参与者是否可经命令修改（scoreboardTargetBlock）
 * 与命令生成（scoreboardCommand）。CLI 用它们做权威校验，桌面端与小程序用同一份规则做表单提示与命令预览（DRY）。
 */

/** 计分板参与者类型：在线或离线的玩家、虚拟玩家（假名）、非玩家实体 */
export type ScoreboardParticipantType = "player" | "fakePlayer" | "entity";

/** 计分板显示位：侧边栏、暂停菜单玩家列表、玩家名下方 */
export type ScoreboardDisplaySlot = "sidebar" | "list" | "belowName";

/** 计分板中的一个参与者及其在某个计分项上的分数 */
export interface ScoreboardParticipant {
  /** 计分板身份 ID（ScoreboardIdentity.id），同一参与者在各计分项中相同 */
  id: number;
  /** 显示名：玩家为玩家名（离线时取平台缓存的最近一次名称），虚拟玩家为假名，实体为实体名 */
  name: string;
  type: ScoreboardParticipantType;
  /** 玩家是否在线；虚拟玩家恒为 false，实体表示是否已加载 */
  online: boolean;
  score: number;
}

/** 一个计分项及其全部参与者 */
export interface ScoreboardObjectiveRow {
  /** 计分项 ID（命令中使用的名称） */
  id: string;
  /** 显示名称 */
  displayName: string;
  participants: ScoreboardParticipant[];
}

/** 显示位上当前绑定的计分项 */
export interface ScoreboardDisplayRow {
  slot: ScoreboardDisplaySlot;
  objectiveId: string;
  sortOrder: "ascending" | "descending";
}

/** scoreboard.read 参数 */
export interface ScoreboardReadParams {
  /**
   * 毫秒时间戳。提供时等待快照的 updatedAt 晚于该时间再返回（有上限）。
   * 使用场景：scoreboard.apply 之后读取，确保看到命令执行后的结果。
   */
  after?: number;
}

/** scoreboard.read 结果 */
export interface ScoreboardReadResult {
  /** 数据服务可达且收到过游戏内快照 */
  available: boolean;
  /** 快照是否为最近同步的（游戏内脚本仍在上报） */
  fresh: boolean;
  /** 快照生成时间（毫秒时间戳）；从未收到时为 null */
  updatedAt: number | null;
  objectives: ScoreboardObjectiveRow[];
  displaySlots: ScoreboardDisplayRow[];
  /** 参与者过多时游戏内只上报了一部分 */
  truncated: boolean;
  /** 不可用或不新鲜时的说明 */
  note?: string;
}

/** 修改分数的方式：设为 / 增加 / 减少 */
export type ScoreboardScoreMode = "set" | "add" | "remove";

/** 一条计分板编辑操作 */
export type ScoreboardOperation =
  | { op: "objective.add"; objective: string; displayName?: string }
  | { op: "objective.remove"; objective: string }
  | {
      op: "score.set" | "score.add" | "score.remove";
      objective: string;
      /** 参与者名称（在线玩家名或虚拟玩家名） */
      target: string;
      /** 修改已有参与者时带上其身份 ID，CLI 据快照确认其仍可经命令定位 */
      participantId?: number;
      value: number;
    }
  | { op: "score.reset"; objective: string; target: string; participantId?: number };

/** scoreboard.apply 参数 */
export interface ScoreboardApplyParams {
  operations: ScoreboardOperation[];
}

/** scoreboard.apply 结果 */
export interface ScoreboardApplyResult {
  /** 已发送到 BDS 控制台的命令（按顺序） */
  commands: string[];
  /** 发送时间（毫秒时间戳），可作为 scoreboard.read 的 after 参数 */
  sentAt: number;
}

/**
 * scoreboard.publicObjectives 结果：玩家端排行「计分板」分类里公开的计分项 id 列表。
 * 使用场景：管理端计分项详情页的「在排行中公开」开关；名单存在 db-server 的 settings.json。
 */
export interface ScoreboardPublicObjectivesResult {
  ids: string[];
}

/**
 * scoreboard.setPublicObjective 参数：把某个计分项加入或移出公开名单。
 * 使用场景：管理端开关；按 id 增量改写，避免覆盖其他计分项的公开状态。
 */
export interface ScoreboardSetPublicObjectiveParams {
  objectiveId: string;
  /** true 加入公开名单，false 移出 */
  public: boolean;
}

/** 计分板分数的取值范围（32 位有符号整数，与 BDS 一致） */
export const SCOREBOARD_SCORE_MIN = -2147483648;
export const SCOREBOARD_SCORE_MAX = 2147483647;
/** 单次 scoreboard.apply 最多包含的操作数，避免一次向控制台写入过多命令 */
export const SCOREBOARD_APPLY_MAX = 100;
/** 计分项 ID、显示名与参与者名称的最大长度；只用于防止异常长的命令行，不对应游戏内限制 */
export const SCOREBOARD_NAME_MAX = 128;

/**
 * 校验命令参数中的名称（计分项 ID、显示名、参与者名）。
 * 名称会放进双引号里发送，因此拒绝引号、反斜杠与控制字符（含换行，避免一行变多条命令）。
 * 返回错误说明；合法时返回 null。
 */
function nameError(value: unknown, label: string, required = true): string | null {
  if (value === undefined && !required) return null;
  if (typeof value !== "string") return `${label}必须为文本`;
  if (!value.trim()) return required ? `请填写${label}` : null;
  if (value.length > SCOREBOARD_NAME_MAX) return `${label}不能超过 ${SCOREBOARD_NAME_MAX} 个字符`;
  // eslint-disable-next-line no-control-regex
  if (/["\\\u0000-\u001f\u007f]/.test(value)) return `${label}不能包含引号、反斜杠或换行`;
  if (value !== value.trim()) return `${label}首尾不能有空格`;
  return null;
}

/**
 * 校验参与者名称。
 * 以 @ 开头会被当作目标选择器（如 @a 会修改所有玩家），单独的 * 表示全部参与者，都拒绝以免误改一批分数。
 */
function targetError(value: unknown): string | null {
  const base = nameError(value, "参与者名称");
  if (base) return base;
  const text = value as string;
  if (text.startsWith("@")) return "参与者名称不能以 @ 开头（会被当作目标选择器）";
  if (text === "*") return "参与者名称不能为 *（会作用于全部参与者）";
  return null;
}

/** 校验分数：设为时允许 32 位有符号整数全范围，增加 / 减少时为非负整数 */
function valueError(value: unknown, mode: ScoreboardScoreMode): string | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return "分数必须为整数";
  if (mode === "set") {
    if (value < SCOREBOARD_SCORE_MIN || value > SCOREBOARD_SCORE_MAX) return `分数需在 ${SCOREBOARD_SCORE_MIN} 到 ${SCOREBOARD_SCORE_MAX} 之间`;
  } else if (value < 0 || value > SCOREBOARD_SCORE_MAX) {
    return `${mode === "add" ? "增加" : "减少"}的数值需在 0 到 ${SCOREBOARD_SCORE_MAX} 之间`;
  }
  return null;
}

/**
 * 校验一条操作的格式。
 * 使用场景：CLI 在下发前逐条校验（权威）；桌面端与小程序在表单中即时提示。
 * 返回错误说明；合法时返回 null。
 */
export function scoreboardOperationError(operation: unknown): string | null {
  if (!operation || typeof operation !== "object" || Array.isArray(operation)) return "操作格式无效";
  const op = operation as Record<string, unknown>;
  const objective = nameError(op.objective, "计分项 ID");
  switch (op.op) {
    case "objective.add":
      return objective ?? nameError(op.displayName, "显示名称", false);
    case "objective.remove":
      return objective;
    case "score.set":
    case "score.add":
    case "score.remove":
      return objective ?? targetError(op.target) ?? valueError(op.value, op.op.slice("score.".length) as ScoreboardScoreMode);
    case "score.reset":
      return objective ?? targetError(op.target);
    default:
      return "不支持的计分板操作";
  }
}

/**
 * 参与者不能经控制台命令修改的原因；可以修改时返回 null。
 * 控制台命令只能按名称定位在线玩家与虚拟玩家：离线玩家的名称会被当成同名的新虚拟玩家，
 * 非玩家实体没有可用于命令的名称。
 * 使用场景：CLI 在下发前按最新快照复核；界面据此禁用对应行的编辑按钮并说明原因。
 */
export function scoreboardTargetBlock(participant: Pick<ScoreboardParticipant, "type" | "online">): string | null {
  if (participant.type === "entity") return "非玩家实体无法通过控制台命令定位";
  if (participant.type === "player" && !participant.online) return "玩家离线，控制台命令无法修改离线玩家的分数";
  return null;
}

/** 把名称放进双引号（名称已由 scoreboardOperationError 保证不含引号与反斜杠） */
const quote = (value: string) => `"${value}"`;

/**
 * 把一条已校验的操作转成 BDS 控制台命令（不含前导斜杠）。
 * 使用场景：CLI 生成实际下发的命令；界面在确认前预览同一条命令。
 */
export function scoreboardCommand(operation: ScoreboardOperation): string {
  switch (operation.op) {
    case "objective.add": {
      const display = operation.displayName?.trim();
      return `scoreboard objectives add ${quote(operation.objective)} dummy${display ? ` ${quote(display)}` : ""}`;
    }
    case "objective.remove":
      return `scoreboard objectives remove ${quote(operation.objective)}`;
    case "score.set":
    case "score.add":
    case "score.remove":
      return `scoreboard players ${operation.op.slice("score.".length)} ${quote(operation.target)} ${quote(operation.objective)} ${operation.value}`;
    case "score.reset":
      return `scoreboard players reset ${quote(operation.target)} ${quote(operation.objective)}`;
  }
}
