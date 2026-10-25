/**
 * ActivityPage.tsx — 行为日志
 *
 * 使用场景：查看行为日志模块（sfmc-module-activity-log）记录的玩家行为：进出服、聊天、方块、实体、物品、容器、爆炸等。
 * 顶部为当前筛选范围内的统计（总数、活跃玩家、事件分布、活跃玩家排行，点击即可加入筛选）；
 * 下方为分页列表，展开一行可查看坐标、目标、附加数据。支持按当前筛选导出 CSV。
 * 「玩家与权限」页通过 openActivity 跳转时预设玩家筛选（activityFocus）。
 * 数据由 activity.query / activity.stats 只读获取，握手带 "activity" 能力时才显示本页。
 */
import type { ActivityFilterParams, ActivityLevel, ActivityQueryResult, ActivityRecord, ActivityStatsResult } from "@sfmc-bds/management";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDesktop, type ActivityFocus } from "../app/desktop.js";
import { Button, IconButton, SearchInput, Segmented, Select } from "../components/controls.js";
import { toast } from "../components/feedback.js";
import { Icon } from "../components/icons.js";
import { LogRangePicker } from "../components/LogRangePicker.js";
import { Avatar, Badge, CopyText, EmptyState, PageHeader, Surface } from "../components/ui.js";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_EVENT_TYPES,
  ACTIVITY_LEVELS,
  activityActor,
  activityCsv,
  activityDetail,
  activityIcon,
  activityLabel,
  activityPosition,
  activityTime,
  dimensionLabel,
} from "../lib/activity.js";
import { cx } from "../lib/cx.js";
import { errorText, hashHue, relativeTime } from "../lib/format.js";
import { rangeBounds, rangeLabel, todayRange, type LogRangeValue } from "../lib/log-range.js";

/** 列表每页条数 */
const PAGE_SIZE = 50;
/** 导出时每次请求的条数；服务端会按自身上限截断，实际步长以结果的 limit 为准 */
const EXPORT_PAGE_SIZE = 500;
/** 单次导出的条数上限，避免一次拉取过多记录占满内存 */
const EXPORT_MAX = 20_000;
/** 关键词输入停顿多久后再查询 */
const KEYWORD_DEBOUNCE_MS = 400;
/** 统计中事件分布最多显示的条数 */
const BREAKDOWN_ROWS = 8;
/** 下拉与分段控件中“全部”的取值 */
const ALL = "all";

/** 页面上的筛选状态（时间范围用日历的本地日期表示） */
interface Filters {
  category: string;
  eventType: string;
  level: typeof ALL | ActivityLevel;
  keyword: string;
  range: LogRangeValue | null;
  actor: ActivityFocus | null;
}

/** 页面筛选 → 协议筛选参数 */
function toParams(filters: Filters): ActivityFilterParams {
  const params: ActivityFilterParams = {};
  if (filters.eventType !== ALL) params.eventType = filters.eventType;
  else if (filters.category !== ALL) params.eventTypePrefix = filters.category;
  if (filters.level !== ALL) params.level = filters.level;
  if (filters.keyword) params.keyword = filters.keyword;
  if (filters.range) {
    const bounds = rangeBounds(filters.range);
    params.from = Date.parse(bounds.since);
    params.to = Date.parse(bounds.until);
  }
  if (filters.actor?.actorId) params.actorId = filters.actor.actorId;
  if (filters.actor?.actorName) params.actorName = filters.actor.actorName;
  return params;
}

