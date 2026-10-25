/**
 * profiles.ts — 实例档案的本机存储与网关地址规整
 *
 * 使用场景：实例列表页 / 编辑页增删改档案；会话层按档案拼出 WebSocket 与上传地址。
 * 档案（含访问令牌）只存在本机 wx.storage，不经过任何第三方服务。
 */
import type { InstanceProfile } from "./types";

const PROFILES_KEY = "sfmc.profiles";
const LAST_KEY = "sfmc.lastProfile";

/** 读取全部档案 */
export function listProfiles(): InstanceProfile[] {
  const value = wx.getStorageSync(PROFILES_KEY) as unknown;
  return Array.isArray(value) ? (value as InstanceProfile[]) : [];
}

/** 按编号读取档案 */
export function findProfile(id: string): InstanceProfile | undefined {
  return listProfiles().find((row) => row.id === id);
}

/** 新建或更新档案（id 为空表示新建），返回保存后的档案 */
export function saveProfile(input: Omit<InstanceProfile, "id"> & { id?: string }): InstanceProfile {
  const rows = listProfiles();
  const id = input.id || `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const profile: InstanceProfile = { id, name: input.name.trim(), endpoint: normalizeEndpoint(input.endpoint), token: input.token.trim() };
  const index = rows.findIndex((row) => row.id === id);
  if (index >= 0) rows[index] = profile;
  else rows.push(profile);
  wx.setStorageSync(PROFILES_KEY, rows);
  return profile;
}

/** 删除档案 */
export function removeProfile(id: string): void {
  wx.setStorageSync(PROFILES_KEY, listProfiles().filter((row) => row.id !== id));
  if (lastProfileId() === id) wx.removeStorageSync(LAST_KEY);
}

/** 上次连接的档案编号，启动时据此自动连接 */
export function lastProfileId(): string {
  const value = wx.getStorageSync(LAST_KEY) as unknown;
  return typeof value === "string" ? value : "";
}

export function setLastProfile(id: string): void {
  if (id) wx.setStorageSync(LAST_KEY, id);
  else wx.removeStorageSync(LAST_KEY);
}

/**
 * 规整用户输入的网关地址。
 * 接受 https:// / wss:// / http:// / ws://，统一存成 http(s) 形式并去掉末尾斜杠；
 * 用户误把 /manage 或 /health 一起粘贴进来时也去掉。非法时抛出带说明的错误。
 */
export function normalizeEndpoint(input: string): string {
  let value = input.trim();
  if (!value) throw new Error("请填写网关地址");
  if (!/^[a-z]+:\/\//i.test(value)) value = `https://${value}`;
  const match = /^(https?|wss?):\/\/([^/?#\s]+)([^?#\s]*)$/i.exec(value);
  if (!match) throw new Error("网关地址格式不正确，例如 https://mc.example.com/sfmc");
  const scheme = match[1]!.toLowerCase();
  const secure = scheme === "https" || scheme === "wss";
  const pathPart = (match[3] ?? "").replace(/\/+$/, "").replace(/\/(manage|health)$/, "");
  return `${secure ? "https" : "http"}://${match[2]}${pathPart}`;
}

/** 管理通道 WebSocket 地址 */
export function socketUrl(endpoint: string): string {
  return `${endpoint.replace(/^http/, "ws")}/manage`;
}

/** 世界包上传地址 */
export function uploadUrl(endpoint: string, filename: string): string {
  return `${endpoint}/packs/inbox?name=${encodeURIComponent(filename)}`;
}

/** 是否为未加密地址（正式版小程序只能访问 https/wss，编辑页据此提示） */
export function isInsecure(endpoint: string): boolean {
  return endpoint.startsWith("http://");
}
