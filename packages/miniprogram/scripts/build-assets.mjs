#!/usr/bin/env node
// @ts-check
/**
 * build-assets.mjs — 生成小程序运行时需要、但不应手抄的资源
 *
 * 使用场景：`pnpm --filter @sfmc-bds/miniprogram build`（根目录 `pnpm build` 也会执行），
 * 在用微信开发者工具打开 packages/miniprogram 之前运行一次。
 *
 * 1. miniprogram/vendor/management.js、vendor/desktop-lib.js
 *    把 @sfmc-bds/management 中的纯函数与常量（帧解析、协议版本、依赖判断等），以及桌面端渲染层
 *    lib 中的任务文案、告警合并规则打包成 CommonJS。
 *    小程序不能直接引用 workspace 包，这样这些规则仍只有一处权威来源（DRY）。
 * 2. miniprogram/styles/icons.wxss
 *    按桌面端 @sfmc-bds/ui 的语义图标表（icons.tsx 中的 ICONS）取 Tabler 描边版 SVG，
 *    生成 `.i-<语义名>` 遮罩图标类，颜色跟随 currentColor，与桌面端图标保持一致。
 *    标了 @outline 的名称改用 icons.tsx 里的路径，不读 Tabler 原图。
 * 3. miniprogram/assets/tabbar/<主题>/*.png
 *    原生标签栏图标：仍用 Phosphor（单独的 TAB_ICONS 表），按 theme.json 引用的路径与颜色渲染浅色 / 深色两套 PNG。
 * 4. miniprogram/styles/palette.wxss、vendor/palette.js
 *    以 scripts/ios-palette.mjs（iOS 27 系统配色）覆盖 @sfmc-bds/ui 的 palette.ts，写出浅色 / 深色两套 --c-* 与 --chart-* 颜色变量，
 *    并核对 theme.json 的导航栏 / 标签栏颜色与色板一致。同一份变量表另存为 vendor/palette.js，
 *    供读不到 CSS 变量的 canvas 与 wx API（core/palette.ts）使用。
 */
import { Resvg } from "@resvg/resvg-js";
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { IOS_EXTRA_TOKENS, IOS_TINT_TOKENS, iosChartColors, iosPalette } from "./ios-palette.mjs";

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appDir = path.join(packageDir, "miniprogram");

/** 小程序从 management 使用的导出。新增引用时在此追加（OCP）。 */
const MANAGEMENT_EXPORTS = [
  "MANAGEMENT_PROTOCOL_VERSION",
  "LOG_TAIL_MAX",
  "decodeFrame",
  "assessModuleRequires",
  "moduleIdentity",
  "moduleRequireBlockMessage",
  "parseDeviceLoginLink",
  "scoreboardCommand",
  "scoreboardTargetBlock",
];

/** 桌面端渲染层的纯函数源码目录（只引用不依赖 React / DOM 的 lib 文件） */
const desktopLib = path.resolve(packageDir, "..", "desktop", "src", "renderer", "lib");

/**
 * 需要打包进 vendor 的模块：输出文件名 → [来源, 导出名]。
 * 使用场景：任务/阶段文案、告警合并规则与桌面端共用一份源码，避免小程序手抄后两边漂移（DRY）。
 * 来源为包名时按依赖解析；为绝对路径时直接打包该文件。
 */
const VENDOR_BUNDLES = {
  management: [["@sfmc-bds/management", MANAGEMENT_EXPORTS]],
  "desktop-lib": [
    [path.join(desktopLib, "format.ts"), ["taskLabel", "phaseLabel", "TASK_STATUS", "isTaskDone", "taskElapsed", "duration", "hashHue", "hostLabel", "plainMinecraft"]],
    [path.join(desktopLib, "alerts.ts"), ["groupAlerts"]],
    // 配置表单：字段推断、server.properties 字段清单（平台下发 / 内置回退）与保留注释的回写，与桌面端「表单」视图同一份规则。
    [path.join(desktopLib, "config-form.ts"), ["parseJsonText", "fieldsFromSchema", "fieldsFromValue", "setJsonField", "PROPERTY_FIELDS", "propertyFormFields", "parseProperties", "setProperty"]],
    // 行为日志：事件文案、分类、图标、详情摘要与快捷时间范围，与桌面端「行为日志」页同一份规则。
    [
      path.join(desktopLib, "activity.ts"),
      ["ACTIVITY_CATEGORIES", "ACTIVITY_LEVELS", "ACTIVITY_RANGE_PRESETS", "activityLabel", "activityIcon", "activityActor", "activityDetail", "activityPosition", "activityTime", "activityRange"],
    ],
    // 计分板：标题 / 参与者文案、统计、排行、分布与表单校验，与桌面端「计分板」页同一份规则。
    [
      path.join(desktopLib, "scoreboard.ts"),
      [
        "SCORE_MODES", "SCOREBOARD_SORTS", "objectiveTitle", "participantName", "participantTag", "objectiveSlots", "formatScore", "formatStat",
        "scoreStats", "filterParticipants", "sortParticipants", "scoreRanking", "scoreHistogram", "binLabel", "previewScore",
        "objectiveFormError", "scoreForm",
      ],
    ],
  ],
};

