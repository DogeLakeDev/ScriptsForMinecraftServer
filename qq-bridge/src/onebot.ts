/**
 * onebot.ts — OneBot 11 事件分发
 *
 * 职责:
 *   1. 维护 botSelfId (从 lifecycle 元事件捕获)
 *   2. 5s 短期 message_id 去重 (防 LLBot 偶发重发)
 *   3. 群消息段 → 纯文本 (text / at / image / face / reply / forward / record / video / file)
 *   4. 命中规则后调用 tryForward 投递
 *
 * 行为与旧 index.js 完全一致; 类型上把 sender/message 都收紧为 narrow 类型。
 */

import { log } from "./log.js";
import { tryForward, type DBServerConfig } from "./dbserver.js";
import type {
  OneBotAtSegment,
  OneBotEvent,
  OneBotFaceSegment,
  OneBotFileSegment,
  OneBotForwardSegment,
  OneBotGroupMessageEvent,
  OneBotImageSegment,
  OneBotLifecycleEvent,
  OneBotRecordSegment,
  OneBotReplySegment,
  OneBotSegment,
  OneBotTextSegment,
  OneBotVideoSegment,
} from "./types.js";

// ── 类型守卫 ────────────────────────────────────────────────────
function isGroupMessageEvent(e: OneBotEvent): e is OneBotGroupMessageEvent {
  return e.post_type === "message" && e.message_type === "group";
}

function isLifecycleEvent(e: OneBotEvent): e is OneBotLifecycleEvent {
  return e.post_type === "meta_event" && e.meta_event_type === "lifecycle";
}

function isTextSegment(s: OneBotSegment | undefined): s is OneBotTextSegment {
  return s?.type === "text";
}
function isAtSegment(s: OneBotSegment | undefined): s is OneBotAtSegment {
  return s?.type === "at";
}
function isImageSegment(s: OneBotSegment | undefined): s is OneBotImageSegment {
  return s?.type === "image";
}
function isFaceSegment(s: OneBotSegment | undefined): s is OneBotFaceSegment {
  return s?.type === "face";
}
function isReplySegment(s: OneBotSegment | undefined): s is OneBotReplySegment {
  return s?.type === "reply";
}
function isForwardSegment(s: OneBotSegment | undefined): s is OneBotForwardSegment {
  return s?.type === "forward";
}
function isRecordSegment(s: OneBotSegment | undefined): s is OneBotRecordSegment {
  return s?.type === "record";
}
function isVideoSegment(s: OneBotSegment | undefined): s is OneBotVideoSegment {
  return s?.type === "video";
}
function isFileSegment(s: OneBotSegment | undefined): s is OneBotFileSegment {
  return s?.type === "file";
}

// ── 消息段 → 纯文本 ─────────────────────────────────────────
/**
 * OneBot 11 消息段数组 (或纯字符串) → 纯文本。
 * 行为与旧实现完全一致:
 *   - text:   原样拼接
 *   - at:     "@昵称 " 或 "@qq " (有 name 优先 name)
 *   - 其它:   [图片]/[表情]/[回复]/[转发]/[语音]/[视频]/[文件]
 *   - 未知段: 跳过
 */
export function extractText(message: OneBotGroupMessageEvent["message"]): string {
  if (typeof message === "string") return message;
  if (!Array.isArray(message)) return "";
  const parts: string[] = [];
  for (const seg of message) {
    if (!seg || typeof seg !== "object") continue;
    if (isTextSegment(seg)) {
      const text = seg.data.text;
      if (typeof text === "string") parts.push(text);
    } else if (isAtSegment(seg)) {
      const name = seg.data.name ? `@${seg.data.name} ` : `@${seg.data.qq ?? "?"} `;
      parts.push(name);
    } else if (isImageSegment(seg)) {
      parts.push("[图片]");
    } else if (isFaceSegment(seg)) {
      parts.push("[表情]");
    } else if (isReplySegment(seg)) {
      parts.push("[回复]");
    } else if (isForwardSegment(seg)) {
      parts.push("[转发]");
    } else if (isRecordSegment(seg)) {
      parts.push("[语音]");
    } else if (isVideoSegment(seg)) {
      parts.push("[视频]");
    } else if (isFileSegment(seg)) {
      parts.push("[文件]");
    }
    // 未知段:跳过
  }
  return parts.join("").trim();
}

// ── 短期 message_id 去重 (懒清理) ────────────────────────────
const DEDUP_WINDOW_MS = 5_000;
const CLEANUP_INTERVAL_MS = 1_000;

export class RecentMessageDedup {
  private readonly map = new Map<string, number>();
  private lastCleanup = 0;

  seen(messageId: string | number | undefined): boolean {
    if (messageId === undefined || messageId === null) return false;
    const key = String(messageId);
    const now = Date.now();
    if (now - this.lastCleanup > CLEANUP_INTERVAL_MS) {
      this.lastCleanup = now;
      for (const [k, ts] of this.map) {
        if (now - ts > DEDUP_WINDOW_MS) this.map.delete(k);
      }
    }
    const prev = this.map.get(key);
    if (prev !== undefined && now - prev < DEDUP_WINDOW_MS) return true;
    this.map.set(key, now);
    return false;
  }
}

// ── OneBot 事件分发器 ────────────────────────────────────────
export interface DispatcherOptions {
  /** 群 ID 字符串,空 = 接收所有群(旧行为:空时不匹配任何群,不会触发) */
  qqGroupId: string;
  /** db-server 配置 + 目标 channelId */
  db: DBServerConfig;
}

export class OneBotDispatcher {
  private botSelfId: string | null = null;
  private readonly opts: DispatcherOptions;
  private readonly dedup = new RecentMessageDedup();

  constructor(opts: DispatcherOptions) {
    this.opts = opts;
  }

  /** 测试/调试用 */
  get selfId(): string | null {
    return this.botSelfId;
  }

  /** 收到一条原始 JSON 字符串(已 parse) */
  async handle(rawEvent: unknown): Promise<void> {
    const event = rawEvent as OneBotEvent;
    if (!event || typeof event !== "object") return;

    if (isLifecycleEvent(event)) {
      if (event.self_id !== undefined && this.botSelfId === null) {
        this.botSelfId = String(event.self_id);
        log.info(`LLBot self_id = ${this.botSelfId}`);
      }
      return;
    }

    if (!isGroupMessageEvent(event)) return;
    if (!this.opts.qqGroupId || String(event.group_id) !== this.opts.qqGroupId) return;

    // 循环防护 1: 跳过 bot 自己发的消息回声
    if (this.botSelfId && String(event.sender?.user_id) === this.botSelfId) return;

    // 循环防护 2: 短期去重 (LLBot 偶发重发)
    if (this.dedup.seen(event.message_id)) return;

    const text = extractText(event.message);
    if (!text) return;

    if (!this.opts.db.channelId) {
      log.warn("bridge_channel_id 未配置,跳过 (可用 reload 重读配置)");
      return;
    }

    const senderCard = event.sender?.card;
    const senderNick = event.sender?.nickname;
    const fromName = senderCard || senderNick || `QQ_${event.user_id}`;
    const fromId = `qq_${String(event.user_id)}`;

    await tryForward(this.opts.db, fromId, fromName, text);
  }
}
