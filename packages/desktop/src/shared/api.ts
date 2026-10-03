import type { ManagementEvent, ManagementMethod, ManagementMethodMap, Handshake } from "@sfmc-bds/management";
export interface InstanceProfile {
  id: string; name: string; kind: "local" | "ssh"; root: string;
  host?: string; port?: number; username?: string; os?: "linux" | "windows";
  privateKeyPath?: string; remember?: boolean; hasCredential?: boolean;
}
export interface Credentials { password?: string; passphrase?: string }
/**
 * 外观模式：跟随系统 / 浅色 / 深色。
 * 使用场景：渲染层主题切换后通过 appearance() 通知主进程，
 * 主进程据此设置 nativeTheme.themeSource 并同步标题栏覆盖层（窗口按钮区）配色。
 */
export type AppearanceMode = "system" | "light" | "dark";
/**
 * 客户端自身信息。
 * 使用场景：侧边栏页脚版本号、"关于与更新"对话框中展示客户端版本与运行形态。
 */
export interface AppInfo { version: string; platform: string; packaged: boolean }
export interface DesktopApi {
  profiles(): Promise<InstanceProfile[]>;
  saveProfile(profile: InstanceProfile, credentials: Credentials): Promise<InstanceProfile[]>;
  removeProfile(id: string): Promise<InstanceProfile[]>;
  connect(id: string, credentials?: Credentials): Promise<Handshake>;
  disconnect(id: string): Promise<void>;
  confirmHost(id: string): Promise<boolean>;
  request<K extends ManagementMethod>(id: string, method: K, params?: unknown): Promise<ManagementMethodMap[K]>;
  choose(kind: "directory" | "privateKey" | "pack"): Promise<string | null>;
  uploadPack(id: string): Promise<{ filename: string } | null>;
  update(action: "check" | "download" | "install"): Promise<unknown>;
  openLink(kind: "eula" | "desktop-release"): Promise<void>;
  /** 设置外观模式并同步窗口原生部分（标题栏按钮区、窗口底色） */
  appearance(mode: AppearanceMode): Promise<void>;
  /** 读取客户端版本与运行形态 */
  appInfo(): Promise<AppInfo>;
  onEvent(callback: (id: string, event: ManagementEvent) => void): () => void;
  onConnection(callback: (id: string, message: string) => void): () => void;
}
declare global { interface Window { sfmc: DesktopApi } }
