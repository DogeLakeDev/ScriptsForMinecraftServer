/**
 * AlertsSheet.tsx — 全部告警的档案与抽屉
 *
 * 使用场景：顶栏铃铛、总览和右侧动态栏都打开这一份列表。
 * 警告和错误按「来源 + 级别 + 正文」合并后按实例写在本地；守护进程支持按时间读日志时，再从日志文件把更早的报错补进来。
 */
import type { LogsTailResult } from "@sfmc-bds/management";
import { hasCapability } from "../../shared/platform-next.js";
import { LOG_TAIL_MAX } from "../lib/log-range.js";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useDesktop } from "../app/desktop.js";
import {
  alertKey,
  alertLineKey,
  foldAlertLines,
  loadAlertArchive,
  loadAlertSeen,
  loadHiddenAlerts,
  markCoveredLines,
  mergeAlertSnapshot,
  saveAlertArchive,
  saveAlertSeen,
  saveHiddenAlerts,
  type SavedAlert,
} from "../lib/alert-archive.js";
import { errorText, fullTime, relativeTime } from "../lib/format.js";
import { Button, IconButton, SearchInput } from "./controls.js";
import { toast } from "./feedback.js";
import { Sheet } from "./overlays.js";
import { Chip, EmptyState, IconTile } from "./ui.js";

/** 当前实例的告警档案，以及抽屉要用的操作。 */
interface AlertsApi {
  openAlerts: () => void;
  /** 未忽略的告警，最近出现的在前 */
  alerts: SavedAlert[];
  unread: number;
  hiddenCount: number;
  seenAt: number;
  scanning: boolean;
  truncated: boolean;
  /** 守护进程还不能按时间读日志文件，档案里只有本次连接已经载入的报错 */
  legacy: boolean;
  markAllRead: () => void;
  hideAlert: (alert: SavedAlert) => void;
  restoreHidden: () => void;
}

interface ArchiveState {
  id: string;
  alerts: SavedAlert[];
  seenAt: number;
  hidden: string[];
}

interface ScanState {
  id: string;
  ready: boolean;
  truncated: boolean;
  legacy: boolean;
}

const AlertsContext = createContext<AlertsApi | null>(null);

/** 读取告警档案。只能在 AlertsProvider 里面用。 */
export function useAlerts(): AlertsApi {
  const value = useContext(AlertsContext);
  if (!value) throw new Error("useAlerts 必须在 AlertsProvider 内使用");
  return value;
}

/** 从本地读出这个实例的告警、已读时间和忽略名单。 */
function readArchive(id: string): ArchiveState {
  return { id, alerts: loadAlertArchive(id), seenAt: loadAlertSeen(id), hidden: loadHiddenAlerts(id) };
}

function unreadCount(alerts: SavedAlert[], hidden: Set<string>, seenAt: number): number {
  return alerts.reduce((count, alert) => {
    if (hidden.has(alertKey(alert))) return count;
    return Date.parse(alert.lastTime) > seenAt ? count + 1 : count;
  }, 0);
}

