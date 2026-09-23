/**
 * 声明式动作 `effect: message` 的展示路由。
 *
 * 表单提交后 `runTask` 会把状态行写成「正在处理」；若反馈仍走聊天，
 * 玩家盯着未关闭的表单就看不见。关闭表单后状态行消失，才改走聊天 Msg。
 */

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 会重建页面、换掉当前 FormStatus 的 effect。 */
const REBUILD_EFFECTS = new Set(["navigate", "replace", "refresh", "back"]);

/** 状态行可用的语义：成功 / 失败 / 提示。 */
export type FormFeedbackKind = "ok" | "fail" | "info";

/** 反馈落点：仍开着的表单状态行，或聊天框。 */
export type FormFeedbackRoute = "form" | "chat";

/**
 * JSON tone 映射到 FormStatus 方法。
 * 使用场景：`effect: message` 在表单内替换「正在处理」。
 */
export function formFeedbackKind(tone: unknown): FormFeedbackKind {
  if (tone === "danger") return "fail";
  if (tone === "success") return "ok";
  return "info";
}

/**
 * 同一批 effect 里若有 close，表单马上关掉，状态行看不到，必须走聊天。
 * 使用场景：私聊切换成功后关面板；发送失败停留在当前表单则走状态行。
 */
export function formFeedbackRoute(effects: unknown): FormFeedbackRoute {
  if (!Array.isArray(effects)) return "form";
  for (const raw of effects) {
    if (isObject(raw) && raw.effect === "close") return "chat";
  }
  return "form";
}

/**
 * navigate / replace / refresh / back 会新建 FormStatus，当前状态行会被丢掉。
 * 使用场景：存款成功后 refresh，把「存款成功」挂到新页面的状态行。
 */
export function formFeedbackRebuildsStatus(effects: unknown): boolean {
  if (!Array.isArray(effects)) return false;
  for (const raw of effects) {
    if (
      isObject(raw) &&
      typeof raw.effect === "string" &&
      REBUILD_EFFECTS.has(raw.effect)
    ) {
      return true;
    }
  }
  return false;
}

type StatusSink = {
  ok(message: string): void;
  fail(message: string): void;
  info(message: string): void;
};

/**
 * 把一条动作提示写进 FormStatus，替换「正在处理」。
 * 使用场景：onError 仅 message、表单未关时。
 */
export function presentFormStatus(
  status: StatusSink,
  text: string,
  tone: unknown,
): void {
  const kind = formFeedbackKind(tone);
  if (kind === "fail") status.fail(text);
  else if (kind === "ok") status.ok(text);
  else status.info(text);
}
