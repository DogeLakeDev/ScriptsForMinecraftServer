/**
 * ConsolePage.tsx — 日志控制台
 *
 * 使用场景：查看本次连接缓存的历史与实时日志（最多 5000 条），按来源/级别/关键字筛选，
 * 也可用日历按本地日期和时间段向服务端重读。删除会改写 `.sfmc/logs` 里对应的行。
 * 清屏仍然只隐藏当前视图，不删除文件。
 * 渲染只保留最近 RENDER_LIMIT 条匹配项，配合 content-visibility 保证大量日志时滚动流畅。
 */
import type { LogEntryWire, LogsTailResult } from "@sfmc-bds/management";
import { hasCapability } from "../../shared/platform-next.js";
import { LOG_TAIL_MAX } from "../lib/log-range.js";
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useDesktop } from "../app/desktop.js";
import { Button, IconButton, SearchInput, Select } from "../components/controls.js";
import { toast, useConfirm } from "../components/feedback.js";
import { Icon } from "../components/icons.js";
import { LogRangePicker } from "../components/LogRangePicker.js";
import { Chip, Kbd } from "../components/ui.js";
import { findLogIndex } from "../lib/alerts.js";
import { errorText, hashHue, type Tone } from "../lib/format.js";
import { highlightLogSpans } from "../lib/log-highlight.js";
import { dayKey, logInBounds, rangeBounds, rangeLabel, secondWindow, type LogRangeValue } from "../lib/log-range.js";

/** 单次渲染的最大日志行数 */
const RENDER_LIMIT = 1500;
/** 级别 → 文案与语气 */
const LEVELS: { value: LogEntryWire["level"]; label: string; tone: Tone }[] = [
  { value: "error", label: "错误", tone: "danger" },
  { value: "warn", label: "警告", tone: "warning" },
  { value: "info", label: "信息", tone: "info" },
  { value: "success", label: "成功", tone: "success" },
  { value: "debug", label: "调试", tone: "neutral" },
];
/** 可接收命令的服务（与原实现一致） */
const COMMAND_TARGETS = ["bds", "db", "qq", "llbot"];

/** 格式化日志时间。跨日或正在按日期筛选时带上月-日。 */
function clock(iso: string, withDate: boolean): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--:--:--";
  const pad = (value: number, length = 2) => String(value).padStart(length, "0");
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
  return withDate ? `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${time}` : time;
}

/** 合并按日期读回的历史和连接期间新到的、落在同一范围内的日志。 */
function mergeRanged(remote: LogEntryWire[], live: LogEntryWire[], since: string, until: string): LogEntryWire[] {
  const seen = new Set(remote.map((log) => `${log.time}\0${log.source}\0${log.level}\0${log.text}`));
  const extra = live.filter((log) => logInBounds(log, since, until) && !seen.has(`${log.time}\0${log.source}\0${log.level}\0${log.text}`));
  return extra.length ? [...remote, ...extra].sort((a, b) => a.time < b.time ? -1 : a.time > b.time ? 1 : 0) : remote;
}

/** 在一段已经着过色的文本里标出搜索词（不区分大小写） */
function markNeedle(text: string, needle: string, keyBase: number): ReactNode {
  const lower = text.toLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (let index = lower.indexOf(needle); index !== -1; index = lower.indexOf(needle, cursor)) {
    parts.push(text.slice(cursor, index), <mark key={`${keyBase}-${index}`}>{text.slice(index, index + needle.length)}</mark>);
    cursor = index + needle.length;
  }
  if (!parts.length) return text;
  parts.push(text.slice(cursor));
  return parts;
}

/**
 * 日志正文：关键词着色与 REPL 相同，搜索词仍用 mark 标出。
 * 使用场景：日志控制台每一行的正文。
 */
function highlight(text: string, query: string): ReactNode {
  const needle = query.toLowerCase();
  return highlightLogSpans(text).map((span, index) => {
    const body = needle ? markNeedle(span.text, needle, index) : span.text;
    if (!span.tone && !span.bold) return <Fragment key={index}>{body}</Fragment>;
    const className = [span.tone ? `log-hl-${span.tone}` : "", span.bold ? "log-hl-bold" : ""].filter(Boolean).join(" ");
    return (
      <span key={index} className={className}>
        {body}
      </span>
    );
  });
}