/** 挂在桌面状态外层，让顶栏、总览和动态栏共用同一份告警档案。 */
export function AlertsProvider({ children }: { children: ReactNode }) {
  const { current, model, request } = useDesktop();
  const [archive, setArchive] = useState<ArchiveState>(() => readArchive(current));
  const [scan, setScan] = useState<ScanState>({ id: current, ready: false, truncated: false, legacy: false });
  const [open, setOpen] = useState(false);
  const resolved = archive.id === current ? archive : readArchive(current);
  if (archive.id !== current) setArchive(resolved);
  if (scan.id !== current) setScan({ id: current, ready: false, truncated: false, legacy: false });

  const appliedRef = useRef<{ id: string; keys: Set<string> }>({ id: current, keys: new Set() });
  if (appliedRef.current.id !== current) appliedRef.current = { id: current, keys: new Set() };
  const archiveRef = useRef(resolved);
  archiveRef.current = resolved;
  const logsRef = useRef(model.logs);
  logsRef.current = model.logs;

  const canRange = hasCapability(model.handshake?.capabilities, "logs-range");
  const capabilitiesKnown = Boolean(model.handshake);

  useEffect(() => {
    if (!current) return;
    const id = current;
    const rows = resolved.alerts;
    const timer = window.setTimeout(() => saveAlertArchive(id, rows), 400);
    return () => {
      window.clearTimeout(timer);
      // 切换实例时 ref 已经指向新实例，这里仍把旧实例的档案写回它自己的键。
      if (archiveRef.current.id !== id) saveAlertArchive(id, rows);
    };
  }, [current, resolved.alerts]);

  useEffect(() => () => {
    const state = archiveRef.current;
    if (state.id) saveAlertArchive(state.id, state.alerts);
  }, []);

  useEffect(() => {
    if (!current || !capabilitiesKnown) return;
    if (!canRange) {
      const state = archiveRef.current;
      if (state.id === current) markCoveredLines(state.alerts, logsRef.current, appliedRef.current.keys);
      setScan({ id: current, ready: true, truncated: false, legacy: true });
      return;
    }
    let cancelled = false;
    setScan({ id: current, ready: false, truncated: false, legacy: false });
    request("logs.tail", { levels: ["error", "warn"], since: new Date(0).toISOString(), limit: LOG_TAIL_MAX })
      .then((result: LogsTailResult) => {
        if (cancelled) return;
        const state = archiveRef.current;
        if (state.id !== current) return;
        for (const line of result.entries) appliedRef.current.keys.add(alertLineKey(line));
        const merged = mergeAlertSnapshot(state.alerts, result.entries);
        markCoveredLines(merged, logsRef.current, appliedRef.current.keys);
        setArchive((prev) => prev.id === current ? { ...prev, alerts: merged } : prev);
        setScan({ id: current, ready: true, truncated: result.truncated === true, legacy: false });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const state = archiveRef.current;
        if (state.id === current) markCoveredLines(state.alerts, logsRef.current, appliedRef.current.keys);
        setScan({ id: current, ready: true, truncated: false, legacy: false });
        toast.error("无更早的报错", errorText(error));
      });
    return () => { cancelled = true; };
  }, [canRange, capabilitiesKnown, current, request]);

  useEffect(() => {
    if (!current || scan.id !== current || !scan.ready) return;
    const state = archiveRef.current;
    if (state.id !== current) return;
    markCoveredLines(state.alerts, model.logs, appliedRef.current.keys);
    const next = foldAlertLines(state.alerts, model.logs, appliedRef.current.keys);
    if (next !== state.alerts) setArchive((prev) => prev.id === current ? { ...prev, alerts: next } : prev);
  }, [current, model.logs, scan]);

  const hidden = useMemo(() => new Set(resolved.hidden), [resolved.hidden]);
  const alerts = useMemo(() => resolved.alerts.filter((alert) => !hidden.has(alertKey(alert))), [hidden, resolved.alerts]);
  const unread = useMemo(() => unreadCount(resolved.alerts, hidden, resolved.seenAt), [hidden, resolved.alerts, resolved.seenAt]);

  const api = useMemo<AlertsApi>(() => ({
    openAlerts: () => setOpen(true),
    alerts,
    unread,
    hiddenCount: resolved.hidden.length,
    seenAt: resolved.seenAt,
    scanning: scan.id === current && !scan.ready && capabilitiesKnown,
    truncated: scan.id === current && scan.truncated,
    legacy: scan.id === current && scan.legacy,
    markAllRead: () => {
      if (!current) return;
      const seenAt = Date.now();
      saveAlertSeen(current, seenAt);
      setArchive((state) => state.id === current ? { ...state, seenAt } : state);
    },
    hideAlert: (alert) => {
      const key = alertKey(alert);
      setArchive((state) => {
        if (state.hidden.includes(key)) return state;
        const next = [...state.hidden, key];
        saveHiddenAlerts(state.id, next);
        return { ...state, hidden: next };
      });
    },
    restoreHidden: () => {
      setArchive((state) => {
        if (!state.hidden.length) return state;
        saveHiddenAlerts(state.id, []);
        return { ...state, hidden: [] };
      });
    },
  }), [alerts, capabilitiesKnown, current, resolved.hidden.length, resolved.seenAt, scan, unread]);

  return (
    <AlertsContext.Provider value={api}>
      {children}
      <AlertsSheet open={open} onClose={() => setOpen(false)} />
    </AlertsContext.Provider>
  );
}

/** 一条告警是否在上次「全部标为已读」之后又出现过。 */
function isUnread(alert: SavedAlert, seenAt: number): boolean {
  return Date.parse(alert.lastTime) > seenAt;
}

