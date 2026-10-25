/**
 * domain/bind-providers.ts — 外部账号 ↔ 游戏账号绑定的提供方抽象与短码生成
 *
 * 使用场景：QQ 与微信两种绑定共用游戏内同一个 `/c:bind` 流程。
 * - routes/bind-confirm.ts 按注册顺序询问每个提供方“这个短码是不是你的”，交给对应提供方确认（OCP：新增渠道只需注册新提供方）；
 * - 各渠道申请短码时用 generateBindCode 生成，在所有提供方的待确认表里都不重复，保证统一确认入口不会认错渠道。
 */

import { randomInt } from "node:crypto";

/** 绑定短码有效期（与 QQ 原有流程一致） */
export const BIND_CODE_TTL_MS = 5 * 60 * 1000;
/** 绑定短码位数（与 QQ 原有流程一致；游戏侧接受 4–8 位数字） */
export const BIND_CODE_LEN = 6;

/** 游戏侧提交的确认请求 */
export interface BindConfirmInput {
  code: string;
  xuid: string;
  name: string;
  now: number;
}

/** 确认结果：成功带绑定记录；失败带 HTTP 状态与错误码（错误码与 QQ 原接口一致，游戏侧据此提示） */
export type BindConfirmResult =
  | { ok: true; binding: Record<string, unknown> }
  | { ok: false; status: number; error: string; hint?: string };

/**
 * 绑定提供方契约。
 * 使用场景：QQ（domain/qq-bind.ts）与微信（domain/wechat-bind.ts）各实现一份，由 index.ts 组装成列表注入统一确认路由（LSP：确认语义一致）。
 */
export interface BindProvider {
  /** 渠道标识，返回给游戏侧用于提示文案（qq / wechat） */
  readonly id: string;
  /** 待确认表里是否存在该短码（不判断过期，过期交给 confirm 返回 code_expired） */
  hasPendingCode(code: string): boolean;
  /** 用短码完成绑定 */
  confirm(input: BindConfirmInput): BindConfirmResult;
}

/** 生成一个纯数字短码 */
function randomCode(length: number): string {
  let s = "";
  for (let i = 0; i < length; i++) s += String(randomInt(0, 10));
  return s;
}

/**
 * 生成在所有提供方中都未被占用的短码；多次碰撞后返回空串，由调用方回 code_gen_failed。
 *
 * @param isTaken 判断短码是否已被任一提供方占用。
 */
export function generateBindCode(isTaken: (code: string) => boolean, length = BIND_CODE_LEN): string {
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = randomCode(length);
    if (!isTaken(candidate)) return candidate;
  }
  return "";
}

/**
 * 由提供方列表构造“短码是否已占用”判断。
 * 使用场景：index.ts 组装后注入 QQ / 微信申请短码的路由，两边共用同一个判断（DRY）。
 */
export function codeTakenBy(providers: () => readonly BindProvider[]): (code: string) => boolean {
  return (code) => providers().some((provider) => provider.hasPendingCode(code));
}

/**
 * 统一确认：找到持有该短码的提供方并确认；都没有时返回 invalid_code。
 * 使用场景：routes/bind-confirm.ts。返回值附带 provider，游戏侧据此决定提示文案和是否解除访客限制。
 */
export function confirmWithProviders(
  providers: readonly BindProvider[],
  input: BindConfirmInput
): (BindConfirmResult & { provider?: string }) {
  for (const provider of providers) {
    if (!provider.hasPendingCode(input.code)) continue;
    return { ...provider.confirm(input), provider: provider.id };
  }
  return { ok: false, status: 400, error: "invalid_code" };
}
