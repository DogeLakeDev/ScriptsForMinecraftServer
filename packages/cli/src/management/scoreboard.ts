/**
 * scoreboard.ts — 管理协议 scoreboard.read / scoreboard.apply
 *
 * 使用场景：桌面端与小程序的「计分板」页。
 *   - 读取：从数据服务 GET /api/sfmc/scoreboard 取游戏内同步的快照。数据服务只在有人查看时才让游戏内脚本计算快照，
 *     所以首次读取或带 after 参数时会短暂等待新快照（脚本未连接时不等待）。
 *   - 写入：按 @sfmc-bds/management 的规则逐条校验，转成 `scoreboard` 控制台命令，经注入的 send 写入 BDS 标准输入。
 *     stdio 会话把命令转发给守护进程的 services.send，守护进程内则直接写入托管 BDS 的标准输入（DIP）。
 */
import {
  SCOREBOARD_APPLY_MAX,
  scoreboardCommand,
  scoreboardOperationError,
  scoreboardTargetBlock,
  type ScoreboardApplyResult,
  type ScoreboardOperation,
  type ScoreboardParticipant,
  type ScoreboardPublicObjectivesResult,
  type ScoreboardReadResult,
} from "@sfmc-bds/management";
import type { ScoreboardReadView } from "@sfmc-bds/db-server/scoreboard";
import { getRoot } from "../runtime.js";
import { dbConfig, offline } from "./metrics-read.js";

/** 等待新快照的最长时间：覆盖脚本得知有人查看后的首次计算与一次上报周期 */
const READ_WAIT_MS = 6_000;
/** 等待期间重新读取的间隔 */
const READ_POLL_MS = 400;

/** 把一行命令发送到 BDS 控制台 */
export type ConsoleSender = (line: string) => Promise<void>;

