/**
 * repl-windows/sfmc-window.ts — 平台系统窗口（展示除活跃运行服务外所有来源的日志）
 */
import type { UnifiedLog } from "../logs.js";
import type { ServiceName } from "../services.js";
import { formatLogDisplay, logDisplayPrefixWidth } from "./format-display.js";
import type { ReplWindow } from "./types.js";

export const SFMC_WINDOW_ID = "sfmc";

export function createSfmcWindow(opts: {
  getActiveTargets: () => ServiceName[];
}): ReplWindow {
  return {
    id: SFMC_WINDOW_ID,
    title: "SFMC",
    showsInput: true,
    footerShortcuts: "",
    acceptLog(log: UnifiedLog): boolean {
      const active = opts.getActiveTargets();
      return !active.includes(log.source as ServiceName);
    },
    formatLogLine(log: UnifiedLog) {
      return {
        text: formatLogDisplay(log, { omitSource: false }),
        indent: logDisplayPrefixWidth(log, { omitSource: false }),
      };
    },
    getReplayFilter() {
      return { levels: [], sources: [] };
    },
  };
}
