/**
 * commands/reply-official.ts — 官方 ReplyPort（群 / C2C）
 */

import { sendC2cMessage, sendGroupMessage, type QqOfficialCredentials } from "@sfmc-bds/sdk/node/qq-official";
import { log } from "../log.js";
import { officialPlainFallback, splitMarkdownMessage, splitMessage } from "./message-text.js";
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
      const markdown = result.markdown?.trim() ?? "";
      // 有 Markdown 时按表格边界拆段，避免超长世界包列表被降成纯文本。
      const parts = markdown ? splitMarkdownMessage(markdown) : splitMessage(result.text);
      for (let index = 0; index < parts.length; index++) {
        const content = parts[index]!;
        const isLast = index === parts.length - 1;
        const rendered = markdown
          ? renderOfficial({
              text: result.text,
              markdown: content,
              ...(isLast && result.buttons ? { buttons: result.buttons } : {}),
            })
          : parts.length === 1
            ? renderOfficial({ ...result, text: content })
            : renderOfficial({
                text: content,
                ...(isLast && result.buttons ? { buttons: result.buttons } : {}),
              });
        msgSeq += 1;
        const c2c = isC2c(inbound);
        const common = {
          msgType: rendered.msgType as 0 | 2,
          ...(rendered.msgType === 2
            ? { markdown: rendered.markdown ?? result.text }
            : { content: rendered.content ?? result.text }),
          ...(rendered.keyboardButtons
            ? {
                keyboardRows: Array.from({ length: Math.ceil(rendered.keyboardButtons.length / 2) }, (_, index) =>
                  rendered.keyboardButtons!.slice(index * 2, index * 2 + 2)
                ),
              }
            : {}),
          ...(target.msgId ? { msgId: target.msgId, msgSeq } : {}),
        };

        const sendOnce = async (plainFallback: boolean) => {
          if (c2c) {
            const userOpenid = c2cUserOpenid(inbound);
            if (plainFallback) {
              return sendC2cMessage(creds, {
                userOpenid,
                msgType: 0,
                content: parts.length === 1 ? officialPlainFallback(result) : content,
                ...(target.msgId ? { msgId: target.msgId, msgSeq: ++msgSeq } : {}),
              });
            }
            return sendC2cMessage(creds, { userOpenid, ...common });
          }
          if (plainFallback) {
            return sendGroupMessage(creds, {
              groupOpenid: target.groupId,
              msgType: 0,
              content: parts.length === 1 ? officialPlainFallback(result) : content,
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
            continue;
          }
          throw new Error(res.error);
        }
      }
    },
  };
}
