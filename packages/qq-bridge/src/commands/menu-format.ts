/**
 * menu-format.ts — 主菜单 / 管理子菜单统一文案（official Markdown + llbot 纯文本）
 *
 * 两边共用同一套 label/description，保证编号会话与按钮文案一致。
 */

import type { CommandButton, CommandResult, RegisteredCommand } from "./types.js";

/** 优先中文短别名作按钮/编号标签 */
export function pickDisplayLabel(cmd: RegisteredCommand, maxChars = 8): string {
  const candidates = [cmd.name, ...cmd.aliases]
    .map((a) => String(a ?? "").replace(/^[/／]+/, "").trim())
    .filter((a) => a.length > 0);
  const zh = candidates.find((a) => /[\u4e00-\u9fff]/.test(a));
  const preferred = zh ?? candidates.find((a) => !a.startsWith("/")) ?? candidates[0] ?? cmd.name;
  return preferred.slice(0, maxChars);
}

function buttonsFor(cmds: RegisteredCommand[], idPrefix: string): CommandButton[] {
  return cmds.map((c) => ({
    id: `${idPrefix}_${c.name}`,
    label: pickDisplayLabel(c, 8),
    command: `/${c.name}`,
  }));
}

export function formatCommandMenu(opts: {
  title: string;
  subtitle: string;
  cmds: RegisteredCommand[];
  idPrefix: string;
  footerMd: string;
  footerText: string;
}): CommandResult {
  const { title, subtitle, cmds, idPrefix, footerMd, footerText } = opts;
  const textLines = cmds.map((c, i) => {
    const label = pickDisplayLabel(c, 8);
    return `${i + 1}. ${label} — ${c.description}`;
  });
  const mdLines = cmds.map((c) => {
    const label = pickDisplayLabel(c, 12);
    return `- **${label}**（\`/${c.name}\`）：${c.description}`;
  });
  return {
    text: `${title}\n${subtitle}\n\n${textLines.join("\n")}\n\n${footerText}`,
    markdown: `## ${title}\n\n${subtitle}\n\n${mdLines.join("\n")}\n\n${footerMd}`,
    buttons: buttonsFor(cmds, idPrefix),
  };
}