/** 小程序用到的语义图标名（必须存在于 @sfmc-bds/ui 的 ICONS 表中） */
const ICON_NAMES = [
  "overview", "terminal", "history", "tasks", "modules", "package", "sliders", "users", "user", "refresh",
  "search", "plus", "x", "check", "chevronDown", "chevronRight", "arrowRight", "arrowDown", "arrowUp",
  "play", "stop", "restart", "power", "server", "globe", "database", "message", "bot", "cube", "plug",
  "unplug", "warning", "alert", "info", "checkCircle", "xCircle", "loader", "clock", "calendar", "copy",
  "download", "upload", "trash", "pencil", "more", "settings", "wrap", "eraser", "archive", "archiveRestore",
  "layers", "link", "zap", "code", "list", "bell", "bug", "activity", "image", "key", "shield", "lock",
  "filter", "hardDrive", "external", "cpu", "fileCode", "eye", "monitor", "trophy", "minus", "location",
];

/** 按 VENDOR_BUNDLES 打包运行时导出（CommonJS），并写出对应的类型声明 */
async function buildVendor() {
  const outDir = path.join(appDir, "vendor");
  fs.mkdirSync(outDir, { recursive: true });
  for (const [name, sources] of Object.entries(VENDOR_BUNDLES)) {
    const lines = sources.map(([from, exports]) => {
      const specifier = path.isAbsolute(from) ? from.replace(/\\/g, "/") : from;
      return `export { ${exports.join(", ")} } from ${JSON.stringify(specifier)};`;
    });
    await build({
      stdin: { contents: lines.join("\n"), resolveDir: packageDir, loader: "ts" },
      bundle: true,
      format: "cjs",
      platform: "neutral",
      mainFields: ["module", "main"],
      target: "es2018",
      outfile: path.join(outDir, `${name}.js`),
      banner: { js: "/* 由 scripts/build-assets.mjs 生成，请勿手改 */" },
      logLevel: "warning",
    });
    // 来自本地源码文件的导出：用 tsc 生成声明到 vendor/types/<name>/，避免小程序类型检查时
    // 按自己的 lib 设置去检查桌面端整份源码（例如桌面端使用的 ES2022 API）。
    // 声明目录不与 <name>.js 同名，免得小程序的 require 把目录当成模块解析。
    const files = sources.map(([from]) => from).filter((from) => path.isAbsolute(from));
    const declarationDir = path.join(outDir, "types", name);
    if (files.length) emitDeclarations(files, declarationDir);
    const declarations = sources.map(([from, exports]) => {
      const specifier = path.isAbsolute(from) ? `./types/${name}/${path.basename(from, ".ts")}.js` : from;
      return `export { ${exports.join(", ")} } from ${JSON.stringify(specifier)};`;
    });
    fs.writeFileSync(path.join(outDir, `${name}.d.ts`), `/* 由 scripts/build-assets.mjs 生成，请勿手改 */\n${declarations.join("\n")}\n`);
  }
}

/**
 * 为本地源码文件生成 .d.ts（只输出声明，不产生 JS）。
 * 使用仓库统一的 @sfmc-bds/tools/tsc7；声明只引用 @sfmc-bds/management 等本包已依赖的类型。
 */
function emitDeclarations(files, outDir) {
  fs.rmSync(outDir, { recursive: true, force: true });
  const tsc = path.join(packageDir, "node_modules", "@sfmc-bds", "tools", "tsc7.mjs");
  const args = [
    tsc, "--ignoreConfig", "--declaration", "--emitDeclarationOnly", "--skipLibCheck", "--strict",
    "--target", "es2022", "--module", "esnext", "--moduleResolution", "bundler",
    "--rootDir", path.dirname(files[0]), "--outDir", outDir, ...files,
  ];
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`生成 ${path.basename(outDir)} 的类型声明失败`);
}

