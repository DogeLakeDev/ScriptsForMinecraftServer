/**
 * LogRangePicker.tsx — 日志控制台的日期日历和时间范围
 *
 * 使用场景：在日志工具栏打开，选出本地日期区间和每天的起止钟点。
 * 确定后交给控制台去查询；清除则回到不限时间。
 */
import { useMemo, useState } from "react";
import { dayKey, type LogRangeValue, rangeLabel } from "../lib/log-range.js";
import { Button, IconButton } from "./controls.js";
import { Popover } from "./overlays.js";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

/** 从周一开始铺一个月，不足的格子用相邻月份补齐。 */
function monthCells(anchor: Date): string[] {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const cursor = new Date(year, month, 1 - offset);
  const count = Math.ceil((offset + new Date(year, month + 1, 0).getDate()) / 7) * 7;
  const cells: string[] = [];
  for (let index = 0; index < count; index++) {
    cells.push(dayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return cells;
}

function todayRange(): LogRangeValue {
  const today = dayKey(new Date());
  return { startDay: today, endDay: today, startTime: "00:00", endTime: "23:59" };
}

export function LogRangePicker({
  value,
  onChange,
}: {
  value: LogRangeValue | null;
  onChange: (value: LogRangeValue | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<LogRangeValue>(value ?? todayRange());
  const [awaitingEnd, setAwaitingEnd] = useState(false);
  const [error, setError] = useState("");
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const monthKey = `${visibleMonth.getFullYear()}-${visibleMonth.getMonth()}`;
  const cells = useMemo(() => monthCells(visibleMonth), [monthKey, visibleMonth]);
  const monthPrefix = `${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, "0")}`;
  const today = dayKey(new Date());

  const openPicker = (next: boolean) => {
    setOpen(next);
    if (!next) return;
    const initial = value ?? todayRange();
    setDraft(initial);
    setAwaitingEnd(false);
    setError("");
    const [year, month] = initial.endDay.split("-").map(Number);
    setVisibleMonth(new Date(year ?? 1970, (month ?? 1) - 1, 1));
  };

  const pickDay = (day: string) => {
    setError("");
    if (!awaitingEnd) {
      setDraft((current) => ({ ...current, startDay: day, endDay: day }));
      setAwaitingEnd(true);
      return;
    }
    const [startDay, endDay] = draft.startDay <= day ? [draft.startDay, day] : [day, draft.startDay];
    setDraft((current) => ({ ...current, startDay, endDay }));
    setAwaitingEnd(false);
  };

  const apply = () => {
    if (draft.startDay === draft.endDay && draft.startTime > draft.endTime) {
      setError("结束时间不能早于开始时间");
      return;
    }
    onChange(draft);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={openPicker}
      width={312}
      align="end"
      className="log-range-pop"
      trigger={<Button size="sm" icon="calendar" className={`log-range-trigger${value ? " is-active" : ""}`}>{rangeLabel(value)}</Button>}
    >
      <div className="log-cal-head">
        <IconButton icon="arrowLeft" label="上个月" size="sm" tooltip={false} onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} />
        <b>{visibleMonth.getFullYear()}年{visibleMonth.getMonth() + 1}月</b>
        <IconButton icon="arrowRight" label="下个月" size="sm" tooltip={false} onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} />
      </div>
      <div className="log-cal" role="grid" aria-label="选择日期">
        {WEEKDAYS.map((label) => <span key={label} className="log-cal-week">{label}</span>)}
        {cells.map((day) => {
          const inRange = day >= draft.startDay && day <= draft.endDay;
          const edge = day === draft.startDay || day === draft.endDay;
          return (
            <button
              key={day}
              type="button"
              className={`log-cal-day${day.startsWith(monthPrefix) ? "" : " is-out"}${day === today ? " is-today" : ""}${inRange ? " is-in-range" : ""}${edge ? " is-edge" : ""}`}
              onClick={() => pickDay(day)}
            >
              {Number(day.slice(8))}
            </button>
          );
        })}
      </div>
      <div className="log-range-times">
        <label>
          <span>开始</span>
          <input type="time" value={draft.startTime} onChange={(event) => { setError(""); setDraft((current) => ({ ...current, startTime: event.target.value || "00:00" })); }} />
        </label>
        <label>
          <span>结束</span>
          <input type="time" value={draft.endTime} onChange={(event) => { setError(""); setDraft((current) => ({ ...current, endTime: event.target.value || "23:59" })); }} />
        </label>
      </div>
      <p className="log-range-hint">{awaitingEnd ? "再点一天，选定结束日期" : "先点开始日期，再点结束日期"}</p>
      {error && <p className="log-range-error" role="alert">{error}</p>}
      <div className="log-range-actions">
        <Button size="sm" variant="ghost" onClick={() => { onChange(null); setOpen(false); }}>清除</Button>
        <Button size="sm" variant="primary" onClick={apply}>确定</Button>
      </div>
    </Popover>
  );
}
