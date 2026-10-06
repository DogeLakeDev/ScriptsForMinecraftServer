import { app, BrowserWindow, Menu, nativeImage, nativeTheme, Tray } from "electron";
import { readPreferences } from "./preferences.js";

const LIGHT_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAe0lEQVR4nO3OMQ7AIAxD0Rwk9+J23JK9C0MVtQWcQKTKg1f/J6oqmUuNE0DALwCtLwXQzI4BbNgFiQxDkB3hJcgMoPathktfGGAWUszCAV8IG98GsJCn8BFAHcQJICAEMIJAYQTwBoHCHoCFQOEIgNwA8IcX4B4BBBBwAYaM1wFV/IdBAAAAAElFTkSuQmCC";
const DARK_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAfElEQVR4nO3OMQ7AIAxDUW7J7ThhVakDO0uGKmoLOIFIlQev/i8d55UiFxongIBfAKosBFDVtgF02ATxDEOQFeEpyAigyGbDWeYGGIVkNXfAF0LHlwE05Cm8BVA6cQIIcAH0IFAYAbxBoLAFoCFQ2AOQbgD4wwowjwACCGjJdbOXvAiXBAAAAABJRU5ErkJggg==";

let tray: Tray | null = null;
let quitting = false;

export function markQuitting(): void {
  quitting = true;
}

export function hasTray(): boolean {
  return Boolean(tray && !tray.isDestroyed());
}

export function showWindow(window: BrowserWindow): void {
  if (window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

function icon() {
  const image = nativeImage.createFromDataURL(nativeTheme.shouldUseDarkColors ? DARK_URL : LIGHT_URL);
  return process.platform === "win32" ? image.resize({ width: 16, height: 16 }) : image;
}

export function syncTray(window: BrowserWindow): boolean {
  const prefs = readPreferences();
  if (!prefs.tray) {
    const hadTray = Boolean(tray && !tray.isDestroyed());
    tray?.destroy();
    tray = null;
    if (hadTray && !window.isDestroyed() && !window.isVisible()) showWindow(window);
    return false;
  }
  if (!tray || tray.isDestroyed()) {
    try {
      tray = new Tray(icon());
    } catch {
      tray = null;
      return false;
    }
    tray.setToolTip("SFMC Desktop");
    const open = () => showWindow(window);
    tray.on("click", open);
    tray.on("double-click", open);
  } else {
    tray.setImage(icon());
  }
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "显示窗口", click: () => showWindow(window) },
      { type: "separator" },
      {
        label: "退出",
        click: () => {
          markQuitting();
          app.quit();
        },
      },
    ])
  );
  return true;
}

export function bindWindow(window: BrowserWindow): void {
  window.on("close", (event) => {
    const prefs = readPreferences();
    if (quitting || !prefs.tray || !prefs.closeToTray || !hasTray()) return;
    event.preventDefault();
    window.hide();
  });
  window.on("minimize", () => {
    const prefs = readPreferences();
    if (quitting || !prefs.tray || !prefs.minimizeToTray || !hasTray()) return;
    window.hide();
  });
}