/** 全部告警抽屉：搜索、级别、来源、未读、复制、忽略，以及回到控制台。 */
function AlertsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { current, openLog } = useDesktop();
  const { alerts, unread, hiddenCount, seenAt, scanning, truncated, legacy, markAllRead, hideAlert, restoreHidden } = useAlerts();
  const [now, setNow] = useState(() => Date.now());
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<"all" | "error" | "warn">("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [source, setSource] = useState("");
  const [filterInstance, setFilterInstance] = useState(current);
  if (filterInstance !== current) {
    setFilterInstance(current);
    setQuery("");
    setLevel("all");
    setUnreadOnly(false);
    setSource("");
  }
  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [open]);

  const counts = useMemo(() => {
    let errors = 0;
    let warnings = 0;
    const sources = new Map<string, number>();
    for (const alert of alerts) {
      if (alert.level === "error") errors += 1;
      else warnings += 1;
      sources.set(alert.source, (sources.get(alert.source) ?? 0) + 1);
    }
    return { errors, warnings, sources: [...sources.entries()].sort((a, b) => b[1] - a[1]) };
  }, [alerts]);

  const needle = query.trim().toLowerCase();
  const filtered = alerts.filter((alert) => {
    if (level !== "all" && alert.level !== level) return false;
    if (source && alert.source !== source) return false;
    if (unreadOnly && !isUnread(alert, seenAt)) return false;
    if (!needle) return true;
    return alert.text.toLowerCase().includes(needle) || alert.source.toLowerCase().includes(needle);
  });

  const copyOne = (alert: SavedAlert) => {
    const text = `${alert.lastTime} [${alert.source}] [${alert.level}] ×${alert.count}\n${alert.text}`;
    void navigator.clipboard.writeText(text).then(
      () => toast.success("已复制"),
      () => toast.error("无法写入剪贴板"),
    );
  };
  const copyVisible = () => {
    const text = filtered.map((alert) => `${alert.lastTime} [${alert.source}] [${alert.level}] ×${alert.count} ${alert.text}`).join("\n");
    void navigator.clipboard.writeText(text).then(
      () => toast.success(`已复制 ${filtered.length} 条`),
      () => toast.error("无法写入剪贴板"),
    );
  };
  const jump = (alert: SavedAlert) => {
    onClose();
    openLog({ time: alert.lastTime, source: alert.source, level: alert.level, text: alert.text });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      width={640}
      title="告警"
      description={alerts.length ? `已保存 ${alerts.length} 条，错误 ${counts.errors}，警告 ${counts.warnings}` : "警告和错误"}
      actions={
        <>
          <Button size="sm" variant="ghost" icon="copy" disabled={!filtered.length} onClick={copyVisible}>复制</Button>
          <Button size="sm" variant="primary" disabled={!unread} onClick={markAllRead}>全部标为已读</Button>
        </>
      }
    >
      <div className="alert-archive">
        <div className="alert-archive-tools">
          <SearchInput value={query} onChange={setQuery} placeholder="搜索报错" aria-label="搜索告警" />
          <div className="chip-row">
            <Chip active={level === "all" && !unreadOnly} onClick={() => { setLevel("all"); setUnreadOnly(false); }}>全部</Chip>
            <Chip active={level === "error"} tone="danger" count={counts.errors} onClick={() => setLevel("error")}>错误</Chip>
            <Chip active={level === "warn"} tone="warning" count={counts.warnings} onClick={() => setLevel("warn")}>警告</Chip>
            <Chip active={unreadOnly} count={unread} onClick={() => setUnreadOnly((value) => !value)}>未读</Chip>
          </div>
          {counts.sources.length > 1 && (
            <div className="chip-row">
              <Chip active={!source} onClick={() => setSource("")}>all</Chip>
              {counts.sources.map(([name, count]) => (
                <Chip key={name} active={source === name} count={count} onClick={() => setSource(name)}>
                  <span className="mono">{name}</span>
                </Chip>
              ))}
            </div>
          )}
          {hiddenCount > 0 && (
            <p className="alert-archive-note">
              已忽略 {hiddenCount} 条
              <button type="button" className="link-btn" onClick={restoreHidden}>恢复已忽略</button>
            </p>
          )}
        </div>
        {filtered.length ? (
          <ul className="alert-archive-list">
            {filtered.map((alert) => {
              const unreadRow = isUnread(alert, seenAt);
              return (
                <li key={alertKey(alert)} className={unreadRow ? "alert-archive-row is-unread" : "alert-archive-row"}>
                  <button type="button" className="feed-item alert-archive-main" onClick={() => jump(alert)}>
                    <IconTile icon={alert.level === "error" ? "bug" : "warning"} tone={alert.level === "error" ? "danger" : "warning"} />
                    <span className="feed-text">
                      <span className="feed-title truncate" title={alert.text}>{alert.text.split("\n")[0]}</span>
                      <span className="feed-meta alert-archive-meta">
                        <span className="mono">{alert.source}</span>
                        <span>{alert.level === "error" ? "错误" : "警告"}</span>
                        <span title={`${fullTime(alert.lastTime)}`}>×{alert.count}</span>
                      </span>
                    </span>
                  </button>
                  <span className="alert-archive-actions">
                    <IconButton icon="terminal" label="在控制台查看" size="sm" onClick={() => jump(alert)} />
                    <IconButton icon="copy" label="复制" size="sm" onClick={() => copyOne(alert)} />
                    <IconButton icon="x" label="忽略" size="sm" onClick={() => hideAlert(alert)} />
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            compact
            icon="bell"
            title={scanning ? "正在读取报错" : alerts.length ? "没有符合筛选的告警" : "暂无告警"}
            description={scanning ? "正在从日志文件整理警告和错误。" : alerts.length ? "换一个筛选条件，或清除搜索。" : ""}
          />
        )}
      </div>
    </Sheet>
  );
}
