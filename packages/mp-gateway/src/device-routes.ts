/**
 * device-routes.ts — 桌面端“用小程序登录”的 HTTP 接口
 *
 *   POST …/auth/device/start     { name }                 → { deviceId, userCode, pollSecret, expiresAt, intervalMs }  桌面端发起（公开，限流）
 *   POST …/auth/device/poll      { deviceId, pollSecret } → { status, credential? }                                  桌面端轮询（公开）
 *   POST …/auth/device/describe  { deviceId | userCode }  → { deviceId, name, expiresAt }   小程序确认前查看（管理员）
 *   POST …/auth/device/approve   { deviceId | userCode }  → { deviceId, name, expiresAt }   批准（管理员）
 *   POST …/auth/device/deny      { deviceId | userCode }  → { denied: true }                拒绝（管理员）
 *   GET  …/auth/devices                                   → { devices }                      已授权设备（管理员）
 *   POST …/auth/devices/revoke   { id }                   → { revoked }                      撤销（管理员）
 *
 * 设备授权依赖微信管理员身份，未启用微信登录时整组接口回 503。
 */
import type { AuthThrottle } from "./auth.js";
import type { DeviceLogin, PendingRef } from "./device-login.js";
import { requireAdmin, type PlayerAuthDeps } from "./player-auth.js";
import { WECHAT_DISABLED } from "./player-routes.js";
import { HttpError, readJsonBody, stringField, type Route } from "./routes.js";
import { sendJson } from "./upload.js";

/** 设备路由依赖 */
export interface DeviceRouteDeps extends PlayerAuthDeps {
  wechatEnabled: boolean;
  devices: DeviceLogin;
  /** 发起登录的频率限制：每次发起都计数，防止刷满待授权队列 */
  startThrottle: AuthThrottle;
  log: (message: string) => void;
}

/** 从请求体取待授权请求的定位信息（二维码带 deviceId，手动输入带 6 位 userCode） */
function pendingRef(body: Record<string, unknown>): PendingRef {
  const deviceId = stringField(body, "deviceId");
  const userCode = stringField(body, "userCode");
  if (deviceId) return { deviceId };
  if (/^\d{6}$/.test(userCode)) return { userCode };
  throw new HttpError(400, "请提供二维码或 6 位登录码");
}

/**
 * 创建设备登录路由。
 * 使用场景：server.ts 拼入路由表。
 */
export function createDeviceRoutes(deps: DeviceRouteDeps): Route[] {
  const enabled = () => {
    if (!deps.wechatEnabled) throw WECHAT_DISABLED;
  };
  return [
    {
      method: "POST",
      suffix: "/auth/device/start",
      async handle(context) {
        enabled();
        if (deps.startThrottle.blocked(context.address)) throw new HttpError(429, "登录请求过于频繁，请稍后再试");
        deps.startThrottle.fail(context.address);
        const body = await readJsonBody(context.request);
        sendJson(context.response, 200, deps.devices.start(stringField(body, "name")));
      },
    },
    {
      method: "POST",
      suffix: "/auth/device/poll",
      async handle(context) {
        enabled();
        const body = await readJsonBody(context.request);
        const result = deps.devices.poll(stringField(body, "deviceId"), stringField(body, "pollSecret"));
        if (result.status === "approved") deps.log(`桌面设备已领取登录凭证 (${context.address})`);
        sendJson(context.response, 200, result);
      },
    },
    {
      method: "POST",
      suffix: "/auth/device/describe",
      async handle(context) {
        enabled();
        await requireAdmin(deps, context);
        sendJson(context.response, 200, deps.devices.describe(pendingRef(await readJsonBody(context.request))));
      },
    },
    {
      method: "POST",
      suffix: "/auth/device/approve",
      async handle(context) {
        enabled();
        const admin = await requireAdmin(deps, context);
        const view = deps.devices.approve(pendingRef(await readJsonBody(context.request)), { openid: admin.openid, name: admin.account.name });
        deps.log(`管理员 ${admin.account.name} 批准桌面设备登录: ${view.name}`);
        sendJson(context.response, 200, view);
      },
    },
    {
      method: "POST",
      suffix: "/auth/device/deny",
      async handle(context) {
        enabled();
        await requireAdmin(deps, context);
        deps.devices.deny(pendingRef(await readJsonBody(context.request)));
        sendJson(context.response, 200, { denied: true });
      },
    },
    {
      method: "GET",
      suffix: "/auth/devices",
      async handle(context) {
        enabled();
        await requireAdmin(deps, context);
        sendJson(context.response, 200, { devices: deps.devices.list() });
      },
    },
    {
      method: "POST",
      suffix: "/auth/devices/revoke",
      async handle(context) {
        enabled();
        const admin = await requireAdmin(deps, context);
        const id = stringField(await readJsonBody(context.request), "id");
        const revoked = deps.devices.revoke(id);
        if (revoked) deps.log(`管理员 ${admin.account.name} 撤销桌面设备授权: ${id}`);
        sendJson(context.response, 200, { revoked });
      },
    },
  ];
}
