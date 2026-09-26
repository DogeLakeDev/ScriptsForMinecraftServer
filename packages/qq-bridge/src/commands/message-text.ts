import type { CommandResult } from "./types.js";

/** 官方 Markdown 发送失败时，菜单以简洁文本呈现；按钮命令不重复写入正文。 */
export function officialPlainFallback(result: CommandResult): string {
  if (!result.menu || !result.buttons?.length) return result.text;
  const items = result.buttons
    .filter((button) => button.command !== "/menu")
    .map((button) => `${button.label}${button.description ? ` · ${button.description}` : ""}`);
  const home = result.buttons.some((button) => button.command === "/menu")
    ? ["", "发送「菜单」返回首页。"]
    : [];
  return [result.text, "", ...items, ...home].join("\n");
}

/** 保守的 UTF-8 字节预算；优先按行拆分，超长行按码点拆分。 */
export function splitMessage(text: string, maxBytes = 3000): string[] {
  const parts: string[] = [];
  let current = "";
  for (const line of text.split(/(?<=\n)/u)) {
    if (Buffer.byteLength(current + line, "utf8") <= maxBytes) {
      current += line;
      continue;
    }
    if (current) {
      parts.push(current);
      current = "";
    }
    for (const char of line) {
      if (Buffer.byteLength(current + char, "utf8") > maxBytes) {
        parts.push(current);
        current = "";
      }
      current += char;
    }
  }
  if (current) parts.push(current);
  return parts.length ? parts : [""];
}
