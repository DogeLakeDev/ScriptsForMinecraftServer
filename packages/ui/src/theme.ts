/** desktop 与 UI Studio 的 SnowUI 令牌与字体；不依赖 Electron 或 Monaco。 */
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/noto-sans-sc";
import cjkPunctuationUrl from "@fontsource-variable/noto-sans-sc/files/noto-sans-sc-latin-wght-normal.woff2?url";

/** 一套主题的全部颜色令牌（键名转为 kebab-case 后写成 --c-* 变量） */
export interface Palette {
  /** Background/1：窗口、侧栏、标题栏与内容区底色 */
  bg: string;
  /** 侧栏与标题栏底色 */
  chrome: string;
  /** 对话框等浮起的表面 */
  elevated: string;
  /** Background/2：区块（Block）与卡片底色 */
  block: string;
  /** 图标与信息色块，文字随主题调整 */
  pastel1: string;
  pastel2: string;
  onPastel: string;
  /** 文字层级：100% / 64%（说明文字）/ 40%（元信息）/ 20%（禁用、分隔符） */
  text: string;
  text2: string;
  text3: string;
  text4: string;
  /** 0.5px 发丝线（Black 10%） */
  line: string;
  /** 浅填充（Black 4%）：搜索框、选中导航、次级按钮 */
  fill: string;
  /** 较强填充：悬停/按下 */
  fill2: string;
  /** 主按钮（单色：浅色为近黑，深色为白） */
  primary: string;
  primaryHover: string;
  onPrimary: string;
  /** 强调色：焦点环、链接、进度条、图表主线 */
  accent: string;
  ring: string;
  /** 反色面：提示气泡 */
  inverse: string;
  onInverse: string;
  /** 毛玻璃浮层底色（配合 backdrop-filter: blur(40px)） */
  glass: string;
  /** 对话框遮罩 */
  scrim: string;
  /** 浮层阴影 */
  shadowPop: string;
  /** 文本选区 */
  selection: string;
  /** 状态语气：实色（状态点/图标）、文字色（满足对比度）、柔和底色 */
  success: string;
  successText: string;
  successSoft: string;
  info: string;
  infoText: string;
  infoSoft: string;
  progress: string;
  progressText: string;
  progressSoft: string;
  warning: string;
  warningText: string;
  warningSoft: string;
  danger: string;
  dangerText: string;
  dangerSoft: string;
}

/** SnowUI 次级色板（图表与日志来源色），两套主题共用 */
export const CHART_COLORS = [
  "#a0bce8",
  "#6be6d3",
  "#7dbbff",
  "#b899eb",
  "#71dd8c",
  "#9f9ff8",
  "#ffc555",
  "#ff9f87",
] as const;

/** 浅色与深色两套调色板 */
export const PALETTES: Record<"light" | "dark", Palette> = {
  light: {
    bg: "#f5f5f6",
    chrome: "#f5f5f6",
    elevated: "#f5f5f6",
    block: "#ffffff",
    pastel1: "#e6f1fd",
    pastel2: "#edeefc",
    onPastel: "#1c1c1c",
    text: "#1c1c1c",
    text2: "rgba(28, 28, 28, 0.64)",
    text3: "rgba(28, 28, 28, 0.55)",
    text4: "rgba(28, 28, 28, 0.2)",
    line: "rgba(28, 28, 28, 0.1)",
    fill: "rgba(28, 28, 28, 0.04)",
    fill2: "rgba(28, 28, 28, 0.08)",
    primary: "#1c1c1c",
    primaryHover: "#3a3a3a",
    onPrimary: "#ffffff",
    accent: "#1c1c1c",
    ring: "rgba(28, 28, 28, 0.16)",
    inverse: "#1c1c1c",
    onInverse: "#ffffff",
    glass: "rgba(255, 255, 255, 0.82)",
    scrim: "rgba(28, 28, 28, 0.16)",
    shadowPop:
      "0 0 0 0.5px rgba(28, 28, 28, 0.1), 0 4px 12px rgba(28, 28, 28, 0.05), 0 16px 40px rgba(28, 28, 28, 0.08)",
    selection: "rgba(138, 140, 217, 0.28)",
    success: "#4aa785",
    successText: "#2e7d60",
    successSoft: "rgba(74, 167, 133, 0.12)",
    info: "#59a8d4",
    infoText: "#2f7aa6",
    infoSoft: "rgba(89, 168, 212, 0.14)",
    progress: "#8a8cd9",
    progressText: "#5b5ec2",
    progressSoft: "rgba(138, 140, 217, 0.16)",
    warning: "#ffc555",
    warningText: "#9a6200",
    warningSoft: "rgba(255, 197, 85, 0.2)",
    danger: "#ff4747",
    dangerText: "#d92d2d",
    dangerSoft: "rgba(255, 71, 71, 0.1)",
  },
  dark: {
    bg: "#17191c",
    chrome: "#1c1f23",
    elevated: "#25292e",
    block: "#202327",
    pastel1: "#253849",
    pastel2: "#303047",
    onPastel: "#dfe5f5",
    text: "#e8eaed",
    text2: "#b5bac1",
    text3: "#9299a3",
    text4: "#626b76",
    line: "rgba(232, 234, 237, 0.1)",
    fill: "rgba(232, 234, 237, 0.055)",
    fill2: "rgba(232, 234, 237, 0.095)",
    primary: "#e1e5eb",
    primaryHover: "#f1f3f6",
    onPrimary: "#202327",
    accent: "#b5b8ed",
    ring: "rgba(181, 184, 237, 0.22)",
    inverse: "#2c3138",
    onInverse: "#e8eaed",
    glass: "rgba(37, 41, 46, 0.96)",
    scrim: "rgba(0, 0, 0, 0.56)",
    shadowPop: "0 0 0 1px rgba(232, 234, 237, 0.1), 0 8px 24px rgba(0, 0, 0, 0.24), 0 24px 56px rgba(0, 0, 0, 0.3)",
    selection: "rgba(181, 184, 237, 0.24)",
    success: "#69bc97",
    successText: "#8bd4b0",
    successSoft: "rgba(105, 188, 151, 0.12)",
    info: "#75a9d4",
    infoText: "#9ac8ed",
    infoSoft: "rgba(117, 169, 212, 0.12)",
    progress: "#999edb",
    progressText: "#b5b8ed",
    progressSoft: "rgba(153, 158, 219, 0.13)",
    warning: "#dcb36b",
    warningText: "#edc98d",
    warningSoft: "rgba(220, 179, 107, 0.12)",
    danger: "#eb7777",
    dangerText: "#f39b9b",
    dangerSoft: "rgba(235, 119, 119, 0.12)",
  },
};

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
  for (const [key, value] of Object.entries(palette)) {
    root.style.setProperty(
      `--c-${key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`).replace(/(\d)/, "-$1")}`,
      value
    );
  }
  CHART_COLORS.forEach((color, index) => root.style.setProperty(`--chart-${index + 1}`, color));
  root.style.setProperty("--font-sans", FONT_SANS);
  root.style.setProperty("--font-mono", FONT_MONO);
}
