/**
 * domain/qq-events.ts — MC 事件推群聚合（节流）
 *
 * join/leave/death → 窗口内聚合一条；crash/start → 先 flush 再立即推。
 * 出站走 sendGroupOutbound（正文含 [MC事件] 头）。
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

/** 窗口内条数上限：提前 flush，避免一次堆太多 */
export const MAX_WINDOW_EVENTS = 20;

/** SAPI damageSource.cause → 中文（未知保留原文） */
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
  // 常见生物名（若上层把实体名塞进 cause）
  zombie: "僵尸",
  skeleton: "骷髅",
  creeper: "苦力怕",
  player: "玩家",
};

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
  /** 可注入：单测用假时钟 / 假定时器 */
  setTimeoutFn?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeoutFn?: (id: ReturnType<typeof setTimeout>) => void;
  send?: (text: string) => void;
};

/**
 * 格式化窗口内聚合正文（不含头，或含头由调用方拼）。
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
