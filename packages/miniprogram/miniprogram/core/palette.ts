/**
 * palette.ts — 在脚本里按当前主题读取色板颜色
 *
 * 使用场景：canvas 绘制（components/line-chart 折线图、pages/map 地图底色）与 wx API 参数（showModal 的 confirmColor）
 * 读不到 CSS 变量，统一从这里取色。颜色表由 scripts/build-assets.mjs 生成到 vendor/palette.js，
 * 与 styles/palette.wxss 是同一份数据（iOS 27 色板），因此脚本里不再手写色值。
 */
import { PALETTE_VARIABLES, type PaletteVariable } from "../vendor/palette";

export type { PaletteVariable };

/** 小程序的两种系统主题 */
export type ThemeName = "light" | "dark";

/** 当前系统主题。未开启深色模式或取不到时按浅色处理。 */
export function currentTheme(): ThemeName {
  return wx.getAppBaseInfo().theme === "dark" ? "dark" : "light";
}

/** 取一个色板变量（例如 "--c-text-3"）在指定主题下的颜色，默认当前主题 */
export function paletteColor(name: PaletteVariable, theme: ThemeName = currentTheme()): string {
  return PALETTE_VARIABLES[theme][name];
}

/**
 * 把「颜色值或色板变量名」解析成实际颜色：以 -- 开头的按色板变量取当前主题的值，其余原样返回。
 * 使用场景：折线图的 series.color，总览页传入 "--chart-3" 这类变量名，深浅色切换后重绘即可换色；旧调用传色值仍然可用。
 */
export function resolveColor(color: string, theme: ThemeName = currentTheme()): string {
  if (!color.startsWith("--")) return color;
  return PALETTE_VARIABLES[theme][color as PaletteVariable] ?? color;
}