/** 浏览器下载一段文本（Electron 会弹出保存对话框） */
function downloadText(filename: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 导出文件名：activity-YYYYMMDD-HHmmss.csv */
function exportFilename(now = new Date()): string {
  return `activity-${activityTime(now.getTime()).replace(/[-: ]/g, (char) => (char === " " ? "-" : ""))}.csv`;
}

/** 展开后的记录详情 */
function ActivityDetailPanel({ record, onActor }: { record: ActivityRecord; onActor: (focus: ActivityFocus) => void }) {
  const position = activityPosition(record);
  const payload = record.payload && Object.keys(record.payload).length ? record.payload : null;
  return (
    <div className="activity-detail">
      <dl className="kv">
        <dt>时间</dt><dd className="mono">{activityTime(record.timestamp)}</dd>
        <dt>事件</dt><dd>{activityLabel(record.eventType)} <span className="muted mono">{record.eventType}</span></dd>
        <dt>执行者</dt>
        <dd>
          {record.actorId ? (
            <button type="button" className="link-btn" onClick={() => onActor({ actorId: record.actorId, label: activityActor(record) })}>{activityActor(record)}</button>
          ) : activityActor(record)}
          {record.actorId && record.actorName && <span className="muted mono"> {record.actorId}</span>}
        </dd>
        {record.targetId && <><dt>目标</dt><dd className="mono">{record.targetId}</dd></>}
        {record.dimension && <><dt>维度</dt><dd>{dimensionLabel(record.dimension)}</dd></>}
        {position && record.x !== null && <><dt>坐标</dt><dd><CopyText text={`${record.x} ${record.y} ${record.z}`} /></dd></>}
        <dt>记录编号</dt><dd><CopyText text={record.id} /></dd>
      </dl>
      {payload && (
        <div className="activity-payload">
          <div className="task-result-label">附加数据</div>
          <pre className="code-block">{JSON.stringify(payload, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

/** 统计概览：总数、活跃玩家、警告/错误，以及事件分布与活跃玩家排行 */
function StatsPanel({ stats, rangeText, onEventType, onActor }: { stats: ActivityStatsResult | undefined; rangeText: string; onEventType: (eventType: string) => void; onActor: (focus: ActivityFocus) => void }) {
  const level = (key: ActivityLevel) => stats?.byLevel.find((row) => row.level === key)?.count ?? 0;
  const types = stats?.byType.slice(0, BREAKDOWN_ROWS) ?? [];
  const typeMax = Math.max(1, ...types.map((row) => row.count));
  const actorMax = Math.max(1, ...(stats?.topActors.map((row) => row.count) ?? []));
  return (
    <Surface title="概览" description={rangeText}>
      <div className="activity-stats">
        <div className="activity-stat"><span>记录</span><b className="mono">{stats ? stats.total.toLocaleString("zh-CN") : "—"}</b></div>
        <div className="activity-stat"><span>活跃玩家</span><b className="mono">{stats ? stats.actors : "—"}</b></div>
        <div className="activity-stat"><span>警告</span><b className={cx("mono", level("warn") > 0 && "tone-text-warning")}>{stats ? level("warn") : "—"}</b></div>
        <div className="activity-stat"><span>错误</span><b className={cx("mono", level("error") > 0 && "tone-text-danger")}>{stats ? level("error") : "—"}</b></div>
      </div>
      {stats && stats.total > 0 && (
        <div className="activity-breakdown">
          <div>
            <div className="task-result-label">事件分布</div>
            <ul className="activity-bars">
              {types.map((row) => (
                <li key={row.eventType}>
                  <button type="button" className="activity-bar" onClick={() => onEventType(row.eventType)} title={`只看「${activityLabel(row.eventType)}」`}>
                    <Icon name={activityIcon(row.eventType)} size={14} />
                    <span className="truncate">{activityLabel(row.eventType)}</span>
                    <span className="activity-bar-track"><span style={{ width: `${(row.count / typeMax) * 100}%` }} /></span>
                    <span className="mono">{row.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="task-result-label">活跃玩家</div>
            {stats.topActors.length ? (
              <ul className="activity-bars">
                {stats.topActors.map((row) => {
                  const name = row.actorName || row.actorId;
                  return (
                    <li key={row.actorId}>
                      <button type="button" className="activity-bar" onClick={() => onActor({ actorId: row.actorId, label: name })} title={`只看 ${name}`}>
                        <Avatar name={name} hue={hashHue(name)} size={18} />
                        <span className="truncate">{name}</span>
                        <span className="activity-bar-track"><span style={{ width: `${(row.count / actorMax) * 100}%` }} /></span>
                        <span className="mono">{row.count}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="muted inline-empty">范围内没有玩家记录</p>
            )}
          </div>
        </div>
      )}
    </Surface>
  );
}

export function ActivityPage() {
  const { request, setPage, activityFocus, clearActivityFocus } = useDesktop();
  // 从玩家页跳转时直接带上玩家筛选，并放宽到全部时间，避免首屏只看今天而误以为没有记录
  const [filters, setFilters] = useState<Filters>(() => ({
    category: ALL,
    eventType: ALL,
    level: ALL,
    keyword: "",
    range: activityFocus ? null : todayRange(),
    actor: activityFocus ? { ...(activityFocus.actorId ? { actorId: activityFocus.actorId } : {}), ...(activityFocus.actorName ? { actorName: activityFocus.actorName } : {}), label: activityFocus.label } : null,
  }));
  const [keywordInput, setKeywordInput] = useState("");
  const [result, setResult] = useState<ActivityQueryResult>();
  const [stats, setStats] = useState<ActivityStatsResult>();
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [now, setNow] = useState(Date.now());
  const params = useMemo(() => toParams(filters), [filters]);
  const filterKey = JSON.stringify(params);
  /** 页码随筛选条件一起记录：条件变化时自然回到第一页，不会先用旧页码多查一次 */
  const [paging, setPaging] = useState({ key: filterKey, index: 0 });
  const pageIndex = paging.key === filterKey ? paging.index : 0;
  const querySeq = useRef(0);
  const statsSeq = useRef(0);

  useEffect(() => {
    if (activityFocus) clearActivityFocus();
  }, [activityFocus, clearActivityFocus]);
  useEffect(() => {
    const timer = setTimeout(() => setFilters((previous) => (previous.keyword === keywordInput.trim() ? previous : { ...previous, keyword: keywordInput.trim() })), KEYWORD_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [keywordInput]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const seq = ++querySeq.current;
    setLoading(true);
    void request("activity.query", { ...params, limit: PAGE_SIZE, offset: pageIndex * PAGE_SIZE })
      .then((value) => { if (seq === querySeq.current) setResult(value); })
      .catch((error) => { if (seq === querySeq.current) toast.error("读取行为日志失败", errorText(error)); })
      .finally(() => { if (seq === querySeq.current) setLoading(false); });
  }, [request, filterKey, pageIndex, reload]);
  useEffect(() => {
    const seq = ++statsSeq.current;
    void request("activity.stats", params)
      .then((value) => { if (seq === statsSeq.current) setStats(value); })
      .catch(() => { if (seq === statsSeq.current) setStats(undefined); });
  }, [request, filterKey, reload]);

  const patch = (values: Partial<Filters>) => setFilters((previous) => ({ ...previous, ...values }));
  const focusActor = (actor: ActivityFocus) => patch({ actor });
  const focusEventType = (eventType: string) => {
    const category = ACTIVITY_CATEGORIES.find((row) => eventType.startsWith(row.prefix));
    patch({ eventType, category: category?.prefix ?? ALL });
  };
  const total = result?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeText = filters.range ? rangeLabel(filters.range) : "全部时间";
  /** 事件类型下拉：已知类型按分类过滤，再补上统计里出现的其它模块自定义类型 */
  const eventOptions = useMemo(() => {
    const known = ACTIVITY_EVENT_TYPES.filter((type) => filters.category === ALL || type.startsWith(filters.category));
    const extra = (stats?.byType ?? []).map((row) => row.eventType).filter((type) => !ACTIVITY_EVENT_TYPES.includes(type) && (filters.category === ALL || type.startsWith(filters.category)));
    return [{ value: ALL, label: "全部事件" }, ...[...known, ...extra].map((type) => ({ value: type, label: activityLabel(type) }))];
  }, [filters.category, stats]);
  const hasFilters = filters.category !== ALL || filters.eventType !== ALL || filters.level !== ALL || Boolean(filters.keyword) || Boolean(filters.actor);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows: ActivityRecord[] = [];
      let offset = 0;
      let available = 0;
      while (rows.length < EXPORT_MAX) {
        const page = await request("activity.query", { ...params, limit: EXPORT_PAGE_SIZE, offset });
        available = page.total;
        rows.push(...page.records);
        if (page.limit <= 0 || page.records.length < page.limit) break;
        offset += page.limit;
      }
      const data = rows.slice(0, EXPORT_MAX);
      if (!data.length) {
        toast.info("没有可导出的记录", "请调整筛选条件后再试");
        return;
      }
      downloadText(exportFilename(), `\uFEFF${activityCsv(data)}`, "text/csv;charset=utf-8");
      toast.success(`已导出 ${data.length} 条记录`, available > data.length ? `共 ${available} 条，单次最多导出最新的 ${EXPORT_MAX} 条，可缩小时间范围分批导出` : undefined);
    } catch (error) {
      toast.error("导出失败", errorText(error));
    } finally {
      setExporting(false);
    }
  };

  if (result && !result.installed) {
    return (
      <div className="page">
        <PageHeader title="行为日志" />
        <Surface>
          <EmptyState
            icon="activity"
            title="还没有行为记录"
            description="安装并启用「行为日志」模块（activity-log），重启 BDS 后即可在这里查看玩家行为"
            action={<Button size="sm" icon="modules" onClick={() => setPage("modules")}>前往模块</Button>}
          />
        </Surface>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="行为日志"
        actions={
          <>
            <Button icon="refresh" loading={loading} onClick={() => setReload((value) => value + 1)}>刷新</Button>
            <Button icon="download" loading={exporting} disabled={!total} onClick={() => void exportCsv()}>导出 CSV</Button>
          </>
        }
      />
      <StatsPanel stats={stats} rangeText={rangeText} onEventType={focusEventType} onActor={focusActor} />
      <Surface flush>
        <div className="list-toolbar">
          <Segmented
            size="sm"
            label="事件分类"
            value={filters.category}
            onChange={(category) => patch({ category, eventType: ALL })}
            options={[{ value: ALL, label: "全部" }, ...ACTIVITY_CATEGORIES.map((row) => ({ value: row.prefix, label: row.label }))]}
          />
          <Select size="sm" label="事件类型" width={140} value={filters.eventType} onChange={(eventType) => patch({ eventType })} options={eventOptions} />
          <Select
            size="sm"
            label="级别"
            width={100}
            value={filters.level}
            onChange={(level) => patch({ level })}
            options={[{ value: ALL, label: "全部级别" }, ...(Object.keys(ACTIVITY_LEVELS) as ActivityLevel[]).map((key) => ({ value: key, label: ACTIVITY_LEVELS[key].label }))]}
          />
          <span className="toolbar-spacer" />
          <SearchInput size="sm" className="toolbar-search" value={keywordInput} onChange={setKeywordInput} placeholder="玩家、目标或聊天内容" />
          <LogRangePicker value={filters.range} onChange={(range) => patch({ range })} />
        </div>
        {(filters.actor || hasFilters) && (
          <div className="activity-active-filters">
            {filters.actor && (
              <span className="activity-filter-chip">
                <Avatar name={filters.actor.label} hue={hashHue(filters.actor.label)} size={18} />
                <span>{filters.actor.label}</span>
                <button type="button" aria-label="清除玩家筛选" onClick={() => patch({ actor: null })}><Icon name="x" size={12} /></button>
              </span>
            )}
            {hasFilters && (
              <Button size="sm" variant="ghost" onClick={() => { setKeywordInput(""); patch({ category: ALL, eventType: ALL, level: ALL, keyword: "", actor: null }); }}>清除筛选</Button>
            )}
          </div>
        )}
        {result?.records.length ? (
          <ul className="activity-list">
            {result.records.map((record) => {
              const open = expanded === record.id;
              const level = ACTIVITY_LEVELS[record.level];
              const detail = activityDetail(record);
              return (
                <li key={record.id} className={cx("activity-item", open && "open")}>
                  <button type="button" className="activity-row" aria-expanded={open} onClick={() => setExpanded(open ? null : record.id)}>
                    <span className={cx("activity-icon", `tile-${record.level === "info" ? "neutral" : level.tone}`)}><Icon name={activityIcon(record.eventType)} size={16} /></span>
                    <span className="activity-main">
                      <span className="activity-title">
                        <b className="truncate">{activityActor(record)}</b>
                        <span>{activityLabel(record.eventType)}</span>
                        {record.level !== "info" && <Badge tone={level.tone}>{level.label}</Badge>}
                      </span>
                      {detail && <span className="activity-sub" title={detail}>{detail}</span>}
                    </span>
                    <span className="activity-pos mono">{activityPosition(record)}</span>
                    <span className="activity-time" title={activityTime(record.timestamp)}>{relativeTime(record.timestamp, now)}</span>
                    <Icon name="chevronDown" size={14} className="task-chevron" />
                  </button>
                  {open && <ActivityDetailPanel record={record} onActor={focusActor} />}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon="activity"
            title={result ? "没有符合条件的记录" : "正在读取…"}
            description={result && filters.range ? `当前时间范围：${rangeText}` : undefined}
            action={result && (hasFilters || filters.range) ? <Button size="sm" onClick={() => { setKeywordInput(""); patch({ category: ALL, eventType: ALL, level: ALL, keyword: "", actor: null, range: null }); }}>查看全部记录</Button> : undefined}
          />
        )}
        {total > PAGE_SIZE && (
          <div className="activity-pager">
            <span className="muted">共 {total.toLocaleString("zh-CN")} 条 · 第 {pageIndex + 1} / {pageCount} 页</span>
            <span className="toolbar-spacer" />
            <IconButton icon="arrowLeft" label="上一页" size="sm" disabled={pageIndex === 0 || loading} onClick={() => setPaging({ key: filterKey, index: pageIndex - 1 })} />
            <IconButton icon="arrowRight" label="下一页" size="sm" disabled={pageIndex + 1 >= pageCount || loading} onClick={() => setPaging({ key: filterKey, index: pageIndex + 1 })} />
          </div>
        )}
      </Surface>
    </div>
  );
}
