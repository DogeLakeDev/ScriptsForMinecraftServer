/**
 * confirm-challenge.ts — 危险确认的校验文本匹配（平台无关）。
 *
 * Studio 预览与游戏内 Runtime 共用同一口径：
 * 求值后的 challenge 去两端空白，空串视为未启用；
 * 玩家输入与期望值比较时同样 trim，区分大小写。
 */

/** 求值后的校验文本是否启用输入确认。空串 / 非字符串视为未设置。 */
export function effectiveConfirmChallenge(resolved: unknown): string | undefined {
  if (typeof resolved !== "string") return undefined;
  const trimmed = resolved.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * 玩家输入是否等于校验文本。
 * 两端 trim，区分大小写；调用方应先用 effectiveConfirmChallenge 确认 expected 非空。
 */
export function confirmChallengeMatches(typed: string, expected: string): boolean {
  return typed.trim() === expected.trim();
}
