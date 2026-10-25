/**
 * util.ts — 平台 QQ / 微信绑定纯逻辑工具
 *
 * 当前用于 /c:bind 确认失败时的玩家可读文案，以及确认请求的入口选择（统一入口 + 旧接口回退）。
 */

/** 平台 error 码 → 玩家可读文案 */
export function formatConfirmError(error: string | undefined): string {
  switch (error) {
    case "invalid_code":
      return "绑定码无效，请回 QQ 或小程序重新申请绑定";
    case "code_expired":
      return "绑定码已过期，请回 QQ 或小程序重新申请";
    case "qq_already_bound":
      return "该 QQ 已绑定其他玩家，请先在 QQ 侧「解绑」";
    case "player_already_bound":
      return "你已绑定其他 QQ，请先解绑后再试";
    case "wechat_already_bound":
      return "该微信已绑定其他玩家，请先在小程序解绑";
    case "player_already_bound_wechat":
      return "你已绑定其他微信，请先在小程序解绑后再试";
    case "network_error":
      return "无法连接数据库服务，请稍后重试";
    default:
      return "绑定失败，请稍后重试";
  }
}

/** 统一确认入口（db-server 按短码定位 QQ / 微信渠道） */
export const BIND_CONFIRM_PATH = "/api/sfmc/bind/confirm";
/** 旧版 db-server 只有的 QQ 确认接口 */
export const LEGACY_QQ_CONFIRM_PATH = "/api/sfmc/qq/bind/confirm";

/** 一次确认请求的结果（与 HttpDB.typedRequest 返回结构一致的子集） */
export interface ConfirmResponse {
  ok: boolean;
  status: number;
  error?: string;
  data?: { provider?: unknown };
}

/** 确认结果：provider 表示绑定到的渠道（qq / wechat），游戏侧据此决定提示与是否解除访客限制 */
export interface BindConfirmOutcome {
  ok: boolean;
  error?: string;
  provider: string;
}

/**
 * 先调统一确认入口；返回 404（db-server 尚未升级、没有该路由）时回退到旧 QQ 接口。
 * 使用场景：qq-link/index.ts 的 postBindConfirm；抽成纯函数便于不依赖 @minecraft/server 单测。
 *
 * @param send 发送 POST 请求的函数（生产为 HttpDB.typedRequest）。
 */
export async function confirmBindWithFallback(
  send: (path: string) => Promise<ConfirmResponse>
): Promise<BindConfirmOutcome> {
  const unified = await send(BIND_CONFIRM_PATH);
  // 旧版 db-server 没有新路由：回 404 not_found；若配置了 http_auth，新路径不在其免鉴权名单里会先回 401。
  // 新版两种情况都不会出现（路由存在且免鉴权）；短码无效之类的业务错误是 400/409，不回退。
  if ((unified.status === 404 && unified.error === "not_found") || (unified.status === 401 && unified.error === "unauthorized")) {
    const legacy = await send(LEGACY_QQ_CONFIRM_PATH);
    return legacy.ok ? { ok: true, provider: "qq" } : { ok: false, error: legacy.error || "request_failed", provider: "qq" };
  }
  const provider = typeof unified.data?.provider === "string" ? unified.data.provider : "qq";
  return unified.ok ? { ok: true, provider } : { ok: false, error: unified.error || "request_failed", provider };
}
