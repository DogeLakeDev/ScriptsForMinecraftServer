/**
 * repl-windows/logs-filter-window.ts — /logs 筛选窗（无输入，快捷键筛选）
 */
import { SOURCE_META, type LogLevel, type LogSource, type UnifiedLog } from "../logs.js";
import { c } from "../theme.js";
import { formatLogDisplay, logDisplayPrefixWidth } from "./format-display.js";
import type { ReplWindow, WindowKeyEvent, WindowKeyResult } from "./types.js";

const LEVELS: Array<LogLevel | ""> = ["", "info", "warn", "error", "debug", "success"];

export type LogsFilterState = {
  levels: LogLevel[];
  sources: LogSource[];
};

function paintFooter(state: LogsFilterState): string {
  const lv = state.levels[0] ?? "*";
  const src = state.sources[0] ?? "*";
  return (
    `  ${c.cyan("L")}${c.dim(" level:")}${c.text(String(lv))}  ` +
    `${c.cyan("S")}${c.dim(" source:")}${c.text(String(src))}  ` +
    `${c.cyan("Esc")}${c.dim(" back")}`
  );
}

export function createLogsFilterWindow(opts: {
  getState: () => LogsFilterState;
  setState: (next: LogsFilterState) => void;
  onFilterChanged: () => void;
}): ReplWindow {
  const cycleLevel = (): void => {
    const st = opts.getState();
    const cur = st.levels[0] ?? "";
    const idx = LEVELS.indexOf(cur as LogLevel | "");
    const next = LEVELS[(idx + 1) % LEVELS.length]!;
    opts.setState({
      ...st,
      levels: next ? [next] : [],
    });
    opts.onFilterChanged();
  };

  const cycleSource = (): void => {
    const st = opts.getState();
    const names: Array<LogSource | ""> = ["", ...SOURCE_META.map((m) => m.value)];
    const cur = st.sources[0] ?? "";
    const idx = Math.max(0, names.indexOf(cur));
    const next = names[(idx + 1) % names.length]!;
    opts.setState({
      ...st,
      sources: next ? [next] : [],
    });
    opts.onFilterChanged();
  };

  return {
    id: "logs",
    title: "LOGS",
    showsInput: false,
    get footerShortcuts() {
      return paintFooter(opts.getState());
    },
    acceptLog(log: UnifiedLog): boolean {
      const st = opts.getState();
      if (st.levels.length && !st.levels.includes(log.level)) return false;
      if (st.sources.length && !st.sources.includes(log.source)) return false;
      return true;
    },
    formatLogLine(log: UnifiedLog) {
      return {
        text: formatLogDisplay(log, { omitSource: false }),
        indent: logDisplayPrefixWidth(log, { omitSource: false }),
      };
    },
    getReplayFilter() {
      const st = opts.getState();
      return { levels: st.levels, sources: st.sources };
    },
    onKey(ev: WindowKeyEvent): WindowKeyResult {
      if (ev.type === "escape") return { action: "back" };
      if (ev.type === "char") {
        const ch = ev.ch.toLowerCase();
        if (ch === "l") {
          cycleLevel();
          return { action: "redraw" };
        }
        if (ch === "s") {
          cycleSource();
          return { action: "redraw" };
        }
      }
      return { action: "handled" };
    },
  };
}