/**
 * 读取 @sfmc-bds/ui 的语义名 → Tabler 描边组件名映射。
 * ICONS 每项写作 `名称: [IconXxx, IconXxxFilled?]`，这里只取第一个（描边版）。
 */
function readIconTable() {
  const source = fs.readFileSync(path.resolve(packageDir, "..", "ui", "src", "components", "icons.tsx"), "utf8");
  const block = /const ICONS = \{([\s\S]*?)\} satisfies/.exec(source)?.[1];
  if (!block) throw new Error("无法在 @sfmc-bds/ui/icons.tsx 中找到 ICONS 表");
  /** @type {Map<string, string>} */
  const table = new Map();
  for (const match of block.matchAll(/(\w+):\s*\[\s*Icon(\w+)/g)) table.set(match[1], match[2]);
  return table;
}

/** Tabler 组件名（去掉 Icon 前缀的 PascalCase）→ SVG 文件名，例如 Terminal2 → terminal-2 */
const kebab = (name) => name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/([a-zA-Z])([0-9])/g, "$1-$2").toLowerCase();

/**
 * 读取 icons.tsx 里标了 @outline 名称 的本地描边路径。
 * 使用场景：某张图标不用 Tabler 原图时，路径以字符串数组写在标记后面，遮罩与桌面端用同一份。
 * @param {string} source icons.tsx 全文
 * @returns {Map<string, string[]>}
 */
