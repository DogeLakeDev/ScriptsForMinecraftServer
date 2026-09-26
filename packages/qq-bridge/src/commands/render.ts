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

/** LLBot 只输出一份操作列表，菜单说明与操作提示各出现一次。 */
export function renderLlbot(result: CommandResult): LlbotRenderPayload {
  if (!result.buttons?.length) return { text: result.text };
  const lines = result.buttons.map((button, index) => {
    const detail = result.menu && button.description ? `\n   ${button.description}` : "";
    return `${index + 1}. ${button.label}${detail}`;
  });
  return {
    text: [result.text, "", result.menu ? "" : "可选操作", lines.join("\n"), "", "请在 60 秒内回复编号选择"]
      .filter((line, index, all) => line !== "" || all[index - 1] !== "")
      .join("\n"),
  };
}
