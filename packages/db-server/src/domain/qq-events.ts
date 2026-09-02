/**
 * domain/qq-events.ts — Minecraft 服务器事件群推送聚合节流器
 *
 * 聚合策略：
 * - 玩家进退与死亡（join / leave / death）：在时间窗口内收集缓冲，合并为单条消息发送，避免刷屏
 * - 关键运行态事件（crash / start）：先立即冲刷（flush）当前窗口内的待发送事件，随后立即单独推送
 */

import {
  DEFAULT_QQ_EVENTS,
  type QqEventsConfig,
} from "@sfmc-bds/sdk/node/config";

import type { OutboundConfig } from "./bridge.js";
import { sendGroupOutbound } from "./bridge.js";

export type QqEventType = "join" | "leave" | "death" | "crash" | "start";

export type QqEventPayload = {
  type: QqEventType;
  player?: string;
  cause?: string;
  detail?: string;
};

export type ResolvedQqEventsConfig = Required<QqEventsConfig>;

const WINDOW_TYPES = new Set<QqEventType>(["join", "leave", "death"]);
const IMMEDIATE_TYPES = new Set<QqEventType>(["crash", "start"]);

/** 窗口内条数上限：达到上限时提前触发 flush，避免单次积压过多内容。 */
export const MAX_WINDOW_EVENTS = 20;

/** SAPI damageSource.cause → 中文映射字典（未收录时保留原英文标识）。 */
const CAUSE_ZH: Record<string, string> = {
  anvil: "铁砧",
  blockExplosion: "方块爆炸",
  campfire: "营火",
  drowning: "溺水",
  entityAttack: "生物攻击",
  entityExplosion: "实体爆炸",
  fall: "坠落",
  fallingBlock: "落石",
  fire: "火焰",
  fireTick: "灼烧",
  flyIntoWall: "撞墙",
  freezing: "冻结",
  lava: "岩浆",
  lightning: "雷击",
  magic: "魔法",
  magma: "岩浆块",
  none: "未知",
  override: "强制",
  piston: "活塞",
  projectile: "弹射物",
  stalactite: "钟乳石",
  stalagmite: "石笋",
  starve: "饥饿",
  suffocation: "窒息",
  suicide: "自杀",
  thorns: "荆棘",
  void: "虚空",
  wither: "凋零",
  // 常见生物名（若上层将实体名填充至 cause 字段）
  zombie: "僵尸",
  skeleton: "骷髅",
  creeper: "苦力怕",
  player: "玩家",
};

/**
 * 解析并填充 QQ 事件推送配置的默认值。
 *
 * @param raw 原始配置对象。
 * @returns 规范化的完整配置对象。
 */
export function resolveQqEventsConfig(raw: unknown): ResolvedQqEventsConfig {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const windowSec = Number(o.window_sec ?? DEFAULT_QQ_EVENTS.window_sec);
  return {
    enabled: o.enabled === undefined ? DEFAULT_QQ_EVENTS.enabled : o.enabled === true,
    window_sec:
      Number.isFinite(windowSec) && windowSec >= 5
        ? Math.min(600, Math.floor(windowSec))
        : DEFAULT_QQ_EVENTS.window_sec,
    join: o.join === undefined ? DEFAULT_QQ_EVENTS.join : o.join === true,
    leave: o.leave === undefined ? DEFAULT_QQ_EVENTS.leave : o.leave === true,
    death: o.death === undefined ? DEFAULT_QQ_EVENTS.death : o.death === true,
    crash: o.crash === undefined ? DEFAULT_QQ_EVENTS.crash : o.crash === true,
    start: o.start === undefined ? DEFAULT_QQ_EVENTS.start : o.start === true,
  };
}

/**
 * 将 SAPI 原生伤害来源代码（damageSource.cause）转换为易读的中文文本。
 *
 * @param cause 伤害来源标识。
 * @returns 中文伤害描述（未收录时保留原英文代码）。
 */
export function localizeCause(cause: string | undefined): string {
  if (!cause) return "";
  const key = cause.trim();
  if (!key) return "";
  return CAUSE_ZH[key] ?? CAUSE_ZH[key.toLowerCase()] ?? key;
}

export function isEventTypeEnabled(cfg: ResolvedQqEventsConfig, type: QqEventType): boolean {
  if (!cfg.enabled) return false;
  return cfg[type] === true;
}

type Buffered = {
  type: "join" | "leave" | "death";
  player: string;
  cause?: string;
};

export type QqEventsAggregatorDeps = {
  getConfig: () => ResolvedQqEventsConfig;
  getOutbound: () => OutboundConfig;
  /** 可选注入：供单元测试模拟时钟与定时器。 */
  setTimeoutFn?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeoutFn?: (id: ReturnType<typeof setTimeout>) => void;
  send?: (text: string) => void;
};

/**
 * 格式化时间窗口内的聚合事件文本。
 *
 * @param events 缓冲区内的事件列表。
 * @returns 格式化后的多行消息字符串。
 */
