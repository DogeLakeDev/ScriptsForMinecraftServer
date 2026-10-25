import { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme, Menu } from "electron";
import path from "node:path";
import fs from "node:fs";
import { trustHost } from "./hosts.js";
import { autoUpdater } from "electron-updater";
import { releaseManifest } from "./runtime.js";
import { Session } from "./sessions.js";
import { profiles, profile, saveProfile, removeProfile, credentials, rememberSession } from "./profiles.js";
import type { AppearanceMode, Credentials, DesktopPreferences, InstanceProfile } from "../shared/api.js";
import { compareDesktopVersions, parseDesktopVersion, type ManagementMethod } from "@sfmc-bds/management";
import { desktopReleaseNotes } from "@sfmc-bds/management/node";
import { applyLoginItem, readPreferences, shouldStartHidden, writePreferences } from "./preferences.js";
import { bindWindow, markQuitting, showWindow, syncTray } from "./tray.js";

const sessions = new Map<string, Session>();
/** 桌面导入接受的世界包后缀。使用场景：多选对话框和拖入文件在复制前都走这里。 */
const PACK_EXTENSIONS = new Set([".mcpack", ".mcaddon", ".zip"]);

/** 只接受用户选中的绝对路径上的包文件，避免把任意路径交给上传。 */
function assertPackFile(file: string) {
  if (!path.isAbsolute(file)) throw new Error("需要世界包的绝对路径");
  const extension = path.extname(file).toLowerCase();
  if (!PACK_EXTENSIONS.has(extension)) throw new Error(`不支持的世界包类型：${path.basename(file)}`);
  let stat: fs.Stats;
  try { stat = fs.statSync(file); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error(`找不到文件：${path.basename(file)}`);
    throw error;
  }
  if (!stat.isFile()) throw new Error(`不是文件：${path.basename(file)}`);
}
const changedHosts = new Map<string, NonNullable<Session["changedFingerprint"]>>();
let window: BrowserWindow;
app.setName("SFMC Desktop");
if (!app.isPackaged && process.env.SFMC_DESKTOP_USER_DATA) app.setPath("userData", process.env.SFMC_DESKTOP_USER_DATA);
if (!app.requestSingleInstanceLock()) process.exit(0);
app.on("second-instance", () => { if (window && !window.isDestroyed()) showWindow(window); });

/** SnowUI 窗口底色：浅色 Background/1、深色 Background/1 */
const THEME_CHROME = {
  light: { background: "#ffffff", overlay: "#ffffff", symbol: "#1c1c1c" },
  dark: { background: "#1d1d1d", overlay: "#1f1f1f", symbol: "#e2e2e2" },
} as const;

/** 当前解析后的明暗（system 跟随 nativeTheme.shouldUseDarkColors） */
function resolvedDark(mode: AppearanceMode): boolean {
  return mode === "dark" || (mode === "system" && nativeTheme.shouldUseDarkColors);
}

/**
 * 把外观同步到原生窗口：底色、Windows 标题栏覆盖层按钮配色。
 * 使用场景：启动时按系统主题初始化，以及渲染进程调用 appearance() 之后。
 */
function applyChrome(mode: AppearanceMode) {
  const chrome = THEME_CHROME[resolvedDark(mode) ? "dark" : "light"];
  if (!window || window.isDestroyed()) return;
  window.setBackgroundColor(chrome.background);
  if (process.platform === "win32") {
    window.setTitleBarOverlay({ color: chrome.overlay, symbolColor: chrome.symbol, height: 36 });
  }
}

