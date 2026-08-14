/**
 * commands/render.ts — CommandResult → 各后端呈现载荷（无副作用）
 */

import type { QqKeyboardButton } from "@sfmc-bds/sdk/node/qq-official";
import type { CommandResult } from "./types.js";

export type OfficialRenderPayload = {
  msgType: 0 | 2;
  content?: string;
  markdown?: string;
  keyboardButtons?: QqKeyboardButton[];
};

export type LlbotRenderPayload = {
  text: string;
};

/** official：有 buttons/markdown 用 msg_type=2，否则纯文本 */
export function renderOfficial(result: CommandResult): OfficialRenderPayload {
  const buttons = result.buttons?.map((b) => ({
    id: b.id,
    label: b.label,
    data: b.command,
    ...(b.actionType !== undefined ? { actionType: b.actionType } : {}),
    ...(b.style !== undefined ? { style: b.style } : {}),
    ...(b.visitedLabel ? { visitedLabel: b.visitedLabel } : {}),
    ...(b.permission ? { permission: b.permission } : {}),
  }));
  const md = result.markdown?.trim() || undefined;
  if (md || (buttons && buttons.length > 0)) {
    const payload: OfficialRenderPayload = {
      msgType: 2,
      markdown: md ?? result.text,
    };
    if (buttons && buttons.length > 0) payload.keyboardButtons = buttons;
    return payload;
  }
  return { msgType: 0, content: result.text };
}

/** llbot：正文已含编号列表时不再重复；否则补编号行 */
export function renderLlbot(result: CommandResult): LlbotRenderPayload {
  if (!result.buttons || result.buttons.length === 0) {
    return { text: result.text };
  }
  // 主/管理菜单正文已带「1. 标签 — 说明」，避免再堆一层 [1] label
  if (/^\d+\.\s/m.test(result.text)) {
    return {
      text: `${result.text}\n\n回复数字执行（60 秒内有效）`,
    };
  }
  const lines = result.buttons.map((b, i) => `[${i + 1}] ${b.label}`);
  return {
    text: `${result.text}\n\n${lines.join("\n")}\n\n回复数字执行（60 秒内有效）`,
  };
}
