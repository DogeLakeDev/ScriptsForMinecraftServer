/**
 * OperationSteps.tsx — 后台任务的阶段时间线与状态图标
 *
 * 使用场景：任务记录页的展开详情、初始化向导的实时进度。阶段由守护进程按执行顺序追加，
 * 这里只负责展示（名称本地化、状态图标、耗时、阶段说明）。
 */
import type { OperationPhase, OperationRecord } from "@sfmc-bds/management";
import { duration, phaseLabel, TASK_STATUS } from "../lib/format.js";
import { Icon } from "./icons.js";

/** 任务状态图标：运行中为旋转加载，其余按状态取图标与语气 */
export function TaskStatusIcon({ status, size = 16 }: { status: OperationRecord["status"]; size?: number }) {
  const tone = TASK_STATUS[status].tone;
  if (status === "running") return <Icon name="loader" spin size={size} className={`tone-text-${tone}`} />;
  if (status === "queued") return <Icon name="clock" size={size} className="tone-text-neutral" />;
  if (status === "succeeded") return <Icon name="checkCircle" size={size} className={`tone-text-${tone}`} />;
  if (status === "interrupted") return <Icon name="warning" size={size} className={`tone-text-${tone}`} />;
  return <Icon name="xCircle" size={size} className={`tone-text-${tone}`} />;
}

/** 单个阶段的状态图标 */
function PhaseIcon({ phase }: { phase: OperationPhase }) {
  if (phase.status === "running") return <Icon name="loader" spin size={14} />;
  if (phase.status === "done") return <Icon name="check" size={13} weight="bold" />;
  if (phase.status === "failed") return <Icon name="x" size={13} weight="bold" />;
  return <Icon name="circle" size={10} />;
}

/** 阶段时间线 */
export function OperationSteps({ phases, pendingLabel = "等待维护锁并开始执行" }: { phases: OperationPhase[]; pendingLabel?: string }) {
  if (!phases.length) {
    return (
      <ol className="op-steps">
        <li className="op-step status-pending">
          <span className="op-step-marker"><Icon name="clock" size={13} /></span>
          <div className="op-step-body"><b>{pendingLabel}</b></div>
        </li>
      </ol>
    );
  }
  return (
    <ol className="op-steps">
      {phases.map((phase, index) => {
        const elapsed = phase.startedAt && phase.finishedAt ? Date.parse(phase.finishedAt) - Date.parse(phase.startedAt) : undefined;
        return (
          <li key={`${phase.name}-${index}`} className={`op-step status-${phase.status}`}>
            <span className="op-step-marker"><PhaseIcon phase={phase} /></span>
            <div className="op-step-body">
              <b>{phaseLabel(phase.name)}</b>
              {phase.message && <span className="op-step-msg">{phase.message}</span>}
            </div>
            {elapsed !== undefined && <span className="op-step-time">{duration(elapsed)}</span>}
          </li>
        );
      })}
    </ol>
  );
}
