/**
 * commands/reply-official.ts — 官方 ReplyPort（群 / C2C）
 */

import {
  sendC2cMessage,
  sendGroupMessage,
  type QqOfficialCredentials,
} from "@sfmc-bds/sdk/node/qq-official";
import { log } from "../log.js";
import { renderOfficial } from "./render.js";
import type { CommandResult, InboundMessage, ReplyPort, ReplyTarget } from "./types.js";

function isC2c(inbound: InboundMessage): boolean {
  return inbound.scene === "c2c" || inbound.groupId.startsWith("c2c:");
}

function c2cUserOpenid(inbound: InboundMessage): string {
  if (inbound.groupId.startsWith("c2c:")) return inbound.groupId.slice("c2c:".length);
  return inbound.userId;
}

export function createOfficialReplyPort(creds: QqOfficialCredentials): ReplyPort {
  let msgSeq = 0;
  return {
    async send(target: ReplyTarget, result: CommandResult, inbound: InboundMessage): Promise<void> {
      const rendered = renderOfficial(result);
      msgSeq += 1;
      const c2c = isC2c(inbound);
      const common = {
        msgType: rendered.msgType as 0 | 2,
        ...(rendered.msgType === 2
          ? { markdown: rendered.markdown ?? result.text }
          : { content: rendered.content ?? result.text }),
        ...(rendered.keyboardButtons ? { keyboardButtons: rendered.keyboardButtons } : {}),
        ...(target.msgId ? { msgId: target.msgId, msgSeq } : {}),
      };

      const sendOnce = async (plainFallback: boolean) => {
        if (c2c) {
          const userOpenid = c2cUserOpenid(inbound);
          if (plainFallback) {
            return sendC2cMessage(creds, {
              userOpenid,
              msgType: 0,
              content: result.text,
              ...(target.msgId ? { msgId: target.msgId, msgSeq: ++msgSeq } : {}),
            });
          }
          return sendC2cMessage(creds, { userOpenid, ...common });
        }
        if (plainFallback) {
          return sendGroupMessage(creds, {
            groupOpenid: target.groupId,
            msgType: 0,
            content: result.text,
            ...(target.msgId ? { msgId: target.msgId, msgSeq: ++msgSeq } : {}),
          });
        }
        return sendGroupMessage(creds, { groupOpenid: target.groupId, ...common });
      };

      const res = await sendOnce(false);
      if (!res.ok) {
        if (rendered.msgType === 2) {
          log.warn(`官方 Markdown 发送失败，降级文本: ${res.error}`);
          const plain = await sendOnce(true);
          if (!plain.ok) throw new Error(plain.error);
          return;
        }
        throw new Error(res.error);
      }
    },
  };
}