/** 单次读取数据服务中的快照；数据服务未运行时返回 null */
async function fetchView(): Promise<ScoreboardReadView | null> {
  const cfg = dbConfig(getRoot());
  try {
    const response = await fetch(`http://127.0.0.1:${cfg.db_port ?? 3001}/api/sfmc/scoreboard`, {
      headers: cfg.http_auth ? { authorization: `Bearer ${cfg.http_auth}` } : {},
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`计分板读取失败 (${response.status})`);
    const body = (await response.json()) as ScoreboardReadView;
    if (!body || typeof body !== "object" || !Array.isArray(body.objectives)) throw new Error("计分板读取失败");
    return body;
  } catch (error) {
    if (offline(error)) return null;
    throw error;
  }
}

/** 数据服务内部视图 → 协议结果（去掉 scriptConnected 等内部字段） */
function toResult(view: ScoreboardReadView): ScoreboardReadResult {
  const result: ScoreboardReadResult = {
    available: view.available,
    fresh: view.fresh,
    updatedAt: view.updatedAt,
    objectives: view.objectives,
    displaySlots: view.displaySlots,
    truncated: view.truncated,
  };
  if (view.note) result.note = view.note;
  return result;
}

/** 数据服务未运行时的结果 */
const OFFLINE_RESULT: ScoreboardReadResult = {
  available: false,
  fresh: false,
  updatedAt: null,
  objectives: [],
  displaySlots: [],
  truncated: false,
  note: "数据服务未运行，无法读取计分板",
};

/** 解析 scoreboard.read 的 after 参数 */
function afterOf(params: unknown): number | undefined {
  if (params === undefined || params === null) return undefined;
  if (typeof params !== "object" || Array.isArray(params)) throw new Error("参数必须为对象");
  const after = (params as { after?: unknown }).after;
  if (after === undefined) return undefined;
  if (typeof after !== "number" || !Number.isFinite(after) || after < 0) throw new Error("after 必须为毫秒时间戳");
  return after;
}

/**
 * 管理协议 scoreboard.read。
 * 快照不新鲜、或早于 after 时，在脚本仍连接的前提下最多等待 READ_WAIT_MS；超时返回当时的快照（fresh 如实标注）。
 */
export async function readScoreboard(params: unknown): Promise<ScoreboardReadResult> {
  const after = afterOf(params);
  const deadline = Date.now() + READ_WAIT_MS;
  for (;;) {
    const view = await fetchView();
    if (!view) return OFFLINE_RESULT;
    const current = view.fresh && (after === undefined || (view.updatedAt ?? 0) > after);
    if (current || !view.scriptConnected || Date.now() + READ_POLL_MS > deadline) return toResult(view);
    await new Promise((resolve) => setTimeout(resolve, READ_POLL_MS));
  }
}

/** 解析并逐条校验 scoreboard.apply 的操作列表 */
function operationsOf(params: unknown): ScoreboardOperation[] {
  if (!params || typeof params !== "object" || Array.isArray(params)) throw new Error("参数必须为对象");
  const operations = (params as { operations?: unknown }).operations;
  if (!Array.isArray(operations) || !operations.length) throw new Error("请提供至少一条计分板操作");
  if (operations.length > SCOREBOARD_APPLY_MAX) throw new Error(`一次最多提交 ${SCOREBOARD_APPLY_MAX} 条计分板操作`);
  operations.forEach((operation, index) => {
    const error = scoreboardOperationError(operation);
    if (error) throw new Error(operations.length > 1 ? `第 ${index + 1} 条操作：${error}` : error);
  });
  return operations as ScoreboardOperation[];
}

/**
 * 按最新快照复核分数操作的目标（权威校验，与界面禁用规则同源）：
 *   - 带 participantId 的已有参与者：必须仍可经命令定位（scoreboardTargetBlock）；
 *   - 新名称：若与离线玩家同名，命令会创建同名虚拟玩家而不是修改该玩家，拒绝。
 */
function checkTargets(operations: ScoreboardOperation[], view: ScoreboardReadView | null): void {
  const scoreOps = operations.filter((operation) => operation.op.startsWith("score."));
  if (!scoreOps.length) return;
  if (!view?.available) throw new Error("暂时读不到计分板快照，无法确认参与者状态，请确认 BDS 正在运行后重试");
  const participants = new Map<number, ScoreboardParticipant>();
  for (const objective of view.objectives) for (const row of objective.participants) participants.set(row.id, row);
  for (const operation of scoreOps) {
    if (!("target" in operation)) continue;
    const known = operation.participantId !== undefined ? participants.get(operation.participantId) : undefined;
    if (known) {
      const block = scoreboardTargetBlock(known);
      if (block) throw new Error(`${known.name}：${block}`);
      continue;
    }
    const offlineSameName = [...participants.values()].find((row) => row.type === "player" && !row.online && row.name === operation.target);
    if (offlineSameName) throw new Error(`${operation.target} 是离线玩家，命令会创建同名虚拟玩家而不是修改该玩家，请等玩家上线后再修改`);
  }
}

/**
 * 管理协议 scoreboard.apply：校验 → 按快照复核目标 → 逐条发送命令。
 * 命令执行结果出现在控制台日志里，最新分数由之后的 scoreboard.read（after = sentAt）体现。
 */
export async function applyScoreboard(params: unknown, send: ConsoleSender): Promise<ScoreboardApplyResult> {
  const operations = operationsOf(params);
  checkTargets(operations, operations.some((operation) => operation.op.startsWith("score.")) ? await fetchView() : null);
  const commands = operations.map(scoreboardCommand);
  for (const command of commands) await send(command);
  return { commands, sentAt: Date.now() };
}

/** 调用 db-server 的公开计分项接口；数据服务未运行时抛错（与读写配置一致，不能静默丢开关） */
async function callPublicObjectives(method: "GET" | "PUT", body?: { ids: string[] }): Promise<string[]> {
  const cfg = dbConfig(getRoot());
  const headers: Record<string, string> = { ...(cfg.http_auth ? { authorization: `Bearer ${cfg.http_auth}` } : {}) };
  if (body) headers["content-type"] = "application/json";
  let response: Response;
  try {
    response = await fetch(`http://127.0.0.1:${cfg.db_port ?? 3001}/api/sfmc/rank/public-objectives`, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(5_000),
    });
  } catch (error) {
    if (offline(error)) throw new Error("数据服务未运行，无法读写排行公开名单");
    throw error;
  }
  const data = (await response.json()) as { success?: boolean; ids?: unknown; message?: string };
  if (!response.ok || data.success !== true || !Array.isArray(data.ids)) {
    throw new Error(typeof data.message === "string" ? data.message : "读写排行公开名单失败");
  }
  return data.ids.map((id) => String(id));
}

/** 管理协议 scoreboard.publicObjectives：读取玩家端排行公开的计分项 id 列表 */
export async function readPublicObjectives(): Promise<ScoreboardPublicObjectivesResult> {
  return { ids: await callPublicObjectives("GET") };
}

/**
 * 管理协议 scoreboard.setPublicObjective：把某个计分项加入或移出公开名单。
 * 使用场景：管理端计分项详情页的开关；先读再写，避免覆盖其他计分项。
 */
export async function setPublicObjective(params: unknown): Promise<ScoreboardPublicObjectivesResult> {
  if (!params || typeof params !== "object" || Array.isArray(params)) throw new Error("参数必须为对象");
  const objectiveId = String((params as { objectiveId?: unknown }).objectiveId ?? "").trim();
  const makePublic = (params as { public?: unknown }).public;
  if (!objectiveId) throw new Error("请提供计分项 ID");
  if (typeof makePublic !== "boolean") throw new Error("public 必须为布尔值");
  const current = await callPublicObjectives("GET");
  const next = makePublic
    ? [...new Set([...current, objectiveId])]
    : current.filter((id) => id !== objectiveId);
  return { ids: await callPublicObjectives("PUT", { ids: next }) };
}