export function formatWindowBody(events: Buffered[]): string {
  const joins: string[] = [];
  const leaves: string[] = [];
  const deaths: string[] = [];
  for (const e of events) {
    if (e.type === "join") joins.push(e.player);
    else if (e.type === "leave") leaves.push(e.player);
    else {
      const c = localizeCause(e.cause);
      deaths.push(c ? `${e.player}（${c}）` : e.player);
    }
  }
  const lines: string[] = ["[MC事件]"];
  if (joins.length) lines.push(`上线：${joins.join("、")}`);
  if (leaves.length) lines.push(`下线：${leaves.join("、")}`);
  if (deaths.length) lines.push(`死亡：${deaths.join("、")}`);
  return lines.join("\n");
}

/**
 * 格式化高优先级的非聚合即时事件文本（如 BDS 崩溃或启动就绪）。
 *
 * @param ev 即时事件载荷。
 * @returns 格式化后的事件通知文本。
 */
export function formatImmediateBody(ev: QqEventPayload): string {
  if (ev.type === "crash") {
    const d = String(ev.detail ?? "").trim();
    return d ? `[MC事件] BDS 意外退出 (${d})` : "[MC事件] BDS 意外退出";
  }
  if (ev.type === "start") {
    const d = String(ev.detail ?? "").trim();
    return d ? `[MC事件] BDS 已启动 (${d})` : "[MC事件] BDS 已启动";
  }
  return `[MC事件] ${ev.type}`;
}

export function normalizeEventPayload(raw: unknown): QqEventPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const type = String(o.type ?? "").trim() as QqEventType;
  if (!WINDOW_TYPES.has(type) && !IMMEDIATE_TYPES.has(type)) return null;
  const out: QqEventPayload = { type };
  if (o.player !== undefined) {
    const player = String(o.player).trim();
    if (player) out.player = player;
  }
  if (o.cause !== undefined) {
    const cause = String(o.cause).trim();
    if (cause) out.cause = cause;
  }
  if (o.detail !== undefined) {
    const detail = String(o.detail).trim();
    if (detail) out.detail = detail;
  }
  return out;
}

/**
 * 创建 QQ 服务器事件聚合节流器实例。
 *
 * @param deps 依赖注入对象（包含配置获取、出站发送及定时器实现）。
 * @returns 包含 push, flush, cancel, getPendingCount 等方法的聚合器控制器。
 */
export function createQqEventsAggregator(deps: QqEventsAggregatorDeps) {

  const setTimeoutFn = deps.setTimeoutFn ?? setTimeout;
  const clearTimeoutFn = deps.clearTimeoutFn ?? clearTimeout;
  const send =
    deps.send ??
    ((text: string) => {
      sendGroupOutbound(deps.getOutbound(), text);
    });

  let buffer: Buffered[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  function clearTimer(): void {
    if (timer != null) {
      clearTimeoutFn(timer);
      timer = null;
    }
  }

  function flushWindow(): void {
    clearTimer();
    if (buffer.length === 0) return;
    const snapshot = buffer;
    buffer = [];
    const text = formatWindowBody(snapshot);
    if (text.split("\n").length > 1) send(text);
  }

  function scheduleFlush(windowSec: number): void {
    if (timer != null) return;
    timer = setTimeoutFn(() => {
      timer = null;
      flushWindow();
    }, windowSec * 1000);
  }

  function ingestOne(ev: QqEventPayload): { accepted: boolean; reason?: string } {
    const cfg = deps.getConfig();
    if (!isEventTypeEnabled(cfg, ev.type)) {
      return { accepted: false, reason: "disabled" };
    }

    if (IMMEDIATE_TYPES.has(ev.type)) {
      flushWindow();
      send(formatImmediateBody(ev));
      return { accepted: true };
    }

    const player = String(ev.player ?? "").trim();
    if (!player) return { accepted: false, reason: "missing_player" };

    buffer.push({
      type: ev.type as "join" | "leave" | "death",
      player,
      ...(ev.cause ? { cause: ev.cause } : {}),
    });
    scheduleFlush(cfg.window_sec);
    if (buffer.length >= MAX_WINDOW_EVENTS) flushWindow();
    return { accepted: true };
  }

  function ingestMany(items: QqEventPayload[]): {
    accepted: number;
    rejected: number;
  } {
    let accepted = 0;
    let rejected = 0;
    for (const ev of items) {
      const r = ingestOne(ev);
      if (r.accepted) accepted += 1;
      else rejected += 1;
    }
    return { accepted, rejected };
  }

  /** 测试 / 关停：冲刷并清定时器 */
  function dispose(): void {
    flushWindow();
  }

  /** 仅测用：当前缓冲长度 */
  function pendingCount(): number {
    return buffer.length;
  }

  return { ingestOne, ingestMany, flushWindow, dispose, pendingCount };
}

export type QqEventsAggregator = ReturnType<typeof createQqEventsAggregator>;
