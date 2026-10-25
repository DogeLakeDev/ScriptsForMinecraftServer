/**
 * gateway-url.ts — 管理网关地址的规整
 *
 * 使用场景：桌面端保存实例、建立 WebSocket、上传世界包时共用。
 * 规则与小程序 miniprogram/core/profiles.ts 一致：存成 http(s)，去掉末尾斜杠和误粘贴的 /manage、/health。
 */

/** 规整用户输入的网关地址。空串或格式不对时抛出说明。 */
export function normalizeEndpoint(input: string): string {
  let value = input.trim();
  if (!value) throw new Error("请填写网关地址");
  if (/[\r\n\0]/.test(value)) throw new Error("网关地址无效");
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
  return `${normalizeEndpoint(endpoint).replace(/^http/, "ws")}/manage`;
}

/** 世界包上传地址。name 用原文件名，网关负责生成收件箱文件名。 */
export function uploadUrl(endpoint: string, filename: string): string {
  return `${normalizeEndpoint(endpoint)}/packs/inbox?name=${encodeURIComponent(filename)}`;
}
