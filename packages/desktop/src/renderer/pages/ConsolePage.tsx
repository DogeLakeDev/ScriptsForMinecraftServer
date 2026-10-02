/**
 * ConsolePage.tsx — 日志控制台
 *
 * 使用场景：查看本次连接缓存的历史与实时日志（最多 5000 条），按来源/级别/关键字筛选，
 * 并向受管服务的标准输入发送一行命令（与原实现相同调用 services.send）。
 * 渲染只保留最近 RENDER_LIMIT 条匹配项，配合 content-visibility 保证大量日志时滚动流畅。
 */
import type { LogEntryWire } from "@sfmc-bds/management";
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useDesktop } from "../app/desktop.js";
import { Button, IconButton, SearchInput, Select } from "../components/controls.js";
import { toast } from "../components/feedback.js";
import { Icon } from "../components/icons.js";
import { Chip, Kbd } from "../components/ui.js";
import { hashHue, type Tone } from "../lib/format.js";

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

/** 格式化日志时间为 HH:mm:ss.SSS */
function clock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--:--:--";
  const pad = (value: number, length = 2) => String(value).padStart(length, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

/** 在文本中高亮关键字（不区分大小写） */
function highlight(text: string, query: string): ReactNode {
  if (!query) return text;
  const lower = text.toLowerCase();
  const needle = query.toLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (let index = lower.indexOf(needle); index !== -1; index = lower.indexOf(needle, cursor)) {
    parts.push(text.slice(cursor, index), <mark key={index}>{text.slice(index, index + needle.length)}</mark>);
    cursor = index + needle.length;
  }
  parts.push(text.slice(cursor));
  return parts.map((part, index) => <Fragment key={index}>{part}</Fragment>);
}

/** 切换集合中的一个值（返回新集合） */
function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function ConsolePage() {
  const { model, editable, request, guarded } = useDesktop();
  const logs = model.logs;
  const [query, setQuery] = useState("");
  const [sources, setSources] = useState<Set<string>>(new Set());
  const [levels, setLevels] = useState<Set<string>>(new Set());
  const [wrap, setWrap] = useState(true);
  const [follow, setFollow] = useState(true);
  /** 清屏时间点：只隐藏此前的日志，不删除缓存 */
  const [clearedAt, setClearedAt] = useState("");
  const [command, setCommand] = useState("");
  const [target, setTarget] = useState("bds");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const viewport = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const visibleLogs = useMemo(() => (clearedAt ? logs.filter((log) => log.time > clearedAt) : logs), [logs, clearedAt]);
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
  const rendered = filtered.slice(-RENDER_LIMIT);

  useLayoutEffect(() => {
    if (follow && viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight;
  }, [rendered.length, follow, logs]);

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
    if (!line || !editable) return;
    void guarded(() => request("services.send", { name: target, message: command })).then((result) => {
      if (!result) return;
      setHistory((previous) => [line, ...previous.filter((item) => item !== line)].slice(0, 50));
      setHistoryIndex(-1);
      setCommand("");
      setFollow(true);
    });
  };

  const copyVisible = () => {
    const text = filtered.map((log) => `${log.time} [${log.source}] [${log.level}] ${log.text}`).join("\n");
    void navigator.clipboard.writeText(text).then(() => toast.success(`已复制 ${filtered.length} 条日志`));
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
        <IconButton icon="wrap" label={wrap ? "关闭自动换行" : "自动换行"} size="sm" active={wrap} onClick={() => setWrap(!wrap)} />
        <IconButton icon="copy" label="复制当前筛选结果" size="sm" onClick={copyVisible} disabled={!filtered.length} />
        <IconButton icon="eraser" label="清屏" size="sm" onClick={() => setClearedAt(logs.at(-1)?.time ?? "")} disabled={!visibleLogs.length} />
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
          <button type="button" className="link-btn console-restore" onClick={() => setClearedAt("")}>恢复已清屏的 {logs.length - visibleLogs.length} 条</button>
        )}
      </div>
      <div className="console-frame">
        <div
          ref={viewport}
          className={`console-viewport${wrap ? " wrap" : ""}`}
          onScroll={(event) => {
            const element = event.currentTarget;
            const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 40;
            if (atBottom !== follow) setFollow(atBottom);
          }}
          role="log"
          aria-live="off"
        >
          {rendered.length ? (
            rendered.map((log, index) => (
              <div key={`${log.time}-${index}`} className={`log-row level-${log.level}`}>
                <span className="log-time">{clock(log.time)}</span>
                <span className="log-src" style={{ color: `hsl(${hashHue(log.source)} 58% var(--log-src-l))` }}>{log.source}</span>
                <span className="log-text">{highlight(log.text, query.trim())}</span>
              </div>
            ))
          ) : (
            <div className="console-empty">
              <Icon name="terminal" size={20} />
              <span>{logs.length ? "没有符合筛选条件的日志" : "等待日志输出…"}</span>
            </div>
          )}
        </div>
        {!follow && (
          <button
            type="button"
            className="console-jump"
            onClick={() => {
              setFollow(true);
              if (viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight;
            }}
          >
            <Icon name="arrowDown" size={13} /> 跳到最新
          </button>
        )}
        <div className="console-status">
          <span className={`console-follow${follow ? " on" : ""}`}>{follow ? "● 实时跟随" : "已暂停跟随"}</span>
        </div>
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
        <Button variant="primary" size="sm" disabled={!editable || !command.trim()} onClick={send} iconEnd="arrowRight">发送</Button>
      </div>
    </div>
  );
}
