/**
 * 脚本沙箱静默日志缓冲（断言用）+ 日志行节点 id 解析
 */

export type StructuredLogLevel = "info" | "warn" | "error" | "debug" | "success";

export type StructuredLogEvent = {
  t: number;
  level: StructuredLogLevel;
  source: string;
  text: string;
  nodeId?: string;
  runId?: number;
};

export const STRUCTURED_LOG_LEVEL_RANK: Record<StructuredLogLevel, number> = {
  debug: 0,
  info: 1,
  success: 1,
  warn: 2,
  error: 3,
};

export type LogSelectOpts = {
  /** 只取最近 N 条（先按其它条件筛，再截尾） */
  recentN?: number;
  /** 级别下限（含） */
  minLevel?: StructuredLogLevel;
  /** source 精确或包含匹配（不区分大小写） */
  source?: string;
  /** 限定某次 run */
  runId?: number;
};

const NODE_EQ = /\bnode=([^\s\]]+)/i;
/** 常见图节点 id：n123 / n1732… */
const NODE_BRACKET = /\[(n\d+)\]/i;

/** 从 Output / 剪贴板行解析 node id */
export function parseNodeIdFromLog(line: string): string | null {
  const raw = String(line ?? "");
  const eq = NODE_EQ.exec(raw);
  if (eq?.[1]) return eq[1].trim();
  const br = NODE_BRACKET.exec(raw);
  if (br?.[1]) return br[1].trim();
  // 整段就是节点 id
  const trimmed = raw.trim();
  if (/^n\d+$/i.test(trimmed)) return trimmed;
  return null;
}

/** 行末附加 node=<id>（已有则不重复） */
export function formatLogLineWithNode(text: string, nodeId?: string | null): string {
  const line = String(text ?? "");
  const id = nodeId?.trim();
  if (!id) return line;
  if (NODE_EQ.test(line) || line.includes(`[${id}]`)) return line;
  return `${line} node=${id}`;
}

export function pushLogEvent(
  buf: StructuredLogEvent[],
  ev: StructuredLogEvent,
  max = 500
): StructuredLogEvent[] {
  const next = [...buf, ev];
  return next.length > max ? next.slice(next.length - max) : next;
}

/** 按条件筛事件并抽出 text（供 assertLogMatch） */
export function selectLogTexts(
  events: StructuredLogEvent[],
  opts?: LogSelectOpts
): string[] {
  let rows = events;
  if (opts?.runId != null) {
    rows = rows.filter((e) => e.runId === opts.runId);
  }
  if (opts?.minLevel) {
    const floor = STRUCTURED_LOG_LEVEL_RANK[opts.minLevel];
    rows = rows.filter((e) => STRUCTURED_LOG_LEVEL_RANK[e.level] >= floor);
  }
  if (opts?.source?.trim()) {
    const needle = opts.source.trim().toLowerCase();
    rows = rows.filter(
      (e) => e.source.toLowerCase() === needle || e.source.toLowerCase().includes(needle)
    );
  }
  if (opts?.recentN != null && opts.recentN > 0 && rows.length > opts.recentN) {
    rows = rows.slice(rows.length - opts.recentN);
  }
  return rows.map((e) => e.text);
}

export function isStructuredLogEvent(x: unknown): x is StructuredLogEvent {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.t === "number" && typeof o.text === "string" && typeof o.source === "string";
}
