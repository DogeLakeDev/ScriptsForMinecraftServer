/**
 * official/events.ts — 官方 GROUP_AT / C2C 解析与转发
 */

import { stripOfficialAtMention } from "@sfmc-bds/sdk/node/qq-official";
import type { CommandRouter } from "../commands/index.js";
import { RecentMessageDedup } from "../onebot.js";
import { tryForward, type DBServerConfig } from "../dbserver.js";
import { log } from "../log.js";

export type OfficialAttachment = {
  url?: string;
  content_type?: string;
  filename?: string;
};

export type OfficialGroupAtMessage = {
  id?: string;
  content?: string;
  group_openid?: string;
  timestamp?: string;
  author?: {
    id?: string;
    member_openid?: string;
    username?: string;
    bot?: boolean;
    /** 若平台下发则解析；无则无法判定群管 */
    roles?: unknown;
    member_role?: unknown;
  };
  member?: {
    roles?: unknown;
    role?: unknown;
  };
  attachments?: OfficialAttachment[];
};

/** 从官方事件可选字段推断群主/群管（无可靠字段则 false） */
function detectOfficialGroupAdmin(msg: OfficialGroupAtMessage): boolean {
  const candidates: unknown[] = [
    msg.author?.member_role,
    msg.author?.roles,
    msg.member?.role,
    msg.member?.roles,
  ];
  for (const c of candidates) {
    if (c == null) continue;
    if (Array.isArray(c)) {
      const joined = c.map((x) => String(x).toLowerCase()).join(",");
      if (/\b(owner|admin|2|3)\b/.test(joined)) return true;
      continue;
    }
    const s = String(c).toLowerCase();
    if (s === "owner" || s === "admin" || s === "2" || s === "3") return true;
  }
  return false;
}

/** C2C 单聊事件体 */
export type OfficialC2cMessage = {
  id?: string;
  content?: string;
  timestamp?: string;
  author?: {
    id?: string;
    user_openid?: string;
    username?: string;
    bot?: boolean;
  };
  attachments?: OfficialAttachment[];
};

export type OfficialForwardFn = (
  db: DBServerConfig,
  fromId: string,
  fromName: string,
  content: string
) => Promise<void>;

export type OfficialDispatcherOptions = {
  /** 已配置的群 openid；空 = 只打日志不转发 */
  groupOpenid: string;
  db: DBServerConfig;
  /** 可注入，默认 tryForward（便于单测） */
  forward?: OfficialForwardFn;
  /** QQ 侧指令路由；命中则不转发 MC */
  commandRouter?: CommandRouter;
};

/**
 * 把 attachments 转成与 OneBot 一致的占位符后缀。
 */
export function attachmentsPlaceholder(attachments: OfficialAttachment[] | undefined): string {
  if (!Array.isArray(attachments) || attachments.length === 0) return "";
  const parts: string[] = [];
  for (const att of attachments) {
    const ct = String(att.content_type ?? "").toLowerCase();
    const name = String(att.filename ?? "").toLowerCase();
    if (ct.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp)$/i.test(name)) {
      parts.push("[图片]");
    } else if (ct.startsWith("video/") || /\.(mp4|mov|avi|mkv)$/i.test(name)) {
      parts.push("[视频]");
    } else if (ct.startsWith("audio/") || /\.(mp3|wav|amr|silk)$/i.test(name)) {
      parts.push("[语音]");
    } else {
      parts.push("[文件]");
    }
  }
  return parts.join("");
}

/** 从官方事件抽出纯文本（去 @bot + 附件占位） */
export function extractOfficialText(msg: {
  content?: string;
  attachments?: OfficialAttachment[];
}): string {
  const base = stripOfficialAtMention(String(msg.content ?? ""));
  const suffix = attachmentsPlaceholder(msg.attachments);
  return `${base}${suffix ? (base ? " " : "") + suffix : ""}`.trim();
}

export class OfficialAtMessageDispatcher {
  private readonly opts: OfficialDispatcherOptions;
  private readonly dedup = new RecentMessageDedup();
  private readonly forward: OfficialForwardFn;
  private loggedMissingOpenid = false;

  constructor(opts: OfficialDispatcherOptions) {
    this.opts = opts;
    this.forward = opts.forward ?? tryForward;
  }

  async handleGroupAtMessage(msg: OfficialGroupAtMessage): Promise<void> {
    if (!msg || typeof msg !== "object") return;
    if (msg.author?.bot) return;

    const groupOpenid = String(msg.group_openid ?? "");
    if (!groupOpenid) {
      log.warn("官方事件缺 group_openid，跳过");
      return;
    }

    if (!this.opts.groupOpenid) {
      if (!this.loggedMissingOpenid) {
        log.warn(
          `qq_group_openid 未配置。收到群 openid=${groupOpenid}，请写入 configs/qq_config.json 后重启（本条不转发）`
        );
        this.loggedMissingOpenid = true;
      } else {
        log.info(`qq_group_openid 未配置，丢弃群消息 openid=${groupOpenid}`);
      }
      return;
    }

    if (groupOpenid !== this.opts.groupOpenid) {
      log.info(`非目标群 openid=${groupOpenid}，跳过`);
      return;
    }

    if (this.dedup.seen(msg.id)) return;

    const text = extractOfficialText(msg);
    if (!text) return;

    const memberId = String(msg.author?.member_openid || msg.author?.id || "unknown");
    const fromName = String(msg.author?.username || `QQ_${memberId.slice(0, 8)}`);
    const fromId = `qq_${memberId}`;

    if (this.opts.commandRouter) {
      const inbound = {
        backend: "official" as const,
        scene: "group" as const,
        groupId: groupOpenid,
        userId: memberId,
        userName: fromName,
        text,
        isGroupAdmin: detectOfficialGroupAdmin(msg),
        ...(msg.id ? { msgId: String(msg.id) } : {}),
      };
      if (await this.opts.commandRouter.handle(inbound)) return;
    }

    if (!this.opts.db.channelId) {
      log.warn("bridge_channel_id 未配置，跳过");
      return;
    }

    await this.forward(this.opts.db, fromId, fromName, text);
  }

  /**
   * 单聊：仅走指令路由（菜单点击落点），不转发 MC。
   */
  async handleC2cMessage(msg: OfficialC2cMessage): Promise<void> {
    if (!msg || typeof msg !== "object") return;
    if (msg.author?.bot) return;
    if (this.dedup.seen(msg.id)) return;

    const text = extractOfficialText(msg);
    if (!text) return;

    const userId = String(msg.author?.user_openid || msg.author?.id || "unknown");
    const fromName = String(msg.author?.username || `QQ_${userId.slice(0, 8)}`);

    if (!this.opts.commandRouter) {
      log.info(`C2C 无指令路由，忽略 text=${text.slice(0, 40)}`);
      return;
    }

    const inbound = {
      backend: "official" as const,
      scene: "c2c" as const,
      groupId: `c2c:${userId}`,
      userId,
      userName: fromName,
      text,
      ...(msg.id ? { msgId: String(msg.id) } : {}),
    };
    await this.opts.commandRouter.handle(inbound);
  }
}
