/**
 * types.ts — OneBot 11 / 配置 / db-server 消息载荷类型
 *
 * 只声明本进程真正用到的字段；OneBot 11 完整规范参考
 * https://github.com/botuniverse/onebot-11
 */

// ── OneBot 11 消息段 ─────────────────────────────────────────
export type OneBotSegmentType =
  | "text"
  | "at"
  | "image"
  | "face"
  | "reply"
  | "forward"
  | "record"
  | "video"
  | "file"
  | (string & {}); // 允许后续 OneBot 扩展段

export interface OneBotTextSegment {
  type: "text";
  data: { text: string };
}
export interface OneBotAtSegment {
  type: "at";
  data: { qq: string; name?: string };
}
export interface OneBotImageSegment {
  type: "image";
  data: Record<string, unknown>;
}
export interface OneBotFaceSegment {
  type: "face";
  data: Record<string, unknown>;
}
export interface OneBotReplySegment {
  type: "reply";
  data: Record<string, unknown>;
}
export interface OneBotForwardSegment {
  type: "forward";
  data: Record<string, unknown>;
}
export interface OneBotRecordSegment {
  type: "record";
  data: Record<string, unknown>;
}
export interface OneBotVideoSegment {
  type: "video";
  data: Record<string, unknown>;
}
export interface OneBotFileSegment {
  type: "file";
  data: Record<string, unknown>;
}
export interface OneBotUnknownSegment {
  type: string;
  data: Record<string, unknown>;
}
export type OneBotSegment =
  | OneBotTextSegment
  | OneBotAtSegment
  | OneBotImageSegment
  | OneBotFaceSegment
  | OneBotReplySegment
  | OneBotForwardSegment
  | OneBotRecordSegment
  | OneBotVideoSegment
  | OneBotFileSegment
  | OneBotUnknownSegment;

// ── OneBot 11 事件 ────────────────────────────────────────────
export interface OneBotSender {
  user_id: number;
  nickname: string;
  card?: string;
  [k: string]: unknown;
}

export interface OneBotGroupMessageEvent {
  post_type: "message";
  message_type: "group";
  sub_type?: string;
  self_id: number | string;
  user_id: number;
  group_id: number;
  message_id: number | string;
  sender: OneBotSender;
  message: OneBotSegment[] | string;
  raw_message?: string;
  time?: number;
  [k: string]: unknown;
}

export interface OneBotLifecycleEvent {
  post_type: "meta_event";
  meta_event_type: "lifecycle";
  self_id: number | string;
  sub_type?: string;
  [k: string]: unknown;
}

export type OneBotMessageEvent = OneBotGroupMessageEvent;
export type OneBotEvent = OneBotGroupMessageEvent | OneBotLifecycleEvent | { [k: string]: unknown };

// ── 运行时配置 (从 configs/qq_config.json 读入) ───────────────
export interface QQBridgeConfig {
  qq_enabled: boolean;
  qq_ws_port: number;
  qq_group_id: string;
  bridge_channel_id: string;
  db_host: string;
  db_port: number;
  mctoqq_prefix: string;
  [k: string]: unknown;
}

// ── POST 到 db-server 的消息载荷 ──────────────────────────────
export interface IncomingChatMessage {
  id: string;
  channelId: string;
  fromid: string;
  fromName: string;
  type: "text";
  content: string;
  showTimestamp: boolean;
  timestamp: number;
}

export interface PostMessagesBody {
  messages: IncomingChatMessage[];
}

export interface PostMessagesResponse {
  ok: boolean;
  received?: number;
  [k: string]: unknown;
}
