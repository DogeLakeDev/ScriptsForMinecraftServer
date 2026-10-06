/**
 * theme.tsx — SnowUI 设计令牌、字体与外观（明暗主题）提供者
 *
 * 使用场景：应用根节点包裹 <AppearanceProvider>。调色板由 @sfmc-bds/ui/theme 统一提供，
 * 同时派生出：① 写入 :root 的 CSS 变量（styles/*.css 使用）；② Monaco 编辑器主题；③ 主进程标题栏覆盖层配色。
 * 基于 SnowUI Dashboard UI Kit（ByeWind，CC BY 4.0）：单色主按钮与柔和色块，
 * 深色采用炭灰底色与低饱和强调色。外观模式持久化在 localStorage，并通过 window.sfmc.appearance 同步给主进程。
 */
import { PALETTES, applyCssVariables, registerPunctuationFont } from "@sfmc-bds/ui/theme";
import * as monaco from "monaco-editor";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AppearanceMode } from "../../shared/api.js";
export { CHART_COLORS, FONT_MONO, PALETTES } from "@sfmc-bds/ui/theme";

/** 把 rgba() 或 #rrggbb 规整为 Monaco 可接受的 #rrggbbaa */
function toHex(color: string): string {
  if (color.startsWith("#")) return color;
  const [r = 0, g = 0, b = 0, a = 1] = color.match(/[\d.]+/g)!.map(Number);
  const hex = (value: number) => Math.round(value).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}${hex(a * 255)}`;
}

/** 注册 Monaco 编辑器的明暗主题：底色与区块（Block）一致，选区与光标沿用强调色 */
let monacoThemesRegistered = false;
function registerMonacoThemes() {
  if (monacoThemesRegistered) return;
  monacoThemesRegistered = true;
  for (const [name, palette, base] of [
    ["sfmc-light", PALETTES.light, "vs"],
    ["sfmc-dark", PALETTES.dark, "vs-dark"],
  ] as const) {
    const light = base === "vs";
    monaco.editor.defineTheme(name, {
      base,
      inherit: true,
      rules: [
        { token: "comment", foreground: toHex(palette.text3).slice(1, 7), fontStyle: "italic" },
        { token: "string.key.json", foreground: light ? "5b5ec2" : "adadfb" },
        { token: "string.value.json", foreground: light ? "2e7d60" : "71dd8c" },
        { token: "number", foreground: light ? "2f7aa6" : "7dbbff" },
        { token: "keyword", foreground: light ? "9a4fd0" : "b899eb" },
      ],
      colors: {
        "editor.background": palette.block,
        "editorGutter.background": palette.block,
        "editor.foreground": palette.text,
        "editor.lineHighlightBackground": toHex(palette.fill),
        "editor.lineHighlightBorder": "#00000000",
        "editorLineNumber.foreground": toHex(palette.text4),
        "editorLineNumber.activeForeground": toHex(palette.text2),
        "editorCursor.foreground": palette.accent,
        "editor.selectionBackground": toHex(palette.selection),
        "editor.inactiveSelectionBackground": toHex(palette.fill2),
        "editorIndentGuide.background1": toHex(palette.line),
        "editorIndentGuide.activeBackground1": toHex(palette.text4),
        "editorWidget.background": palette.bg,
        "editorWidget.border": toHex(palette.line),
        "editorHoverWidget.background": palette.bg,
        "editorHoverWidget.border": toHex(palette.line),
        "editorSuggestWidget.background": palette.bg,
        "editorSuggestWidget.border": toHex(palette.line),
        "editorSuggestWidget.selectedBackground": toHex(palette.fill2),
        "scrollbarSlider.background": toHex(palette.fill2),
        "scrollbarSlider.hoverBackground": toHex(palette.text4),
        "scrollbarSlider.activeBackground": toHex(palette.text3),
        "editorError.foreground": palette.danger,
        "editorWarning.foreground": palette.warning,
        focusBorder: "#00000000",
      },
    });
  }
}

/** 外观上下文：当前模式、是否深色、切换方法、Monaco 主题名 */
interface AppearanceValue {
  mode: AppearanceMode;
  dark: boolean;
  setMode: (mode: AppearanceMode) => void;
  /** 在浅色/深色之间切换（标题栏的太阳/月亮按钮使用；会脱离"跟随系统"） */
  toggle: () => void;
  editorTheme: string;
}
const AppearanceContext = createContext<AppearanceValue | null>(null);
/** 外观模式的本地持久化键 */
const STORAGE_KEY = "sfmc.desktop.appearance";

/** 读取外观上下文（必须位于 AppearanceProvider 内） */
export function useAppearance(): AppearanceValue {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error("useAppearance 必须在 AppearanceProvider 内使用");
  return value;
}

/**
 * 外观提供者：负责主题状态、CSS 变量注入、Monaco 主题注册与主进程同步。
 */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AppearanceMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
  });
  const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);
  const dark = mode === "dark" || (mode === "system" && systemDark);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
    void window.sfmc.appearance(mode).catch(() => {});
  }, [mode]);
  useLayoutEffect(() => {
    applyCssVariables(dark ? PALETTES.dark : PALETTES.light);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  }, [dark]);
  registerPunctuationFont();
  registerMonacoThemes();
  const toggle = useCallback(() => setMode(dark ? "light" : "dark"), [dark]);
  const value = useMemo(
    () => ({ mode, dark, setMode, toggle, editorTheme: dark ? "sfmc-dark" : "sfmc-light" }),
    [mode, dark, toggle]
  );
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}
