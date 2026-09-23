import type { CommandResult } from "./types.js";

/** 文本降级必须包含完整命令，不依赖按钮仍可继续操作。 */
export function plainReply(result: CommandResult): string {
  const actions = result.buttons
    ?.map(
      (b, index) =>
        `${index + 1}. ${b.label}${result.menu && b.description ? ` · ${b.description}` : ""}\n   发送：${b.command}`
    )
    .join("\n");
  return result.text + (actions ? `\n\n${actions}` : "");
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