void app.whenReady().then(async () => {
  if (app.isPackaged) Menu.setApplicationMenu(null);
  const launchPrefs = readPreferences();
  applyLoginItem(launchPrefs);
  const launchHidden = shouldStartHidden(launchPrefs);
  const initialDark = nativeTheme.shouldUseDarkColors;
  const chrome = THEME_CHROME[initialDark ? "dark" : "light"];
  window = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 1050,
    minHeight: 700,
    backgroundColor: chrome.background,
    show: false,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    ...(process.platform === "win32" ? { titleBarOverlay: { color: chrome.overlay, symbolColor: chrome.symbol, height: 36 } } : {}),
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", event => event.preventDefault());
  window.once("ready-to-show", () => { if (!launchHidden) window.show(); });
  bindWindow(window);
  const hasTray = syncTray(window);
  if (launchHidden && !hasTray) window.show();
  const handle = (channel: string, action: (...args: unknown[]) => unknown) => ipcMain.handle(`sfmc:${channel}`, (event, ...args: unknown[]) => { if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error("非法调用来源"); return action(...args); });
  handle("profiles", () => profiles());
  handle("saveProfile", (input, secret) => saveProfile(input as InstanceProfile, secret as Credentials));
  handle("removeProfile", id => { const key = String(id); sessions.get(key)?.disconnect(); sessions.delete(key); return removeProfile(key); });
  handle("connect", async (id, supplied) => {
    const key = String(id); sessions.get(key)?.disconnect(); sessions.delete(key);
    rememberSession(key, supplied as Credentials | undefined);
    const session = new Session(profile(key), { ...credentials(key), ...(supplied as Credentials ?? {}) }, (message, progress) => { if (!window.isDestroyed() && sessions.get(key) === session) window.webContents.send("sfmc:connection", key, message, progress ?? null); });
    sessions.set(key, session);
    try {
      const handshake = await session.connect();
      session.client!.on("event", event => { if (!window.isDestroyed()) window.webContents.send("sfmc:event", key, event); });
      await session.client!.call("events.subscribe"); return handshake;
    } catch (error) { if (session.changedFingerprint) changedHosts.set(key, session.changedFingerprint); session.disconnect(); sessions.delete(key); throw error; }
  });
  handle("confirmHost", async id => {
    const key = String(id); const current = profile(key); const changed = changedHosts.get(key);
    if (!changed || changed.key !== `${current.host}:${current.port ?? 22}`) throw new Error("请先连接此实例以读取待核实的主机指纹");
    const result = await dialog.showMessageBox(window, { type: "warning", title: "重新确认主机身份", message: `主机 ${changed.key} 的身份已改变`, detail: `原 SHA256: ${changed.previous}\n新 SHA256: ${changed.current}\n请通过可信渠道核对新指纹，核实后再重新接入。`, buttons: ["取消", "已核实新指纹"], defaultId: 0, cancelId: 0 });
    if (result.response !== 1) return false;
    trustHost(changed.key, changed.current, changed.previous); changedHosts.delete(key); return true;
  });
  handle("disconnect", id => { sessions.get(String(id))?.disconnect(); sessions.delete(String(id)); });
  handle("request", (id, method, params) => {
    const session = sessions.get(String(id)); if (!session?.client) throw new Error("实例尚未连接");
    return session.client.call(method as ManagementMethod, params);
  });
  handle("choose", async kind => { const result = await dialog.showOpenDialog(window, kind === "directory" ? { properties: ["openDirectory", "createDirectory"] } : { properties: ["openFile"], ...(kind === "pack" ? { filters: [{ name: "Minecraft 世界包", extensions: ["mcpack", "mcaddon", "zip"] }] } : {}) }); return result.canceled ? null : result.filePaths[0] ?? null; });
  handle("uploadPack", async (id, paths) => {
    const session = sessions.get(String(id));
    if (!session) throw new Error("实例尚未连接");
    let files: string[];
    if (paths === undefined) {
      const result = await dialog.showOpenDialog(window, { properties: ["openFile", "multiSelections"], filters: [{ name: "Minecraft 世界包", extensions: ["mcpack", "mcaddon", "zip"] }] });
      if (result.canceled || !result.filePaths.length) return null;
      files = result.filePaths;
    } else {
      if (!Array.isArray(paths) || paths.some(item => typeof item !== "string")) throw new Error("世界包路径无效");
      files = paths;
      if (!files.length) return [];
    }
    for (const file of files) assertPackFile(file);
    return session.uploadPacks(files);
  });
  autoUpdater.autoDownload = false; autoUpdater.autoInstallOnAppQuit = false; autoUpdater.channel = "desktop";
  autoUpdater.on("error", error => { if (!window.isDestroyed()) window.webContents.send("sfmc:connection", "", `客户端更新失败: ${error.message}`, null); });
  handle("openLink", (kind, target) => {
    if (kind === "release") {
      const url = new URL(String(target));
      if (url.origin !== "https://github.com" || !url.pathname.startsWith("/DogeLakeDev/ScriptsForMinecraftServer/releases/tag/")) throw new Error("非法发行页面");
      return shell.openExternal(url.href);
    }
    const urls = { eula: "https://www.minecraft.net/eula", "desktop-release": "https://github.com/DogeLakeDev/ScriptsForMinecraftServer/releases" };
    if (!(String(kind) in urls)) throw new Error("未知外部链接");
    return shell.openExternal(urls[kind as keyof typeof urls]);
  });
  handle("update", async action => {
    if (!app.isPackaged) return { development: true };
    const portable = !fs.existsSync(path.join(path.dirname(process.execPath), "installed.json"));
    const currentVersion = releaseManifest().desktopVersion ?? app.getVersion();
    const parsed = parseDesktopVersion(currentVersion);
    const preview = parsed?.preview !== undefined;
    const manual = portable || preview || Boolean(parsed?.build) || releaseManifest().windowsCodeSigned !== true;
    if (action === "check") {
      const notes = await desktopReleaseNotes(preview);
      if (!notes) return { portable, manual: true, available: false, noRelease: true };
      const info = { portable, manual: manual || Boolean(notes.prerelease) || Boolean(parseDesktopVersion(notes.version)?.build), available: compareDesktopVersions(currentVersion, notes.version) < 0, version: notes.version, releaseNotes: notes };
      if (info.manual || !info.available) return info;
      const tag = decodeURIComponent(new URL(notes.url).pathname.split("/").at(-1)!);
      autoUpdater.setFeedURL({ provider: "generic", url: `https://github.com/DogeLakeDev/ScriptsForMinecraftServer/releases/download/${tag}`, channel: "desktop" });
      const result = await autoUpdater.checkForUpdates(); return { ...info, available: Boolean(result?.isUpdateAvailable) };
    }
    if (manual) return { portable, manual: true };
    if (action === "download") return autoUpdater.downloadUpdate();
    if (action === "install") { autoUpdater.quitAndInstall(); return { installing: true }; }
    throw new Error("未知更新操作");
  });
  /** 外观：校验模式后设置 nativeTheme 并同步标题栏覆盖层（渲染进程切换主题时调用） */
  handle("appearance", (mode) => {
    const next = mode === "light" || mode === "dark" || mode === "system" ? mode : "system";
    nativeTheme.themeSource = next;
    applyChrome(next);
  });
  /** 客户端版本与运行形态（关于对话框、侧栏页脚） */
  handle("appInfo", () => ({ version: app.isPackaged ? releaseManifest().desktopVersion ?? app.getVersion() : app.getVersion(), platform: process.platform, packaged: app.isPackaged }));
  handle("preferences", () => readPreferences());
  handle("setPreferences", patch => {
    const next = writePreferences(patch as Partial<DesktopPreferences>);
    applyLoginItem(next);
    syncTray(window);
    return next;
  });
  nativeTheme.on("updated", () => {
    if (nativeTheme.themeSource === "system") applyChrome("system");
    syncTray(window);
  });
  const dev = !app.isPackaged ? process.env.SFMC_DESKTOP_DEV_URL : undefined;
  if (dev && /^http:\/\/127\.0\.0\.1:\d+$/.test(dev)) await window.loadURL(dev);
  else await window.loadFile(path.join(__dirname, "renderer", "index.html"));
  // 部分 Windows 环境未触发 ready-to-show；页面加载完成后仍应显示主窗口。
  if (!launchHidden && !window.isVisible()) window.show();
});
app.on("window-all-closed", () => app.quit());
app.on("activate", () => { if (window && !window.isDestroyed()) showWindow(window); });
app.on("before-quit", () => {
  markQuitting();
  for (const session of sessions.values()) session.disconnect();
});
