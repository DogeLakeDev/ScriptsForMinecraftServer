import { getLocale, normalizeLocale, persistLocale, t } from "./i18n/index.js";
import { ROOT } from "./runtime.js";
import { c } from "./theme.js";

/** `sfmc locale [zh-CN|en]` — 查看或设置 CLI 语言并写入 runtime.json。 */
export function cmdLocale(args: string[]): string {
  const raw = args[0];
  if (!raw) {
    return c.text(t("locale.current", { locale: getLocale() }));
  }
  const locale = normalizeLocale(raw);
  if (!locale) {
    return c.red(t("locale.invalid", { value: raw })) + "\n" + c.dim(t("locale.usage"));
  }
  persistLocale(ROOT, locale);
  return c.green(t("locale.set", { locale }));
}
