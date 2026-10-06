import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import type { DesktopPreferences } from "../shared/api.js";

const DEFAULTS: DesktopPreferences = {
  tray: true,
  closeToTray: true,
  minimizeToTray: false,
  openAtLogin: false,
  startHidden: false,
};

const KEYS = ["tray", "closeToTray", "minimizeToTray", "openAtLogin", "startHidden"] as const;

function file(): string {
  return path.join(app.getPath("userData"), "preferences.json");
}

function normalize(value: Partial<DesktopPreferences> | null | undefined): DesktopPreferences {
  const next = { ...DEFAULTS };
  if (!value) return next;
  for (const key of KEYS) if (typeof value[key] === "boolean") next[key] = value[key];
  return next;
}

export function readPreferences(): DesktopPreferences {
  try {
    return normalize(JSON.parse(fs.readFileSync(file(), "utf8")) as Partial<DesktopPreferences>);
  } catch {
    return { ...DEFAULTS };
  }
}

export function writePreferences(patch: Partial<DesktopPreferences>): DesktopPreferences {
  const next = normalize({ ...readPreferences(), ...patch });
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(next, null, 2) + "\n");
  return next;
}

/** 把开机启动同步到系统。开发模式不写登录项，避免把 Electron 开发进程登记进去。 */
export function applyLoginItem(prefs: DesktopPreferences): void {
  if (!app.isPackaged) return;
  const args = prefs.openAtLogin && prefs.startHidden ? ["--sfmc-hidden"] : [];
  try {
    app.setLoginItemSettings({
      openAtLogin: prefs.openAtLogin,
      ...(process.platform === "win32" ? { path: process.execPath, args } : {}),
    });
  } catch {
    /* 当前环境不支持登录项时保留偏好，下次启动再试 */
  }
}

export function shouldStartHidden(prefs: DesktopPreferences): boolean {
  if (!prefs.tray || !prefs.startHidden) return false;
  if (process.argv.includes("--sfmc-hidden")) return true;
  try {
    return prefs.openAtLogin && app.getLoginItemSettings().wasOpenedAtLogin;
  } catch {
    return false;
  }
}
