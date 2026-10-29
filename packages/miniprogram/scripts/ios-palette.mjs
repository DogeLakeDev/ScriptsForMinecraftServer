// @ts-check
/**
 * ios-palette.mjs — 小程序的 iOS 27 颜色令牌（纯数据）
 *
 * 使用场景：build-assets.mjs 生成 styles/palette.wxss 时，用这里的色值覆盖桌面端 @sfmc-bds/ui 的 palette.ts，
 * 让小程序呈现 iOS 27 的系统配色；--c-* 变量命名仍由桌面端 paletteVariables 决定，页面与组件无需改名。
 *
 * 色值摘自 Figma 社区文件「iOS 27 Builder」的 Colors 变量集合（Light / Dark 两个模式），
 * 变量名即 Apple 的 API 名（Labels/Primary = UIColor.label，Fills/Tertiary = tertiarySystemFill），
 * 同步 Kit 时只改 IOS_COLORS，不要在别处写死这些色值。
 */

/**
 * iOS 27 Builder 的颜色变量：变量名 → [浅色, 深色]。
 * 使用场景：IOS_TOKEN_MAP 与 IOS_EXTRA_TOKENS 只引用这里的名称；带透明度的值写成 8 位十六进制，生成时转为 rgba()。
 */
export const IOS_COLORS = {
  "Backgrounds/Primary": ["#ffffff", "#000000"],
  "Backgrounds/Grouped-Primary": ["#f2f2f7", "#000000"],
  "Backgrounds/Grouped-Secondary": ["#ffffff", "#1c1c1e"],
  "Backgrounds/Grouped-Secondary - Elevated": ["#ffffff", "#2c2c2e"],
  "Labels/Primary": ["#000000", "#ffffff"],
  "Labels/Secondary": ["#3c3c4399", "#ebebf599"],
  "Labels/Tertiary": ["#3c3c434d", "#ebebf54d"],
  "Labels/Link": ["#007aff", "#0984ff"],
  "Separators/Non-opaque": ["#3c3c431f", "#54545880"],
  "Fills/Secondary": ["#78788029", "#78788052"],
  "Fills/Tertiary": ["#7676801f", "#7676803d"],
  "Overlays/Default": ["#00000033", "#0000007a"],
  "Grays/White": ["#ffffff", "#ffffff"],
  "Grays/Gray": ["#8e8e93", "#8e8e93"],
  "Accents/Blue": ["#0088ff", "#0091ff"],
  "Accents/Green": ["#34c759", "#30d158"],
  "Accents/Orange": ["#ff8d28", "#ff9230"],
  "Accents/Red": ["#ff383c", "#ff4245"],
  "Accents/Indigo": ["#6155f5", "#6d7cff"],
  "Accents/Purple": ["#cb30e0", "#db34f2"],
  "Accents/Teal": ["#00c3d0", "#00d2e0"],
  "Accents/Pink": ["#ff2d55", "#ff375f"],
  "Accents/Yellow": ["#ffcc00", "#ffd600"],
  "Accents/Cyan": ["#00c0e8", "#3cd3fe"],
  "Accents/Mint": ["#00c8b3", "#00dac3"],
  "Miscellaneous/Segmented Control - Selected Fill": ["#ffffff", "#636366"],
  // Kit 中浅色与深色是两个独立变量（Color/Material/SystemBlur/Chrome-Light、Chrome-DarkA），这里合成一对
  "Materials/Chrome": ["#ffffffbf", "#1c1c1ce5"],
};

/** @typedef {keyof typeof IOS_COLORS} IosColorName */

/**
 * 桌面端色板键 → iOS 变量名。
 * 使用场景：覆盖 palette.ts 中有 iOS 对应物的令牌；未列出的键（ring、selection、shadowPop）iOS 没有对应变量，沿用桌面端取值。
 * 状态色的映射依据 Kit 的 Button 组件：Bordered 样式是 Fills/Tertiary 底 + 强调色文字（含 Destructive），
 * Prominent 样式是强调色底 + 白字，所以 *Soft 统一取 Fills/Tertiary，*Text 与实色同为强调色。
 * 图标底块按 Kit「_Row Image」的 Symbol Tile（设置页样式）：强调色实底 + 白色图标。
 * @type {Record<string, IosColorName>}
 */
export const IOS_TOKEN_MAP = {
  bg: "Backgrounds/Grouped-Primary",
  chrome: "Backgrounds/Grouped-Primary",
  elevated: "Backgrounds/Grouped-Secondary - Elevated",
  block: "Backgrounds/Grouped-Secondary",
  pastel1: "Accents/Blue",
  pastel2: "Accents/Indigo",
  onPastel: "Grays/White",
  text: "Labels/Primary",
  text2: "Labels/Secondary",
  text3: "Labels/Secondary",
  text4: "Labels/Tertiary",
  line: "Separators/Non-opaque",
  fill: "Fills/Tertiary",
  fill2: "Fills/Secondary",
  primary: "Accents/Blue",
  primaryHover: "Accents/Blue",
  onPrimary: "Grays/White",
  accent: "Accents/Blue",
  inverse: "Labels/Primary",
  onInverse: "Backgrounds/Primary",
  glass: "Materials/Chrome",
  scrim: "Overlays/Default",
  success: "Accents/Green",
  successText: "Accents/Green",
  successSoft: "Fills/Tertiary",
  info: "Accents/Blue",
  infoText: "Accents/Blue",
  infoSoft: "Fills/Tertiary",
  progress: "Accents/Indigo",
  progressText: "Accents/Indigo",
  progressSoft: "Fills/Tertiary",
  warning: "Accents/Orange",
  warningText: "Accents/Orange",
  warningSoft: "Fills/Tertiary",
  danger: "Accents/Red",
  dangerText: "Accents/Red",
  dangerSoft: "Fills/Tertiary",
  onDanger: "Grays/White",
  tileBlue: "Accents/Blue",
  onTileBlue: "Grays/White",
  tileGreen: "Accents/Green",
  onTileGreen: "Grays/White",
  tileOrange: "Accents/Orange",
  onTileOrange: "Grays/White",
  tileViolet: "Accents/Purple",
  onTileViolet: "Grays/White",
  tileTeal: "Accents/Teal",
  onTileTeal: "Grays/White",
  tilePink: "Accents/Pink",
  onTilePink: "Grays/White",
};

