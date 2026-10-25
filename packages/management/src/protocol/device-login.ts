/**
 * device-login.ts — 桌面端“用小程序登录”二维码的内容格式
 *
 * 使用场景：桌面端向 mp-gateway 发起设备登录后，把 deviceId 与网关地址编码进二维码（encodeDeviceLoginLink）；
 * 管理员用小程序扫码后解析（parseDeviceLoginLink），再向同一网关批准该请求。
 * 两端共用这一份格式（DRY）。只用字符串处理，不依赖 URL 类（小程序运行环境不保证提供）。
 *
 * 格式：sfmc://device-login?d=<deviceId>&e=<网关地址，encodeURIComponent>
 */

/** 二维码内容前缀 */
export const DEVICE_LOGIN_LINK_PREFIX = "sfmc://device-login?";

/** 二维码携带的信息 */
export interface DeviceLoginLink {
  /** 网关 /auth/device/start 返回的 deviceId */
  deviceId: string;
  /** 发起登录的网关基础地址（https://…），小程序据此确认是同一台服务器 */
  endpoint: string;
}

/** 生成二维码内容 */
export function encodeDeviceLoginLink(link: DeviceLoginLink): string {
  return `${DEVICE_LOGIN_LINK_PREFIX}d=${encodeURIComponent(link.deviceId)}&e=${encodeURIComponent(link.endpoint)}`;
}

/** 解析二维码内容；不是设备登录二维码或缺少字段时返回 null */
export function parseDeviceLoginLink(text: string): DeviceLoginLink | null {
  const value = text.trim();
  if (!value.startsWith(DEVICE_LOGIN_LINK_PREFIX)) return null;
  const fields: Record<string, string> = {};
  for (const pair of value.slice(DEVICE_LOGIN_LINK_PREFIX.length).split("&")) {
    const at = pair.indexOf("=");
    if (at <= 0) continue;
    try {
      fields[pair.slice(0, at)] = decodeURIComponent(pair.slice(at + 1));
    } catch {
      return null;
    }
  }
  const deviceId = fields.d ?? "";
  const endpoint = fields.e ?? "";
  if (!deviceId || !/^https?:\/\//.test(endpoint)) return null;
  return { deviceId, endpoint };
}
