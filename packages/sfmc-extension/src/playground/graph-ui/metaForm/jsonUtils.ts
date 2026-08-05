/**
 * 控件文本 ↔ 值互转工具：被 NestedForm 与 MetaPropForm 共享。
 */

/** 把控件输入的字符串解析成对象（容错）；非法 / 非对象 / 空串返回 null。 */
export function safeParseObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** 把任意值序列化为可粘贴到控件的 JSON 文本。null/undefined → 空串。 */
export function jsonToText(value: unknown): string {
  if (value == null) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** 把任意值序列化为适合 textarea 显示的文本；不是对象 → 走 JSON.stringify。 */
export function jsonFieldText(raw: unknown): string {
  if (raw === undefined || raw === null) return "";
  if (typeof raw === "string") return raw;
  try {
    return JSON.stringify(raw, null, 2);
  } catch {
    return String(raw);
  }
}
