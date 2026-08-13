/**
 * repl-windows/service-window.ts — 活跃服务日志窗（省略源标签）
 */
import type { UnifiedLog } from "../logs.js";
import { getQqBackendMode, type ServiceName } from "../services.js";
import { formatLogDisplay, logDisplayPrefixWidth } from "./format-display.js";
import { serviceWindowId } from "./host.js";
import type { ReplWindow } from "./types.js";

function serviceWindowTitle(name: ServiceName): string {
  if (name === "qq") {
    return getQqBackendMode() === "llbot" ? "QQ·LLBOT" : "QQ·OFFICIAL";
  }
  return name.toUpperCase();
}

export function createServiceWindow(name: ServiceName): ReplWindow {
  const id = serviceWindowId(name);
  return {
    id,
    title: serviceWindowTitle(name),
    showsInput: true,
    footerShortcuts: "",
    serviceName: name,
    acceptLog(log: UnifiedLog): boolean {
      return log.source === name;
    },
    formatLogLine(log: UnifiedLog) {
      return {
        text: formatLogDisplay(log, { omitSource: true }),
        indent: logDisplayPrefixWidth(log, { omitSource: true }),
      };
    },
    getReplayFilter() {
      return { levels: [], sources: [name] };
    },
  };
}
