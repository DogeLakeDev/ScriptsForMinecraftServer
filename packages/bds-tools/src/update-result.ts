/**
 * update-result.ts — BDS updater ↔ sfmc 监督器机器可读结果契约（DRY / DIP）
 *
 * 勿依赖本地化日志文案判断「是否真正部署」；一律解析本标记。
 * 写出走统一 Logger（bare stdout），避免 console.log 旁路。
 */
import type { Logger } from "@sfmc-bds/sdk/logs";

export const UPDATE_RESULT_PREFIX = "SFMC_UPDATE_RESULT=";

export type UpdateResultKind = "uptodate" | "skipped" | "check-only" | "deployed";

type InfoLogger = Pick<Logger, "info">;

/** 向 logger 打印机器标记（bare stdout 下仍为可解析纯文本）。 */
export function emitUpdateResult(kind: UpdateResultKind, log: InfoLogger): void {
  log.info(`${UPDATE_RESULT_PREFIX}${kind}`);
}

/** KEY=value 机器行（CURRENT/LATEST/CHANNEL/URLS 等） */
export function emitUpdateKv(key: string, value: string, log: InfoLogger): void {
  log.info(`${key}=${value}`);
}

/** 从 updater 合并输出中解析是否完成部署。 */
export function didUpdateDeploy(out: string): boolean {
  return new RegExp(`(?:^|\\n)${UPDATE_RESULT_PREFIX}deployed(?:\\r?\\n|$)`).test(out);
}
