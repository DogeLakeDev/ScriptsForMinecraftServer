/**
 * TasksPage.tsx — 任务记录
 *
 * 使用场景：查看实例上所有后台维护任务（启停、安装、配置应用、更新、恢复等）。
 * 每行展示状态、当前阶段、耗时与更新时间；展开后显示阶段时间线、错误信封、结构化结果与任务编号，
 * 覆盖原实现 TaskPanel 的全部信息（阶段列表、错误、结果 JSON、可复制编号）。
 */
import type { OperationRecord } from "@sfmc-bds/management";
import { useEffect, useMemo, useState } from "react";
import { useDesktop } from "../app/desktop.js";
import { Button, Segmented } from "../components/controls.js";
import { Icon } from "../components/icons.js";
import { OperationSteps, TaskStatusIcon } from "../components/OperationSteps.js";
import { Badge, Callout, CopyText, EmptyState, PageHeader, Surface } from "../components/ui.js";
import { cx } from "../lib/cx.js";
import { duration, fullTime, isTaskDone, phaseLabel, relativeTime, taskElapsed, taskLabel, TASK_STATUS } from "../lib/format.js";

/** 列表筛选 */
type Filter = "all" | "active" | "failed";

/** 单个任务的展开详情 */
function TaskDetail({ task }: { task: OperationRecord }) {
  return (
    <div className="task-detail">
      <div className="task-detail-steps">
        <OperationSteps phases={task.phases} />
      </div>
      <div className="task-detail-side">
        {task.error && (
          <Callout tone="danger" title={`错误：${task.error.code}`}>
            {task.error.message}
          </Callout>
        )}
        <dl className="kv">
          <dt>任务编号</dt><dd><CopyText text={task.id} /></dd>
          <dt>任务种类</dt><dd className="mono">{task.kind}</dd>
          <dt>创建时间</dt><dd>{fullTime(task.createdAt)}</dd>
          <dt>更新时间</dt><dd>{fullTime(task.updatedAt)}</dd>
        </dl>
        {task.result !== undefined && (
          <div className="task-result">
            <div className="task-result-label">结果</div>
            <pre className="code-block">{JSON.stringify(task.result, null, 2)}</pre>
          </div>
        )}
        {task.error?.details !== undefined && (
          <div className="task-result">
            <div className="task-result-label">错误详情</div>
            <pre className="code-block">{JSON.stringify(task.error.details, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

export function TasksPage() {
  const { model, current, guarded, refresh } = useDesktop();
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(Date.now());
  const running = model.tasks.filter((task) => !isTaskDone(task.status));
  const failedCount = model.tasks.filter((task) => task.status === "failed" || task.status === "interrupted").length;
  // 进行中的任务需要每秒刷新耗时
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), running.length ? 1000 : 30_000);
    return () => clearInterval(timer);
  }, [running.length]);
  // 首次进入时自动展开最新的进行中任务，便于直接查看进度
  useEffect(() => {
    const first = running[0];
    if (first) setExpanded((previous) => (previous.size ? previous : new Set([first.id])));
  }, [running[0]?.id]);
  const rows = useMemo(
    () => model.tasks.filter((task) => filter === "all" || (filter === "active" ? !isTaskDone(task.status) : task.status === "failed" || task.status === "interrupted")),
    [model.tasks, filter]
  );
  const toggle = (id: string) =>
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <div className="page">
      <PageHeader
        title="任务记录"
        
        actions={<Button icon="refresh" onClick={() => void guarded(() => refresh(current))}>刷新</Button>}
      />
      <Surface flush>
        <div className="list-toolbar">
          <Segmented
            size="sm"
            label="任务筛选"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "全部", count: model.tasks.length },
              { value: "active", label: "进行中", count: running.length },
              { value: "failed", label: "失败或中断", count: failedCount, countTone: failedCount ? "danger" : undefined },
            ]}
          />
        </div>
        {rows.length ? (
          <ul className="task-list">
            {rows.map((task) => {
              const status = TASK_STATUS[task.status];
              const phase = task.phases.at(-1);
              const open = expanded.has(task.id);
              return (
                <li key={task.id} className={cx("task-item", open && "open")}>
                  <button type="button" className="task-row" aria-expanded={open} onClick={() => toggle(task.id)}>
                    <span className={cx("task-status-icon", `tile-${status.tone}`)}><TaskStatusIcon status={task.status} size={16} /></span>
                    <span className="task-main">
                      <b className="truncate">{taskLabel(task)}</b>
                      <span className="task-sub">
                        {task.status === "running" || task.status === "queued" ? (phase ? phaseLabel(phase.name) : "等待执行") : phase ? phaseLabel(phase.name) : "无阶段记录"}
                      </span>
                    </span>
                    <Badge tone={status.tone} dot={task.status === "running"}>{status.label}</Badge>
                    <span className="task-elapsed mono">{duration(taskElapsed(task, now))}</span>
                    <span className="task-time" title={fullTime(task.updatedAt)}>{relativeTime(task.updatedAt, now)}</span>
                    <Icon name="chevronDown" size={14} className="task-chevron" />
                  </button>
                  {open && <TaskDetail task={task} />}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon="history"
            title={model.tasks.length ? "没有符合筛选条件的任务" : "暂无任务"}
            action={model.tasks.length ? <Button size="sm" onClick={() => setFilter("all")}>查看全部任务</Button> : undefined}
          />
        )}
      </Surface>
    </div>
  );
}
