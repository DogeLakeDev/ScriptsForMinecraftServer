/**
 * domain/qq-events.ts — Minecraft 服务器事件群推送
 *
 * 推送策略：所有事件（join / leave / death / crash / start / stop）收到即单条实时发送，不做窗口缓冲与合并。
 */

import {
  DEFAULT_QQ_EVENTS,
  type QqEventsConfig,
} from "@sfmc-bds/sdk/node/config";

import type { OutboundConfig } from "./bridge.js";
import { sendGroupOutbound } from "./bridge.js";

export type QqEventType = "join" | "leave" | "death" | "crash" | "start" | "stop";

export type QqEventPayload = {
  type: QqEventType;
  player?: string;
  cause?: string;
  detail?: string;
};

export type ResolvedQqEventsConfig = Required<QqEventsConfig>;

/** 玩家类事件：必须携带 player 字段。 */
const PLAYER_TYPES = new Set<QqEventType>(["join", "leave", "death"]);
/** BDS 运行态事件：无需 player 字段。 */
const LIFECYCLE_TYPES = new Set<QqEventType>(["crash", "start", "stop"]);

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
 * 旧配置中遗留的 window_sec 不再读取；写回时随 qq_events 整体覆盖而被移除。
 *
 * @param raw 原始配置对象。
 * @returns 规范化的完整配置对象。
 */
export function resolveQqEventsConfig(raw: unknown): ResolvedQqEventsConfig {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    enabled: o.enabled === undefined ? DEFAULT_QQ_EVENTS.enabled : o.enabled === true,
    join: o.join === undefined ? DEFAULT_QQ_EVENTS.join : o.join === true,
    leave: o.leave === undefined ? DEFAULT_QQ_EVENTS.leave : o.leave === true,
    death: o.death === undefined ? DEFAULT_QQ_EVENTS.death : o.death === true,
    crash: o.crash === undefined ? DEFAULT_QQ_EVENTS.crash : o.crash === true,
    start: o.start === undefined ? DEFAULT_QQ_EVENTS.start : o.start === true,
    stop: o.stop === undefined ? DEFAULT_QQ_EVENTS.stop : o.stop === true,
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

/**
 * 事件推送器的依赖注入。
 * 当前由 db-server index.ts 注入配置读取与出站配置；单元测试可注入 send 拦截发送。
 */
export type QqEventsDispatcherDeps = {
  getConfig: () => ResolvedQqEventsConfig;
  getOutbound: () => OutboundConfig;
  send?: (text: string) => void;
};

/**
 * 格式化单条玩家事件文本（上线 / 下线 / 死亡），每个事件独立成一条消息。
 *
 * @param type 玩家事件类型。
 * @param player 玩家名。
 * @param cause 死亡原因（仅 death 使用，可为空）。
 * @returns 单行通知文本，如「[MC事件] Steve 上线」「[MC事件] Bob 死亡（坠落）」。
 */
export function formatPlayerBody(type: "join" | "leave" | "death", player: string, cause?: string): string {
  if (type === "join") return `[MC事件] ${player} 上线`;
  if (type === "leave") return `[MC事件] ${player} 下线`;
  const c = localizeCause(cause);
  return c ? `[MC事件] ${player} 死亡（${c}）` : `[MC事件] ${player} 死亡`;
}

/**
 * 格式化 BDS 运行态事件文本（如 BDS 崩溃或启动就绪）。
 *
 * @param ev 运行态事件载荷。
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
  if (ev.type === "stop") return "[MC事件] BDS 已停止";
  return `[MC事件] ${ev.type}`;
}

export function normalizeEventPayload(raw: unknown): QqEventPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const type = String(o.type ?? "").trim() as QqEventType;
  if (!PLAYER_TYPES.has(type) && !LIFECYCLE_TYPES.has(type)) return null;
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
 * 创建 QQ 服务器事件推送器：每个事件收到后立即单条发送到群。
 * 当前由 routes/qq-events.ts 的 POST /api/sfmc/qq/events 调用。
 *
 * @param deps 依赖注入对象（配置获取、出站配置及可选的发送实现）。
 * @returns 包含 ingestOne / ingestMany 的推送器。
 */
export function createQqEventsDispatcher(deps: QqEventsDispatcherDeps) {
  const send =
    deps.send ??
    ((text: string) => {
      sendGroupOutbound(deps.getOutbound(), text);
    });

  function ingestOne(ev: QqEventPayload): { accepted: boolean; reason?: string } {
    const cfg = deps.getConfig();
    if (!isEventTypeEnabled(cfg, ev.type)) {
      return { accepted: false, reason: "disabled" };
    }

    if (LIFECYCLE_TYPES.has(ev.type)) {
      send(formatImmediateBody(ev));
      return { accepted: true };
    }

    const player = String(ev.player ?? "").trim();
    if (!player) return { accepted: false, reason: "missing_player" };

    send(formatPlayerBody(ev.type as "join" | "leave" | "death", player, ev.cause));
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

  return { ingestOne, ingestMany };
}

export type QqEventsDispatcher = ReturnType<typeof createQqEventsDispatcher>;
