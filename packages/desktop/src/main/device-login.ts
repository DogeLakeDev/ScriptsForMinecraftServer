/**
 * device-login.ts — 桌面端“用小程序登录”管理网关
 *
 * 使用场景：实例设置对话框（管理网关）点击“用小程序登录”：
 *   1. startDeviceLogin 向网关 /auth/device/start 发起，得到 deviceId、6 位登录码与 pollSecret；
 *   2. 渲染层展示二维码（encodeDeviceLoginLink）与登录码，管理员用小程序扫码或输入登录码批准；
 *   3. pollDeviceLogin 轮询 /auth/device/poll，批准后拿到设备凭证 `sfmcd1.…`，作为该实例的访问令牌保存。
 * pollSecret 只保存在主进程内存里，渲染层只拿到 deviceId。
 */
import os from "node:os";
import QRCode from "qrcode";
import { encodeDeviceLoginLink } from "@sfmc-bds/management";
import type { DeviceLoginStatus, DeviceLoginTicket } from "../shared/api.js";
import { normalizeEndpoint } from "../shared/gateway-url.js";

/** 等待中的登录请求：deviceId → 网关地址与轮询密钥 */
const pending = new Map<string, { endpoint: string; pollSecret: string; expiresAt: number }>();

/** 提交给网关的设备名称（小程序确认框与已授权设备列表展示；网关会截断到 48 字） */
function deviceName(): string {
  return `SFMC Desktop · ${os.hostname()}`;
}

/** POST JSON 到网关，非 2xx 时抛出网关返回的错误文案 */
async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw new Error(`无法连接网关：${error instanceof Error ? error.message : String(error)}`);
  }
  const data = (await response.json().catch(() => ({}))) as { error?: unknown };
  if (!response.ok) throw new Error(typeof data.error === "string" && data.error ? data.error : `网关返回 HTTP ${response.status}`);
  return data as T;
}

/** 清理已过期的等待记录 */
function prune(): void {
  const now = Date.now();
  for (const [id, row] of pending) if (row.expiresAt <= now) pending.delete(id);
}

/** 发起设备登录 */
export async function startDeviceLogin(endpointInput: string): Promise<DeviceLoginTicket> {
  prune();
  const endpoint = normalizeEndpoint(endpointInput);
  const started = await postJson<{ deviceId: string; userCode: string; pollSecret: string; expiresAt: number; intervalMs: number }>(
    `${endpoint}/auth/device/start`,
    { name: deviceName() },
  );
  pending.set(started.deviceId, { endpoint, pollSecret: started.pollSecret, expiresAt: started.expiresAt });
  const qrDataUrl = await QRCode.toDataURL(encodeDeviceLoginLink({ deviceId: started.deviceId, endpoint }), { margin: 1, width: 240, errorCorrectionLevel: "M" });
  return { deviceId: started.deviceId, userCode: started.userCode, expiresAt: started.expiresAt, intervalMs: started.intervalMs, qrDataUrl };
}

/** 轮询一次登录结果；得到最终结果（批准 / 拒绝 / 过期）后丢弃该请求 */
export async function pollDeviceLogin(deviceId: string): Promise<DeviceLoginStatus> {
  prune();
  const row = pending.get(deviceId);
  if (!row) return { status: "expired" };
  const result = await postJson<{ status: string; credential?: string; approvedByName?: string; expiresAt?: number }>(`${row.endpoint}/auth/device/poll`, {
    deviceId,
    pollSecret: row.pollSecret,
  });
  if (result.status === "pending") return { status: "pending" };
  pending.delete(deviceId);
  if (result.status === "approved" && result.credential) {
    return { status: "approved", credential: result.credential, approvedByName: result.approvedByName ?? "", expiresAt: Number(result.expiresAt) || 0 };
  }
  return { status: result.status === "denied" ? "denied" : "expired" };
}

/** 放弃等待 */
export function cancelDeviceLogin(deviceId: string): void {
  pending.delete(deviceId);
}
