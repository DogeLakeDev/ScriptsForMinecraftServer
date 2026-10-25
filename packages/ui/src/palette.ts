/**
 * palette.ts — SnowUI 颜色令牌（纯数据，不引入字体或其他资源）
 *
 * 使用场景：桌面端与 UI Studio 经 theme.ts 写成 :root 上的 CSS 变量；
 * 小程序构建脚本（packages/miniprogram/scripts/build-assets.mjs）据此生成 styles/palette.wxss，两端共用同一份色值。
 */

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
  /** 危险实色（按钮、计数角标、勾选框）上的文字色：两套主题均为白字 */
  onDanger: string;
  /**
   * 多色图标底块：底色 + 图标色成对使用，参考 Android 16 设置首页每行一种颜色的图标圆底。
   * 使用场景：小程序「管理」页各入口行；按 M3 色调取值（浅色 90 底 / 30 图标，深色 30 底 / 90 图标）。
   */
  tileBlue: string;
  onTileBlue: string;
  tileGreen: string;
  onTileGreen: string;
  tileOrange: string;
  onTileOrange: string;
  tileViolet: string;
  onTileViolet: string;
  tileTeal: string;
  onTileTeal: string;
  tilePink: string;
  onTilePink: string;
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
    pastel1: "#e5eefd",
    pastel2: "#efeafd",
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
    selection: "rgba(154, 107, 242, 0.24)",
    success: "#4aa785",
    successText: "#2e7d60",
    successSoft: "rgba(74, 167, 133, 0.12)",
    info: "#3b8cf2",
    infoText: "#1f66c7",
    infoSoft: "rgba(59, 140, 242, 0.12)",
    progress: "#9a6bf2",
    progressText: "#6d3fd6",
    progressSoft: "rgba(154, 107, 242, 0.14)",
    warning: "#ffc555",
    warningText: "#9a6200",
    warningSoft: "rgba(255, 197, 85, 0.2)",
    danger: "#ff4747",
    dangerText: "#d92d2d",
    dangerSoft: "rgba(255, 71, 71, 0.1)",
    onDanger: "#ffffff",
    tileBlue: "#d6e3ff",
    onTileBlue: "#264777",
    tileGreen: "#c4eccf",
    onTileGreen: "#085231",
    tileOrange: "#ffdcc5",
    onTileOrange: "#6d390b",
    tileViolet: "#e9ddff",
    onTileViolet: "#4d3d75",
    tileTeal: "#bcebed",
    onTileTeal: "#004f52",
    tilePink: "#ffd8e8",
    onTilePink: "#6c3353",
  },
  dark: {
    // 深色按 Google Material 3 的色调角色（HCT 色调）取值，中性灰无色相：
    // 底色 #1d1d1d（色调 11，介于 surface-container-low 与 container 之间）→ 区块 17（container-high）
    // → 浮起表面 22（container-highest）；文字 90 / 80 / 60，分隔线 30（outline-variant），禁用为 on-surface 38%。
    // 彩色：实色与文字取色调 80，柔和底色取色调 30（M3 container，不透明），色度 36（与 Google 蓝 #a8c7fa 一致）。
    bg: "#1d1d1d",
    chrome: "#1f1f1f",
    elevated: "#353535",
    block: "#2a2a2a",
    pastel1: "#264777",
    pastel2: "#4d3d75",
    onPastel: "#e2e2e2",
    text: "#e2e2e2",
    text2: "#c6c6c6",
    text3: "#919191",
    text4: "rgba(226, 226, 226, 0.38)",
    line: "#474747",
    fill: "rgba(226, 226, 226, 0.06)",
    fill2: "rgba(226, 226, 226, 0.1)",
    primary: "#e2e2e2",
    primaryHover: "#f1f1f1",
    onPrimary: "#303030",
    accent: "#a9c7ff",
    ring: "rgba(169, 199, 255, 0.24)",
    // M3 inverse-surface：深色主题的提示气泡为浅色
    inverse: "#e2e2e2",
    onInverse: "#303030",
    glass: "rgba(53, 53, 53, 0.96)",
    scrim: "rgba(0, 0, 0, 0.56)",
    shadowPop: "0 0 0 1px rgba(226, 226, 226, 0.1), 0 8px 24px rgba(0, 0, 0, 0.24), 0 24px 56px rgba(0, 0, 0, 0.3)",
    selection: "rgba(169, 199, 255, 0.28)",
    success: "#8cd5b4",
    successText: "#8cd5b4",
    successSoft: "#00513a",
    info: "#a9c7ff",
    infoText: "#a9c7ff",
    infoSoft: "#264777",
    progress: "#d0bcfe",
    progressText: "#d0bcfe",
    progressSoft: "#4d3d75",
    warning: "#efbf6d",
    warningText: "#efbf6d",
    warningSoft: "#5f4100",
    // 危险实色不取 M3 的色调 80：红底要配白字，取同色相色调 50（白字对比度 4.5:1，对区块底 3.2:1）
    danger: "#d64041",
    dangerText: "#ffb3ae",
    dangerSoft: "#733330",
    onDanger: "#ffffff",
    tileBlue: "#264777",
    onTileBlue: "#d6e3ff",
    tileGreen: "#085231",
    onTileGreen: "#aef2c6",
    tileOrange: "#6d390b",
    onTileOrange: "#ffdcc5",
    tileViolet: "#4d3d75",
    onTileViolet: "#e9ddff",
    tileTeal: "#004f52",
    onTileTeal: "#9cf1f4",
    tilePink: "#6c3353",
    onTilePink: "#ffd8e8",
  },
};

/** 调色板键名对应的 CSS 变量名：tileBlue → --c-tile-blue，pastel1 → --c-pastel-1 */
export function cssVariableName(key: string): string {
  return `--c-${key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`).replace(/(\d)/, "-$1")}`;
}

/**
 * 一套主题对应的全部颜色变量（--c-* 令牌 + --chart-* 图表色），按 [变量名, 值] 列出。
 * 使用场景：桌面端 applyCssVariables 写到 :root；小程序构建脚本写进 styles/palette.wxss。
 */
export function paletteVariables(palette: Palette): [string, string][] {
  return [
    ...Object.entries(palette).map(([key, value]): [string, string] => [cssVariableName(key), value]),
    ...CHART_COLORS.map((color, index): [string, string] => [`--chart-${index + 1}`, color]),
  ];
}