function readLocalOutlines(source) {
  /** @type {Map<string, string[]>} */
  const outlines = new Map();
  for (const match of source.matchAll(/@outline\s+(\w+)\b[^[\]]*\[([\s\S]*?)\]/g)) {
    const paths = [...match[2].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
    if (!paths.length) throw new Error(`@outline ${match[1]} 没有路径`);
    outlines.set(match[1], paths);
  }
  return outlines;
}

/**
 * 把本地描边路径收成与 Tabler 描边版相同属性的 SVG，供遮罩着色。
 * @param {string[]} paths
 */
function outlineSvg(paths) {
  const body = paths.map((d) => `<path d="${d}" />`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

/**
 * 按语义图标名读取描边版 SVG 源码。
 * 使用场景：生成小程序页面里的遮罩图标（标签栏不走这里，见 TAB_ICONS）。
 * 有 @outline 标记的名称用 icons.tsx 里的路径；其余仍读 Tabler 描边文件。
 * @param {Map<string, string>} table readIconTable 的结果
 * @param {Map<string, string[]>} outlines readLocalOutlines 的结果
 * @param {string} iconsBlock ICONS 表的花括号内容，用来确认本地描边已经登记
 * @param {string} name 语义图标名
 */
function tablerSvg(table, outlines, iconsBlock, name) {
  const paths = outlines.get(name);
  if (paths) {
    if (!new RegExp(`\\b${name}\\s*:`).test(iconsBlock)) throw new Error(`@outline ${name} 没有登记在 ICONS 表里`);
    return outlineSvg(paths);
  }
  const component = table.get(name);
  if (!component) throw new Error(`@sfmc-bds/ui 的 ICONS 中没有图标 ${name}`);
  // 按本包直接依赖的链接位置读取 SVG 资源。
  const file = path.join(packageDir, "node_modules", "@tabler", "icons", "icons", "outline", `${kebab(component)}.svg`);
  if (!fs.existsSync(file)) throw new Error(`找不到 Tabler 图标文件: ${file}`);
  return fs.readFileSync(file, "utf8");
}

/**
 * 原生标签栏的图标：语义名 → Phosphor core 的 SVG 文件名。
 * 使用场景：标签栏保留 Phosphor 的 regular / fill 两种字重，与页面内的 Tabler 图标分开维护；
 * theme.json 里新增标签图标时在这里登记。
 */
const TAB_ICONS = {
  // 原生标签栏归玩家端：首页 / 地图 / 排行 / 我的。管理端的底部导航是 components/admin-nav，用遮罩图标，不在这里。
  home: "house",
  map: "map-trifold",
  rank: "trophy",
  me: "user-circle",
};

/**
 * 读取标签栏用的 Phosphor SVG 源码。
 * @param {string} name 语义图标名（theme.json 中的文件名）
 * @param {"regular" | "fill"} weight Phosphor 字重：未选中 regular，选中 fill
 */
function phosphorTabSvg(name, weight) {
  const base = TAB_ICONS[/** @type {keyof typeof TAB_ICONS} */ (name)];
  if (!base) throw new Error(`TAB_ICONS 中没有标签栏图标 ${name}`);
  // 该包不导出 package.json，按本包直接依赖的链接位置读取 SVG 资源。
  const coreDir = path.join(packageDir, "node_modules", "@phosphor-icons", "core");
  const suffix = weight === "regular" ? "" : `-${weight}`;
  const file = path.join(coreDir, "assets", weight, `${base}${suffix}.svg`);
  if (!fs.existsSync(file)) throw new Error(`找不到 Phosphor 图标文件: ${file}`);
  return fs.readFileSync(file, "utf8");
}

/**
 * 把一份 SVG 写成遮罩图标规则 `.i-<类名>{mask-image:…}`。
 * 遮罩只看不透明度：描边 / 填充改成纯黑即可，颜色由 .i 的 background-color（currentColor）决定。
 * 使用场景：buildIcons 生成 Tabler 页面图标与 Phosphor 标签栏图标。
 * @param {string} className 类名（不含 .i- 前缀）
 * @param {string} source SVG 源码
 */
function maskRule(className, source) {
  const svg = source
    .replace(/\s+/g, " ")
    .replace(/(stroke|fill)="currentColor"/g, '$1="#000"')
    .replace(/"/g, "'")
    .trim();
  const encoded = svg.replace(/%/g, "%25").replace(/#/g, "%23").replace(/</g, "%3C").replace(/>/g, "%3E");
  return `.i-${className}{-webkit-mask-image:url("data:image/svg+xml,${encoded}");mask-image:url("data:image/svg+xml,${encoded}")}`;
}

/**
 * 生成遮罩图标样式：Tabler 页面图标 .i-<名称>，以及标签栏图标 .i-tab-<名称>（Phosphor regular）/ .i-tab-<名称>-fill（Phosphor fill）。
 * 标签栏图标供悬浮玻璃标签栏 components/glass-tab-bar 使用（玩家端 custom-tab-bar），与原生标签栏 PNG 同一套 TAB_ICONS。
 */
function buildIcons() {
  const source = fs.readFileSync(path.resolve(packageDir, "..", "ui", "src", "components", "icons.tsx"), "utf8");
  const iconsBlock = /const ICONS = \{([\s\S]*?)\} satisfies/.exec(source)?.[1] ?? "";
  const table = readIconTable();
  const outlines = readLocalOutlines(source);
  const rules = ICON_NAMES.map((name) => maskRule(name.replace(/([A-Z])/g, "-$1").toLowerCase(), tablerSvg(table, outlines, iconsBlock, name)));
  const tabRules = Object.keys(TAB_ICONS).flatMap((name) => [
    maskRule(`tab-${name}`, phosphorTabSvg(name, "regular")),
    maskRule(`tab-${name}-fill`, phosphorTabSvg(name, "fill")),
  ]);
  const header =
    "/* 由 scripts/build-assets.mjs 从 Tabler Icons（MIT）与 Phosphor Icons（MIT，.i-tab-*）生成，请勿手改；基础样式 .i 见 styles/base.wxss */\n";
  fs.writeFileSync(path.join(appDir, "styles", "icons.wxss"), header + [...rules, ...tabRules].join("\n") + "\n");
  return rules.length + tabRules.length;
}

/** 原生标签栏图标目录（相对小程序根目录） */
const TAB_ICON_DIR = "assets/tabbar";
/** 标签栏图标边长，取微信建议的 81×81 */
const TAB_ICON_SIZE = 81;

/**
 * 生成原生标签栏的 PNG 图标（原生 tabBar 不支持 SVG / 字体图标）。
 * 使用场景：theme.json 里 `assets/tabbar/<主题>/<语义图标名>[-active].png` 形式的取值即为需要的图标，
 * 未选中用 Phosphor regular + 该主题的 tabText，选中（-active）用 fill + tabSelected。
 * 文件清单与颜色在 theme.json 中维护，图标文件在 TAB_ICONS 中登记；新增标签需改 app.json、theme.json 与 TAB_ICONS。
 */
function buildTabIcons() {
  /** @type {Record<string, Record<string, string>>} */
  const themes = JSON.parse(fs.readFileSync(path.join(appDir, "theme.json"), "utf8"));
  const pattern = new RegExp(`^${TAB_ICON_DIR}/[a-z]+/([a-zA-Z]+?)(-active)?\\.png$`);
  fs.rmSync(path.join(appDir, TAB_ICON_DIR), { recursive: true, force: true });
  let count = 0;
  for (const [theme, vars] of Object.entries(themes)) {
    for (const value of Object.values(vars)) {
      if (!value.startsWith(`${TAB_ICON_DIR}/`)) continue;
      const match = pattern.exec(value);
      if (!match) throw new Error(`theme.json 中的标签栏图标路径不符合约定: ${value}`);
      const [, name, active] = match;
      const color = active ? vars.tabSelected : vars.tabText;
      if (!color) throw new Error(`theme.json 的 ${theme} 主题缺少 ${active ? "tabSelected" : "tabText"}`);
      const svg = phosphorTabSvg(name, active ? "fill" : "regular").replace(/fill="currentColor"/g, `fill="${color}"`);
      const png = new Resvg(svg, { fitTo: { mode: "width", value: TAB_ICON_SIZE } }).render().asPng();
      const file = path.join(appDir, value);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, png);
      count += 1;
    }
  }
  return count;
}

/** 桌面端 @sfmc-bds/ui 的颜色令牌源码（纯数据，不引入字体等资源，可直接打包后在 Node 中执行） */
const PALETTE_SOURCE = path.resolve(packageDir, "..", "ui", "src", "palette.ts");

/**
 * theme.json 中必须与色板一致的颜色：theme.json → 色板键名。
 * 使用场景：theme.json 只接受 #rrggbb、不能引用 CSS 变量，所以导航栏 / 标签栏颜色仍手写在 theme.json，
 * 构建时与色板核对，改了色板忘记同步时直接报错。iOS 色板的标签栏文字色（gray / accent）是不透明色，一并核对。
 */
const THEME_JSON_TOKENS = { navBg: "bg", pageBg: "bg", tabBg: "block", tabText: "gray", tabSelected: "accent" };

/** 打包并执行 palette.ts，取得 PALETTES 与 paletteVariables（与桌面端 applyCssVariables 同一份变量命名） */
async function loadPalette() {
  const result = await build({ entryPoints: [PALETTE_SOURCE], bundle: true, write: false, format: "esm", platform: "neutral", logLevel: "warning" });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

/**
 * 合并出小程序的一套主题：桌面端色板打底，iOS 色板覆盖，再追加 iOS 扩展令牌。
 * 使用场景：buildPalette 生成 palette.wxss 与核对 theme.json。
 * iOS 色板只能出现桌面端已有的键或 IOS_EXTRA_TOKENS / IOS_TINT_TOKENS 登记的键，拼错键名时直接报错，避免生成无人引用的变量。
 * @param {Record<string, string>} desktop 桌面端该主题的色板
 * @param {"light" | "dark"} theme
 */
function miniprogramPalette(desktop, theme) {
  const ios = iosPalette(theme);
  const unknown = Object.keys(ios).filter((key) => !(key in desktop) && !(key in IOS_EXTRA_TOKENS) && !(key in IOS_TINT_TOKENS));
  if (unknown.length) throw new Error(`ios-palette.mjs 中的令牌不在桌面端色板里，也未登记为扩展令牌：${unknown.join("、")}`);
  return { ...desktop, ...ios };
}

/**
 * 一套主题的全部 CSS 变量：沿用桌面端 paletteVariables 的命名，再把 --chart-* 换成 iOS 强调色。
 * 使用场景：buildPalette 写 palette.wxss 与 vendor/palette.js，两处用同一份结果，保证 CSS 与 TS 读到的颜色一致。
 * iOS 图表色数量必须与桌面端 CHART_COLORS 相同，增删图表色时两边一起改。
 * @param {(palette: Record<string, string>) => [string, string][]} paletteVariables 桌面端的变量命名函数
 * @param {Record<string, string>} palette miniprogramPalette 合并后的色板
 * @param {"light" | "dark"} theme
 * @param {number} desktopChartCount 桌面端 CHART_COLORS 的个数
 * @returns {[string, string][]}
 */
function miniprogramVariables(paletteVariables, palette, theme, desktopChartCount) {
  const chart = iosChartColors(theme);
  if (chart.length !== desktopChartCount) {
    throw new Error(`ios-palette.mjs 的 IOS_CHART_COLORS 有 ${chart.length} 个，桌面端 CHART_COLORS 有 ${desktopChartCount} 个，需保持一致`);
  }
  return paletteVariables(palette).map(([name, value]) => {
    const match = /^--chart-(\d+)$/.exec(name);
    return match ? [name, chart[Number(match[1]) - 1] ?? value] : [name, value];
  });
}

/**
 * 写出 vendor/palette.js 与类型声明：{ light, dark } 两套「CSS 变量名 → 颜色」。
 * 使用场景：core/palette.ts 按当前主题取色，给 canvas 绘制（折线图、地图底色）与 wx.showModal 的 confirmColor 使用。
 * @param {Record<"light" | "dark", [string, string][]>} variables
 */
function writePaletteModule(variables) {
  const outDir = path.join(appDir, "vendor");
  fs.mkdirSync(outDir, { recursive: true });
  const header = "/* 由 scripts/build-assets.mjs 生成（与 styles/palette.wxss 同一份颜色），请勿手改 */";
  const table = { light: Object.fromEntries(variables.light), dark: Object.fromEntries(variables.dark) };
  fs.writeFileSync(path.join(outDir, "palette.js"), `${header}\n"use strict";\nexports.PALETTE_VARIABLES = ${JSON.stringify(table, null, 2)};\n`);
  const names = variables.light.map(([name]) => JSON.stringify(name)).join("\n  | ");
  fs.writeFileSync(
    path.join(outDir, "palette.d.ts"),
    `${header}\n/** 色板中的 CSS 变量名 */\nexport type PaletteVariable =\n  | ${names};\n` +
      `/** 浅色 / 深色两套变量值 */\nexport declare const PALETTE_VARIABLES: Record<"light" | "dark", Record<PaletteVariable, string>>;\n`
  );
}

/**
 * 生成 miniprogram/styles/palette.wxss：浅色写在 page 上，深色写在 prefers-color-scheme: dark 里，
 * 使用场景：小程序的 --c-* 颜色令牌由 iOS 色板与桌面端色板合成，不在 tokens.wxss 里手抄。
 * 返回生成的变量个数（单个主题）。
 */
async function buildPalette() {
  const { PALETTES, CHART_COLORS, paletteVariables } = await loadPalette();
  const palettes = { light: miniprogramPalette(PALETTES.light, "light"), dark: miniprogramPalette(PALETTES.dark, "dark") };
  const variables = {
    light: miniprogramVariables(paletteVariables, palettes.light, "light", CHART_COLORS.length),
    dark: miniprogramVariables(paletteVariables, palettes.dark, "dark", CHART_COLORS.length),
  };
  /** @param {[string, string][]} list @param {string} indent */
  const declarations = (list, indent) => list.map(([name, value]) => `${indent}${name}: ${value};`);
  /*
   * 变量声明的选择器：page 之外再挂 .theme-scope——custom-tab-bar 等不在 page 节点下渲染的内容继承不到 page 上的变量，
   * 需在其根节点加 theme-scope 类（与 tokens.wxss 保持一致）。
   */
  const scope = "page, .theme-scope";
  const lines = [
    `/* 由 scripts/build-assets.mjs 根据 scripts/ios-palette.mjs（iOS 27 系统配色）生成，iOS 无对应的令牌沿用 packages/ui/src/palette.ts；请勿手改 */`,
    `${scope} {`,
    ...declarations(variables.light, "  "),
    "}",
    "",
    "@media (prefers-color-scheme: dark) {",
    `  ${scope} {`,
    ...declarations(variables.dark, "    "),
    "  }",
    "}",
    "",
  ];
  fs.writeFileSync(path.join(appDir, "styles", "palette.wxss"), lines.join("\n"));
  writePaletteModule(variables);

  /** @type {Record<string, Record<string, string>>} */
  const themes = JSON.parse(fs.readFileSync(path.join(appDir, "theme.json"), "utf8"));
  for (const theme of /** @type {const} */ (["light", "dark"])) {
    for (const [field, token] of Object.entries(THEME_JSON_TOKENS)) {
      const expected = palettes[theme][token];
      if (themes[theme]?.[field]?.toLowerCase() !== expected.toLowerCase()) {
        throw new Error(`theme.json 的 ${theme}.${field} 为 ${themes[theme]?.[field]}，应与色板 ${token} 一致：${expected}`);
      }
    }
  }
  return variables.light.length;
}

await buildVendor();
const paletteCount = await buildPalette();
const count = buildIcons();
const tabCount = buildTabIcons();
console.log(
  `[miniprogram] vendor/${Object.keys(VENDOR_BUNDLES).join(".js、vendor/")}.js、vendor/palette.js、styles/palette.wxss（${paletteCount} 个颜色变量）、${count} 个图标与 ${tabCount} 个标签栏图标已生成`
);
