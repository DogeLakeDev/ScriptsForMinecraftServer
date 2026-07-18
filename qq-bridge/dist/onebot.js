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
import { logger } from "./logger.js";
import { tryForward } from "./dbserver.js";
// ── 类型守卫 ────────────────────────────────────────────────────
function isGroupMessageEvent(e) {
    return e.post_type === "message" && e.message_type === "group";
}
function isLifecycleEvent(e) {
    return e.post_type === "meta_event" && e.meta_event_type === "lifecycle";
}
function isTextSegment(s) {
    return s?.type === "text";
}
function isAtSegment(s) {
    return s?.type === "at";
}
function isImageSegment(s) {
    return s?.type === "image";
}
function isFaceSegment(s) {
    return s?.type === "face";
}
function isReplySegment(s) {
    return s?.type === "reply";
}
function isForwardSegment(s) {
    return s?.type === "forward";
}
function isRecordSegment(s) {
    return s?.type === "record";
}
function isVideoSegment(s) {
    return s?.type === "video";
}
function isFileSegment(s) {
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
export function extractText(message) {
    if (typeof message === "string")
        return message;
    if (!Array.isArray(message))
        return "";
    const parts = [];
    for (const seg of message) {
        if (!seg || typeof seg !== "object")
            continue;
        if (isTextSegment(seg)) {
            const text = seg.data.text;
            if (typeof text === "string")
                parts.push(text);
        }
        else if (isAtSegment(seg)) {
            const name = seg.data.name ? `@${seg.data.name} ` : `@${seg.data.qq ?? "?"} `;
            parts.push(name);
        }
        else if (isImageSegment(seg)) {
            parts.push("[图片]");
        }
        else if (isFaceSegment(seg)) {
            parts.push("[表情]");
        }
        else if (isReplySegment(seg)) {
            parts.push("[回复]");
        }
        else if (isForwardSegment(seg)) {
            parts.push("[转发]");
        }
        else if (isRecordSegment(seg)) {
            parts.push("[语音]");
        }
        else if (isVideoSegment(seg)) {
            parts.push("[视频]");
        }
        else if (isFileSegment(seg)) {
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
    map = new Map();
    lastCleanup = 0;
    seen(messageId) {
        if (messageId === undefined || messageId === null)
            return false;
        const key = String(messageId);
        const now = Date.now();
        if (now - this.lastCleanup > CLEANUP_INTERVAL_MS) {
            this.lastCleanup = now;
            for (const [k, ts] of this.map) {
                if (now - ts > DEDUP_WINDOW_MS)
                    this.map.delete(k);
            }
        }
        const prev = this.map.get(key);
        if (prev !== undefined && now - prev < DEDUP_WINDOW_MS)
            return true;
        this.map.set(key, now);
        return false;
    }
}
export class OneBotDispatcher {
    botSelfId = null;
    opts;
    dedup = new RecentMessageDedup();
    constructor(opts) {
        this.opts = opts;
    }
    /** 测试/调试用 */
    get selfId() {
        return this.botSelfId;
    }
    /** 收到一条原始 JSON 字符串(已 parse) */
    async handle(rawEvent) {
        const event = rawEvent;
        if (!event || typeof event !== "object")
            return;
        if (isLifecycleEvent(event)) {
            if (event.self_id !== undefined && this.botSelfId === null) {
                this.botSelfId = String(event.self_id);
                logger.info(`LLBot self_id = ${this.botSelfId}`);
            }
            return;
        }
        if (!isGroupMessageEvent(event))
            return;
        if (!this.opts.qqGroupId || String(event.group_id) !== this.opts.qqGroupId)
            return;
        // 循环防护 1: 跳过 bot 自己发的消息回声
        if (this.botSelfId && String(event.sender?.user_id) === this.botSelfId)
            return;
        // 循环防护 2: 短期去重 (LLBot 偶发重发)
        if (this.dedup.seen(event.message_id))
            return;
        const text = extractText(event.message);
        if (!text)
            return;
        if (!this.opts.db.channelId) {
            logger.warn("bridge_channel_id 未配置,跳过 (可用 reload 重读配置)");
            return;
        }
        const senderCard = event.sender?.card;
        const senderNick = event.sender?.nickname;
        const fromName = senderCard || senderNick || `QQ_${event.user_id}`;
        const fromId = `qq_${String(event.user_id)}`;
        await tryForward(this.opts.db, fromId, fromName, text);
    }
}
//# sourceMappingURL=onebot.js.map