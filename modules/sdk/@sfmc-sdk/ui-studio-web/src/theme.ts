/**
 * theme.ts — Studio 外观偏好（浅色 / 深色 / 跟随系统）。
 *
 * 颜色令牌在 theme.css，靠 <html data-theme="light|dark"> 切换。
 * 偏好写入 localStorage，与 IndexedDB 一样绑在固定 origin（127.0.0.1:3003）。
 * index.html 内联脚本用同一 STORAGE_KEY，避免首屏闪深色。
 */

export type ThemePref = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "sfmc-ui-studio-theme";

const PREF_ORDER: ThemePref[] = ["system", "light", "dark"];

export const THEME_PREF_LABEL: Record<ThemePref, string> = {
  system: "跟随系统",
  light: "浅色",
  dark: "深色",
};

/** 读取已保存的外观偏好；非法值回退为跟随系统。 */
export function readThemePref(): ThemePref {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    // 无痕/禁用存储时忽略。
  }
  return "system";
}

/** 根据偏好与系统配色解析出实际 data-theme。 */
export function resolveTheme(pref: ThemePref, systemDark: boolean): ResolvedTheme {
  if (pref === "light") return "light";
  if (pref === "dark") return "dark";
  return systemDark ? "dark" : "light";
}

/** 当前系统是否偏好深色。 */
export function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** 把解析结果写到 <html data-theme>。 */
export function applyResolvedTheme(theme: ResolvedTheme): void {
  document.documentElement.setAttribute("data-theme", theme);
}

/** 按偏好解析并应用到文档。 */
export function syncDocumentTheme(pref: ThemePref = readThemePref()): ResolvedTheme {
  const theme = resolveTheme(pref, systemPrefersDark());
  applyResolvedTheme(theme);
  return theme;
}

/** 保存偏好并立刻应用到文档。 */
export function setThemePref(pref: ThemePref): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // 写失败仍应用本次会话。
  }
  syncDocumentTheme(pref);
}

/** 在 跟随系统 → 浅色 → 深色 之间循环。 */
export function cycleThemePref(pref: ThemePref): ThemePref {
  const index = PREF_ORDER.indexOf(pref);
  return PREF_ORDER[(index + 1) % PREF_ORDER.length]!;
}
