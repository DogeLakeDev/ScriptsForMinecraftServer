/** 菜单与信息卡统一排版，避免正文和操作区重复列出指令。 */
import type { CommandButton, CommandResult, RegisteredCommand } from "./types.js";

export function pickDisplayLabel(cmd: RegisteredCommand, maxChars = 8): string {
  const candidates = [cmd.name, ...cmd.aliases].map((name) => name.replace(/^[/／]+/, "").trim()).filter(Boolean);
  return (candidates.find((name) => /[\u4e00-\u9fff]/.test(name)) ?? candidates[0] ?? cmd.name).slice(0, maxChars);
}

export function formatCard(title: string, lines: string[]): CommandResult {
  return {
    text: [`SFMC · ${title}`, "────────────", ...lines].join("\n"),
    markdown: [`## SFMC · ${title}`, "", ...lines].join("\n"),
  };
}

export function formatCommandMenu(opts: {
  title: string;
  subtitle: string;
  cmds: RegisteredCommand[];
  idPrefix: string;
  footerMd: string;
  footerText: string;
  home?: boolean;
}): CommandResult {
  const buttons: CommandButton[] = opts.cmds.map((cmd) => ({
    id: `${opts.idPrefix}_${cmd.name}`,
    label: pickDisplayLabel(cmd),
    description: cmd.description,
    command: `/${cmd.name}`,
  }));
  const card = formatCard(opts.title, [opts.subtitle]);
  return {
    ...card,
    menu: opts.home ? "home" : "section",
    markdown: [
      card.markdown,
      "",
      ...buttons.map((b) => `**${b.label}** · ${b.description}`),
      ...(opts.footerMd ? ["", opts.footerMd] : []),
    ].join("\n"),
    text: card.text + (opts.footerText ? `\n${opts.footerText}` : ""),
    buttons,
  };
}