/** 切换集合中的一个值（返回新集合） */
function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function ConsolePage() {
  const { model, editable, request, guarded, logFocus, clearLogFocus, patch, current } = useDesktop();
  const confirm = useConfirm();
  const logs = model.logs;
  const logsRef = useRef(logs);
  logsRef.current = logs;
  const canRange = hasCapability(model.handshake?.capabilities, "logs-range");
  const [query, setQuery] = useState("");
  const [sources, setSources] = useState<Set<string>>(new Set());
  const [levels, setLevels] = useState<Set<string>>(new Set());
  const [wrap, setWrap] = useState(true);
  const [follow, setFollow] = useState(true);
  /** 清屏时间点：只隐藏此前的日志，不删除缓存 */
  const [clearedAt, setClearedAt] = useState("");
  /** 日历选出的本地时间范围。为空表示不限时间。 */
  const [range, setRange] = useState<LogRangeValue | null>(null);
  /** 按范围从日志文件读回的历史。旧平台没有该能力时保持 null，只筛已加载的行。 */
  const [rangedLogs, setRangedLogs] = useState<LogEntryWire[] | null>(null);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [rangeTruncated, setRangeTruncated] = useState(false);
  const [rangeEpoch, setRangeEpoch] = useState(0);
  const [command, setCommand] = useState("");
  const sendingRef = useRef(false);
  const [sending, setSending] = useState(false);
  const [target, setTarget] = useState("bds");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const viewport = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const focusRow = useRef<HTMLDivElement>(null);
  const missingFocus = useRef(0);
  const focusNonce = logFocus?.nonce ?? 0;
  const [seenFocus, setSeenFocus] = useState(0);
  if (logFocus && focusNonce !== seenFocus) {
    setSeenFocus(focusNonce);
    setQuery("");
    setSources(new Set());
    setLevels(new Set());
    setClearedAt("");
    // 缓冲里已经没有这条报错时，按它所在的本地日重新读取日志文件。
    const stamp = new Date(logFocus.entry.time);
    const inBuffer = findLogIndex(logs, logFocus.entry) >= 0;
    if (!inBuffer && canRange && !Number.isNaN(stamp.getTime())) {
      const day = dayKey(stamp);
      setRange({ startDay: day, endDay: day, startTime: "00:00", endTime: "23:59" });
    } else {
      setRange(null);
    }
    setFollow(false);
  }

  const bounds = range ? rangeBounds(range) : null;
  const since = bounds?.since ?? "";
  const until = bounds?.until ?? "";
  useEffect(() => {
    if (!range || !canRange || !since || !until || since > until) {
      setRangedLogs(null);
      setRangeTruncated(false);
      setRangeLoading(false);
      return;
    }
    let cancelled = false;
    setRangedLogs(null);
    setRangeTruncated(false);
    setRangeLoading(true);
    request("logs.tail", { limit: LOG_TAIL_MAX, since, until })
      .then((result: LogsTailResult) => {
        if (cancelled) return;
        setRangedLogs(result.entries);
        setRangeTruncated(result.truncated === true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setRangedLogs([]);
        setRangeTruncated(false);
        toast.error("无法按日期读取日志", errorText(error));
      })
      .finally(() => { if (!cancelled) setRangeLoading(false); });
    return () => { cancelled = true; };
  }, [canRange, request, range, rangeEpoch, since, until]);

  const pool = useMemo(() => {
    if (!bounds) return logs;
    if (!canRange || !rangedLogs) return logs.filter((log) => logInBounds(log, bounds.since, bounds.until));
    return mergeRanged(rangedLogs, logs, bounds.since, bounds.until);
  }, [bounds, canRange, logs, rangedLogs]);
  const visibleLogs = useMemo(() => (clearedAt ? pool.filter((log) => log.time > clearedAt) : pool), [pool, clearedAt]);
  const sourceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const log of visibleLogs) counts.set(log.source, (counts.get(log.source) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [visibleLogs]);
  const levelCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const log of visibleLogs) counts.set(log.level, (counts.get(log.level) ?? 0) + 1);
    return counts;
  }, [visibleLogs]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return visibleLogs.filter(
      (log) =>
        (!sources.size || sources.has(log.source)) &&
        (!levels.size || levels.has(log.level)) &&
        (!needle || log.text.toLowerCase().includes(needle))
    );
  }, [visibleLogs, sources, levels, query]);
  const today = dayKey(new Date());
  const showDate = Boolean(range) || filtered.some((log) => dayKey(new Date(log.time)) !== today);
  const focusIndex = logFocus ? findLogIndex(filtered, logFocus.entry) : -1;
  const renderStart = focusIndex >= 0
    ? Math.max(0, Math.min(Math.max(0, focusIndex - 80), Math.max(0, filtered.length - RENDER_LIMIT)))
    : Math.max(0, filtered.length - RENDER_LIMIT);
  const rendered = filtered.slice(renderStart, renderStart + RENDER_LIMIT);

  useLayoutEffect(() => {
    if (logFocus || !follow || !viewport.current) return;
    viewport.current.scrollTop = viewport.current.scrollHeight;
  }, [rendered.length, follow, logs, logFocus]);
  useLayoutEffect(() => {
    focusRow.current?.scrollIntoView({ block: "center", inline: "nearest" });
  }, [logFocus, focusIndex]);
  useEffect(() => {
    if (!logFocus || missingFocus.current === logFocus.nonce) return;
    if (findLogIndex(pool, logFocus.entry) >= 0) {
      missingFocus.current = logFocus.nonce;
      return;
    }
    if (rangeLoading) return;
    if (canRange && bounds && rangedLogs === null) return;
    missingFocus.current = logFocus.nonce;
    toast.warning("这条日志已不在当前记录中");
  }, [bounds, canRange, logFocus, pool, rangeLoading, rangedLogs]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  const send = () => {
    const line = command.trim();
    if (!line || !editable || sendingRef.current) return;
    const submitted = command;
    sendingRef.current = true;
    setSending(true);
    void guarded(() => request("services.send", { name: target, message: command })).then((result) => {
      if (!result) return;
      setHistory((previous) => [line, ...previous.filter((item) => item !== line)].slice(0, 50));
      setHistoryIndex(-1);
      setCommand((draft) => draft === submitted ? "" : draft);
      setFollow(true);
    }).finally(() => {
      sendingRef.current = false;
      setSending(false);
    });
  };

  const copyVisible = () => {
    const text = filtered.map((log) => `${log.time} [${log.source}] [${log.level}] ${log.text}`).join("\n");
    void navigator.clipboard.writeText(text).then(() => toast.success(`已复制 ${filtered.length} 条日志`));
  };

  /** 从当前连接缓存里去掉已删除的行。实时推送不会重放这些历史。 */
  const dropLoaded = (match: (log: LogEntryWire) => boolean) => {
    patch(current, { logs: logsRef.current.filter((log) => !match(log)) });
    setRangedLogs((rows) => rows?.filter((log) => !match(log)) ?? rows);
    setRangeEpoch((value) => value + 1);
  };
  const deleteRange = () => {
    if (!bounds || !editable) return;
    const label = rangeLabel(range);
    void confirm({
      title: "删除这段时间的日志",
      description: `将从日志文件中删除 ${label} 的记录。来源、级别和关键字筛选不会缩小删除范围。无法识别的行会保留。`,
      acknowledge: "我了解这些日志删除后无法恢复",
      danger: true,
      okText: "删除",
      icon: "trash",
      onConfirm: async () => {
        const result = await request("logs.delete", { since: bounds.since, until: bounds.until });
        dropLoaded((log) => logInBounds(log, bounds.since, bounds.until));
        toast.success(`已删除 ${result.removed} 条日志`);
      },
    });
  };
  const deleteLine = (log: LogEntryWire) => {
    const window = secondWindow(log.time);
    if (!window || !editable) return;
    void confirm({
      title: "删除这条日志",
      description: "将从日志文件中删除这一秒内来源和正文相同的记录。",
      danger: true,
      okText: "删除",
      icon: "trash",
      onConfirm: async () => {
        const result = await request("logs.delete", { ...window, source: log.source, text: log.text });
        dropLoaded((row) => row.source === log.source && row.text === log.text && logInBounds(row, window.since, window.until));
        toast.success(result.removed ? `已删除 ${result.removed} 条日志` : "日志文件中没有对应的行");
      },
    });
  };

  return (
    <div className="page page-fill console-page">
      <div className="console-toolbar">
        <SearchInput
          className="console-search"
          size="sm"
          inputRef={searchRef}
          value={query}
          onChange={setQuery}
          placeholder="搜索已加载的日志"
          aria-label="搜索日志"
          hint={<span className="input-keys"><Kbd>Ctrl</Kbd><Kbd>F</Kbd></span>}
        />
        <div className="chip-row" role="group" aria-label="级别">
          {LEVELS.filter((level) => levelCounts.has(level.value) || levels.has(level.value)).map((level) => (
            <Chip key={level.value} tone={level.tone} active={levels.has(level.value)} count={levelCounts.get(level.value) ?? 0} onClick={() => setLevels((previous) => toggle(previous, level.value))}>
              {level.label}
            </Chip>
          ))}
        </div>
        <span className="toolbar-spacer" />
        <LogRangePicker value={range} onChange={(next) => { setRange(next); setClearedAt(""); }} />
        {canRange && (
          <IconButton icon="trash" label="删除此时间范围" size="sm" danger tooltip={!editable ? "当前为只读" : range ? "从日志文件删除这个时间范围" : "先用日历选一段时间"} disabled={!editable || !range} onClick={deleteRange} />
        )}
        <IconButton icon="wrap" label={wrap ? "关闭自动换行" : "自动换行"} size="sm" active={wrap} onClick={() => setWrap(!wrap)} />
        <IconButton icon="copy" label="复制当前筛选结果" size="sm" onClick={copyVisible} disabled={!filtered.length} />
        <IconButton icon="eraser" label="清屏" size="sm" onClick={() => setClearedAt(pool.at(-1)?.time ?? "")} disabled={!visibleLogs.length} />
      </div>
      <div className="chip-row console-sources" role="group" aria-label="来源">
        <Chip active={!sources.size} onClick={() => setSources(new Set())} count={visibleLogs.length}>全部来源</Chip>
        {sourceCounts.map(([source, count]) => (
          <Chip key={source} active={sources.has(source)} count={count} onClick={() => setSources((previous) => toggle(previous, source))}>
            <span className="src-swatch" style={{ background: `hsl(${hashHue(source)} 60% 52%)` }} />
            {source}
          </Chip>
        ))}
        {clearedAt && (
          <button type="button" className="link-btn console-restore" onClick={() => setClearedAt("")}>恢复已清屏的 {pool.length - visibleLogs.length} 条</button>
        )}
        {rangeTruncated && <span className="log-range-note">这个时间段只载入了最新 {LOG_TAIL_MAX} 条，更早的记录可以缩小范围后再查</span>}
      </div>
      <div className="console-frame">
        <div
          ref={viewport}
          className={`console-viewport${wrap ? " wrap" : ""}${showDate ? " with-date" : ""}`}
          onScroll={(event) => {
            const element = event.currentTarget;
            const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 40;
            if (atBottom !== follow) setFollow(atBottom);
          }}
          role="log"
          aria-live="off"
        >
          {rendered.length ? (
            rendered.map((log, index) => {
              const focused = renderStart + index === focusIndex;
              return (
                <div key={`${log.time}-${renderStart + index}`} ref={focused ? focusRow : undefined} className={`log-row level-${log.level}${focused ? " log-focus" : ""}`}>
                  <span className="log-time">{clock(log.time, showDate)}</span>
                  <span className="log-src" style={{ color: `hsl(${hashHue(log.source)} 58% var(--log-src-l))` }}>{log.source}</span>
                  <span className="log-text">{highlight(log.text, query.trim())}</span>
                  {canRange && (
                    <IconButton className="log-row-delete" icon="trash" label={`删除 ${clock(log.time, true)} 的日志`} size="sm" tooltip={false} disabled={!editable} onClick={() => deleteLine(log)} />
                  )}
                </div>
              );
            })
          ) : (
            <div className="console-empty">
              <Icon name="terminal" size={20} />
              <span>{rangeLoading ? "正在读取该时间段的日志…" : pool.length ? "没有符合筛选条件的日志" : logs.length && range ? "这个时间段没有日志" : "等待日志输出…"}</span>
            </div>
          )}
        </div>
        {!follow && (
          <button
            type="button"
            className="console-jump"
            onClick={() => {
              setFollow(true);
              clearLogFocus();
              if (viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight;
            }}
          >
            <Icon name="arrowDown" size={13} />
          </button>
        )}
      </div>
      <div className={`console-input${editable ? "" : " disabled"}`}>
        <Select
          value={target}
          onChange={setTarget}
          variant="ghost"
          size="sm"
          label="命令目标服务"
          options={COMMAND_TARGETS.map((value) => ({ value, label: <span className="mono">{value}</span> }))}
          className="console-target"
        />
        <span className="console-prompt">›</span>
        <input
          value={command}
          disabled={!editable}
          placeholder={editable ? "输入命令，Enter 发送" : "只读连接"}
          onChange={(event) => setCommand(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") { event.preventDefault(); send(); }
            else if (event.key === "ArrowUp" && history.length) {
              event.preventDefault();
              const next = Math.min(historyIndex + 1, history.length - 1);
              setHistoryIndex(next);
              setCommand(history[next] ?? "");
            } else if (event.key === "ArrowDown" && historyIndex >= 0) {
              event.preventDefault();
              const next = historyIndex - 1;
              setHistoryIndex(next);
              setCommand(next >= 0 ? history[next] ?? "" : "");
            }
          }}
        />
        <span className="console-input-hint"><Kbd>↑</Kbd> 历史</span>
        <Button variant="primary" size="sm" loading={sending} disabled={!editable || !command.trim()} onClick={send} iconEnd="arrowRight">发送</Button>
      </div>
    </div>
  );
}
