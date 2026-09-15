/**
 * ThemeToggle.tsx — 顶栏外观切换：跟随系统 / 浅色 / 深色循环。
 */

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  cycleThemePref,
  readThemePref,
  setThemePref,
  syncDocumentTheme,
  THEME_PREF_LABEL,
  type ThemePref,
} from "../theme";

const ICONS = {
  system: Monitor,
  light: Sun,
  dark: Moon,
} as const;

export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>(readThemePref);

  // 挂载时对齐文档；跟随系统时监听 OS 配色变化。
  useEffect(() => {
    syncDocumentTheme(pref);
    if (pref !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => syncDocumentTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [pref]);

  const Icon = ICONS[pref];
  const label = THEME_PREF_LABEL[pref];

  return (
    <button
      type="button"
      className="btn btn-icon"
      title={`外观：${label}（点击切换）`}
      aria-label={`外观：${label}，点击切换`}
      onClick={() => {
        const next = cycleThemePref(pref);
        setThemePref(next);
        setPref(next);
      }}
    >
      <Icon size={15} />
    </button>
  );
}
