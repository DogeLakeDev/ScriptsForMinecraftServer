/** CLI 支持的语言（中英双语）。 */
export type Locale = "zh-CN" | "en";

export const LOCALES: readonly Locale[] = ["zh-CN", "en"] as const;

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "zh-CN" || value === "en";
}

/** 规范化用户输入：zh / cn / zh-cn → zh-CN；en / en-us → en。 */
export function normalizeLocale(raw: string | undefined | null): Locale | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase().replace(/_/g, "-");
  if (s === "zh" || s === "zh-cn" || s === "zh-hans" || s === "cn" || s === "chinese") return "zh-CN";
  if (s === "en" || s === "en-us" || s === "en-gb" || s === "english") return "en";
  return null;
}
