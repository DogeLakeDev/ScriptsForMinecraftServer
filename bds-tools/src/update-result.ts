/**
 * update-result.ts — BDS updater ↔ sfmc 监督器机器可读结果契约（DRY / DIP）
 *
 * 勿依赖本地化日志文案判断「是否真正部署」；一律解析本标记。
 */
export const UPDATE_RESULT_PREFIX = "SFMC_UPDATE_RESULT=";

export type UpdateResultKind = "uptodate" | "skipped" | "check-only" | "deployed";

/** 向 stdout 打印机器标记（供父进程捕获）。 */
export function emitUpdateResult(kind: UpdateResultKind): void {
  console.log(`${UPDATE_RESULT_PREFIX}${kind}`);
}

/** 从 updater 合并输出中解析是否完成部署。 */
export function didUpdateDeploy(out: string): boolean {
  return new RegExp(
    `(?:^|\\n)${UPDATE_RESULT_PREFIX}deployed(?:\\r?\\n|$)`
  ).test(out);
}
