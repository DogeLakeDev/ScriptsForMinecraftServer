import type { ManagementEvent, ManagementMethod, ManagementMethodMap, Handshake, ReleaseNotes } from "@sfmc-bds/management";
export interface InstanceProfile {
  id: string; name: string; kind: "local" | "ssh" | "gateway"; root: string;
  host?: string; port?: number; username?: string; os?: "linux" | "windows";
  privateKeyPath?: string; remember?: boolean; hasCredential?: boolean;
  /** 管理网关地址，例如 https://mc.example.com/sfmc。仅 kind 为 gateway 时使用。 */
  endpoint?: string;
}
export interface Credentials { password?: string; passphrase?: string; token?: string }
/**
 * 一次“用小程序登录”的待授权请求（pollSecret 留在主进程，不交给渲染层）。
 * 使用场景：实例设置对话框的网关区块展示二维码与 6 位登录码，并据 deviceId 轮询结果。
 */
export interface DeviceLoginTicket {
  deviceId: string;
  /** 小程序手动输入用的 6 位登录码 */
  userCode: string;
  expiresAt: number;
  /** 建议轮询间隔（毫秒） */
  intervalMs: number;
  /** 二维码图片（PNG data URL），内容为 @sfmc-bds/management 的 encodeDeviceLoginLink */
  qrDataUrl: string;
}
/** 设备登录轮询结果；approved 时 credential 作为该网关实例的访问令牌保存 */
export type DeviceLoginStatus =
  | { status: "pending" }
  | { status: "approved"; credential: string; approvedByName: string; expiresAt: number }
  | { status: "denied" }
  | { status: "expired" };
/**
 * 外观模式：跟随系统 / 浅色 / 深色。
 * 使用场景：渲染层主题切换后通过 appearance() 通知主进程，
 * 主进程据此设置 nativeTheme.themeSource 并同步标题栏覆盖层（窗口按钮区）配色。
 */
export type AppearanceMode = "system" | "light" | "dark";
export interface DesktopPreferences {
  tray: boolean;
  closeToTray: boolean;
  minimizeToTray: boolean;
  openAtLogin: boolean;
  startHidden: boolean;
}
/**
 * 客户端自身信息。
 * 使用场景：侧边栏页脚版本号、"关于与更新"对话框中展示客户端版本与运行形态。
 */
export interface AppInfo { version: string; platform: string; packaged: boolean }
export interface DesktopUpdateInfo { portable?: boolean; manual?: boolean; development?: boolean; available?: boolean; noRelease?: boolean; version?: string; releaseNotes?: ReleaseNotes }
export interface DesktopApi {
  profiles(): Promise<InstanceProfile[]>;
  saveProfile(profile: InstanceProfile, credentials: Credentials): Promise<InstanceProfile[]>;
  removeProfile(id: string): Promise<InstanceProfile[]>;
  connect(id: string, credentials?: Credentials): Promise<Handshake>;
  disconnect(id: string): Promise<void>;
  confirmHost(id: string): Promise<boolean>;
  request<K extends ManagementMethod>(id: string, method: K, params?: unknown): Promise<ManagementMethodMap[K]>;
  choose(kind: "directory" | "privateKey" | "pack"): Promise<string | null>;
  /**
   * 把世界包复制到实例收件箱。
   * 不传 paths 时打开可多选的文件框，取消返回 null。
   * 传入路径时用于拖入的文件，返回已上传的收件箱文件名。
   */
  uploadPack(id: string, paths?: string[]): Promise<{ filename: string }[] | null>;
  /** 拖入的 File 在 Electron 里对应的本机绝对路径。 */
  packFilePath(file: File): string;
  update(action: "check" | "download" | "install"): Promise<unknown>;
  openLink(kind: "eula" | "desktop-release" | "release", url?: string): Promise<void>;
  /** 设置外观模式并同步窗口原生部分（标题栏按钮区、窗口底色） */
  appearance(mode: AppearanceMode): Promise<void>;
  /** 读取客户端版本与运行形态 */
  appInfo(): Promise<AppInfo>;
  preferences(): Promise<DesktopPreferences>;
  setPreferences(patch: Partial<DesktopPreferences>): Promise<DesktopPreferences>;
  /** 向网关发起“用小程序登录”，返回二维码与登录码 */
  deviceLoginStart(endpoint: string): Promise<DeviceLoginTicket>;
  /** 轮询登录结果；非 pending 时主进程即丢弃该请求 */
  deviceLoginPoll(deviceId: string): Promise<DeviceLoginStatus>;
  /** 放弃等待（关闭对话框或重新发起） */
  deviceLoginCancel(deviceId: string): Promise<void>;
  onEvent(callback: (id: string, event: ManagementEvent) => void): () => void;
  /** progress 为 0–100 的已传输比例；没有字节进度时为 null。 */
  onConnection(callback: (id: string, message: string, progress: number | null) => void): () => void;
}
declare global { interface Window { sfmc: DesktopApi } }
