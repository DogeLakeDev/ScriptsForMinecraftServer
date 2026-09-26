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

function isTableRow(line: string): boolean {
  return line.trim().startsWith("|");
}

/** 表格分隔行，例如 `| --- | --- |`。普通 `---` 分割线不算。 */
function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return false;
  const cells = trimmed.replace(/^\|/, "").replace(/\|$/, "").split("|");
  return cells.length > 0 && cells.every((cell) => /^\s*:?-{3,}:?\s*$/.test(cell));
}

function byteLength(lines: string[]): number {
  return Buffer.byteLength(lines.join("\n"), "utf8");
}

/**
 * 按行拆分 Markdown，并保证每一段里的表格仍然完整。
 * 一张表超长时，下一段重复表头，并在小节标题后标明「续」。
 * 当前给 QQ 世界包表格使用：官方消息按段发送，半张表无法渲染。
 */
export function splitMarkdownMessage(markdown: string, maxBytes = 3000): string[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const parts: string[] = [];
  let bucket: string[] = [];
  let tableHeader: string[] = [];
  let sectionTitle = "";

  const flush = (): void => {
    const text = bucket.join("\n").trim();
    if (text) parts.push(text);
    bucket = [];
  };

  const seedContinuation = (): void => {
    const seed: string[] = [];
    if (sectionTitle) seed.push(`${sectionTitle}（续）`, "");
    if (tableHeader.length) seed.push(...tableHeader);
    bucket = seed;
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    const next = lines[index + 1];
    const headerPair = isTableRow(line) && next !== undefined && isTableSeparator(next) ? [line, next] : null;
    const incoming = headerPair ?? [line];
    if (bucket.length > 0 && byteLength([...bucket, ...incoming]) > maxBytes) {
      flush();
      if (!headerPair && isTableRow(line) && !isTableSeparator(line) && tableHeader.length) seedContinuation();
    }
    if (headerPair) {
      tableHeader = headerPair;
      bucket.push(...headerPair);
      index += 1;
      continue;
    }
    if (/^###\s+/.test(line)) {
      sectionTitle = line;
      tableHeader = [];
    } else if (/^##\s+/.test(line)) {
      sectionTitle = "";
      tableHeader = [];
    }
    bucket.push(line);
  }
  flush();
  return parts.length ? parts : [""];
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