/**
 * 小程序独有的扩展令牌（桌面端色板没有这些键），同样生成为 --c-* 变量。
 * 使用场景：link → 文字链接（iOS 区分 link 与 systemBlue）；toggleOn → 开关打开态；
 * segmentedSelected → 分段控件选中块；gray → 中性图标底块；onTint → 实色底上的白色图标与文字。
 * @type {Record<string, IosColorName>}
 */
export const IOS_EXTRA_TOKENS = {
  link: "Labels/Link",
  toggleOn: "Accents/Green",
  segmentedSelected: "Miscellaneous/Segmented Control - Selected Fill",
  gray: "Grays/Gray",
  onTint: "Grays/White",
};

/**
 * 状态色的浅色底（iOS 的 tinted 样式：强调色 + 浅透明度），同样生成为 --c-* 变量（如 warningTint → --c-warning-tint）。
 * 透明度不另取常量，沿用 Kit 的 TINT_ALPHA_SOURCE（Fills/Tertiary：浅色 12%、深色 24%），与灰色填充底处在同一层级。
 * 使用场景：提示条 .callout 的底色，文字与图标用同色系的 *Text（*Soft 仍是 Bordered 按钮、徽章用的灰色填充底）。
 * @type {Record<string, IosColorName>}
 */
export const IOS_TINT_TOKENS = {
  successTint: "Accents/Green",
  infoTint: "Accents/Blue",
  progressTint: "Accents/Indigo",
  warningTint: "Accents/Orange",
  dangerTint: "Accents/Red",
};
/** IOS_TINT_TOKENS 的透明度来源（取该色值 #rrggbbaa 的 aa） */
const TINT_ALPHA_SOURCE = "Fills/Tertiary";

/**
 * 图表色（--chart-1 … --chart-8）→ iOS 强调色，下标与桌面端 palette.ts 的 CHART_COLORS 一一对应。
 * 使用场景：build-assets.mjs 生成 palette.wxss 时替换桌面端的粉彩图表色，折线图与图例改用 iOS 系统强调色（随深浅色切换）。
 * 映射规则：每个桌面端颜色取色相最接近、且未被前面下标占用的强调色，保持原有曲线的色系（TPS 蓝、在线玩家绿、下界红……）：
 * 灰蓝 → Cyan、薄荷 → Mint、蓝 → Blue、紫 → Purple、绿 → Green、靛 → Indigo、黄 → Yellow、珊瑚 → Red。
 * @type {IosColorName[]}
 */
export const IOS_CHART_COLORS = [
  "Accents/Cyan",
  "Accents/Mint",
  "Accents/Blue",
  "Accents/Purple",
  "Accents/Green",
  "Accents/Indigo",
  "Accents/Yellow",
  "Accents/Red",
];

/**
 * 把 #rrggbb / #rrggbbaa 转成小程序各端都支持的写法（带透明度的转为 rgba()）。
 * @param {string} hex
 */
function toCssColor(hex) {
  if (hex.length !== 9) return hex;
  const [r, g, b, a] = [1, 3, 5, 7].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 100) / 100})`;
}

/**
 * 取一套主题的 iOS 令牌（含扩展令牌），键名与桌面端 Palette 相同。
 * 使用场景：build-assets.mjs 的 buildPalette 与桌面端色板合并后写出 palette.wxss。
 * @param {"light" | "dark"} theme
 * @returns {Record<string, string>}
 */
export function iosPalette(theme) {
  const index = theme === "light" ? 0 : 1;
  /** @type {Record<string, string>} */
  const palette = {};
  for (const [key, name] of Object.entries({ ...IOS_TOKEN_MAP, ...IOS_EXTRA_TOKENS })) {
    palette[key] = toCssColor(IOS_COLORS[name][index]);
  }
  const alpha = IOS_COLORS[TINT_ALPHA_SOURCE][index].slice(7);
  for (const [key, name] of Object.entries(IOS_TINT_TOKENS)) {
    const base = IOS_COLORS[name][index];
    if (base.length !== 7 || alpha.length !== 2) throw new Error(`${key} 需要不透明的强调色与带透明度的 ${TINT_ALPHA_SOURCE}`);
    palette[key] = toCssColor(base + alpha);
  }
  return palette;
}

/**
 * 取一套主题的图表色，顺序同 IOS_CHART_COLORS。
 * 使用场景：build-assets.mjs 替换 paletteVariables 输出中的 --chart-* 变量。
 * @param {"light" | "dark"} theme
 * @returns {string[]}
 */
export function iosChartColors(theme) {
  const index = theme === "light" ? 0 : 1;
  return IOS_CHART_COLORS.map((name) => toCssColor(IOS_COLORS[name][index]));
}
