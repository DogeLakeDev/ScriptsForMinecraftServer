/**
 * cx.ts — 类名拼接工具
 *
 * 使用场景：组件按状态组合 className（如 cx("btn", primary && "btn-primary")），忽略 false / 空值，
 * 避免各处手写模板字符串拼接（DRY）。
 */
export function cx(...parts: (string | false | null | undefined | 0)[]): string {
  return parts.filter(Boolean).join(" ");
}
