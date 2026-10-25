/** desktop 与 UI Studio 的 SnowUI 令牌与字体；不依赖 Electron 或 Monaco。 */
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/noto-sans-sc";
import cjkPunctuationUrl from "@fontsource-variable/noto-sans-sc/files/noto-sans-sc-latin-wght-normal.woff2?url";
import { paletteVariables, type Palette } from "./palette.js";

export { CHART_COLORS, PALETTES, cssVariableName, paletteVariables, type Palette } from "./palette.js";

/**
 * 字体栈：Inter（SnowUI 规范字体）+ Noto Sans SC（中文）+ 系统中文字体兜底。
 * 最前面的 "SFMC CJK Punct" 只覆盖中文引号、破折号与省略号，让它们以全角字形显示，而不是落到 Inter 的半角字形。
 */
const FONT_SANS = `"SFMC CJK Punct", "Inter Variable", "Noto Sans SC Variable", "Microsoft YaHei UI", "PingFang SC", system-ui, sans-serif`;
/** 等宽字体栈：JetBrains Mono + 中文兜底（日志、代码、编号） */
export const FONT_MONO = `"JetBrains Mono Variable", "Noto Sans SC Variable", "Microsoft YaHei UI", Consolas, monospace`;

/** 注册中文标点字体（只注册一次；浏览器按 unicode-range 在用到时才下载） */
let punctuationRegistered = false;
export function registerPunctuationFont() {
  if (punctuationRegistered || typeof FontFace === "undefined") return;
  punctuationRegistered = true;
  const face = new FontFace("SFMC CJK Punct", `url(${cjkPunctuationUrl}) format("woff2-variations")`, {
    weight: "100 900",
    unicodeRange: "U+2014, U+2018-2019, U+201C-201D, U+2026",
    display: "swap",
  });
  document.fonts.add(face);
}

/** 把调色板写成 CSS 变量（--c-bg、--c-text-2 …），供 styles/*.css 使用 */
export function applyCssVariables(palette: Palette) {
  const root = document.documentElement;
  for (const [name, value] of paletteVariables(palette)) root.style.setProperty(name, value);
  root.style.setProperty("--font-sans", FONT_SANS);
  root.style.setProperty("--font-mono", FONT_MONO);
}
