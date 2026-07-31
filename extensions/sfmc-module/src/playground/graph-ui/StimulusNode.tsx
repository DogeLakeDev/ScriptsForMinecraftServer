import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import {
  assertKindLabel,
  normalizeAssertKind,
  type AssertCountOp,
  type AssertKind,
  type AssertMatchMode,
} from "../graph/assert";
import { isCreateStimulusKind } from "../graph/materialize";

export type StimulusKind =
  | "player"
  | "entity"
  | "item"
  | "scoreboard"
  | "emit"
  | "call"
  | "tick"
  | "assert"
  | "note";

export type StimulusNodeData = {
  kind: StimulusKind;
  title: string;
  detail: string;
  path?: string;
  props?: Record<string, unknown>;
  n?: number;
  /**
   * 新建 Player / Entity / ItemStack / Scoreboard：objects.create 成功后的 registry id。
   * 无此字段表示尚未实例化（图上有块 ≠ 场景已有对象）。
   */
  objectId?: string;
  /** Call：目标对象 id */
  targetId?: string;
  /** Call：方法名 */
  method?: string;
  /** Call：参数 JSON 数组字符串 */
  argsJson?: string;
  /** 断言类型；旧节点缺省时按 log 迁移 */
  assertKind?: AssertKind;
  pattern?: string;
  ignoreCase?: boolean;
  /** 日志断言：最近 N 条 */
  logRecentN?: number;
  /** 日志断言：级别下限 */
  logMinLevel?: "debug" | "info" | "warn" | "error" | "success";
  /** 日志断言：source 过滤 */
  logSource?: string;
  targetKind?: string;
  targetName?: string;
  propName?: string;
  expected?: string;
  matchMode?: AssertMatchMode;
  countOp?: AssertCountOp;
  countN?: number;
  runState?: "idle" | "running" | "done" | "failed";
  /** 上次运行钉在节点上的短摘要（完整日志仍在 Output） */
  runSummary?: string;
};

/** 图上摘要截断：空白折叠，超长加省略号 */
export function clipRunSummary(text: string, max = 48): string {
  const t = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return "";
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

export type StimulusFlowNode = Node<StimulusNodeData, "stimulus">;

const KIND_LABEL: Record<Exclude<StimulusKind, "assert">, string> = {
  player: "新建 Player",
  entity: "新建 Entity",
  item: "新建 ItemStack",
  scoreboard: "新建 Scoreboard",
  emit: "Emit",
  call: "Call",
  tick: "Tick",
  note: "注释",
};

export function stimulusHeadLabel(data: StimulusNodeData): string {
  if (data.kind === "assert") {
    return assertKindLabel(normalizeAssertKind(data.assertKind));
  }
  return KIND_LABEL[data.kind];
}

export function formatCallDetail(data: Pick<StimulusNodeData, "targetId" | "method" | "argsJson">): string {
  const id = data.targetId || "?";
  const m = data.method || "?";
  let argc = 0;
  try {
    const args = JSON.parse(data.argsJson || "[]");
    if (Array.isArray(args)) argc = args.length;
  } catch {
    argc = -1;
  }
  return argc < 0 ? `${id}.${m}(args?)` : `${id}.${m}(${argc})`;
}

export function StimulusNode({ data, selected }: NodeProps<StimulusFlowNode>) {
  const rs = data.runState ?? "idle";
  const pendingCreate = isCreateStimulusKind(data.kind) && !data.objectId;
  return (
    <div
      className={`s-node${selected ? " selected" : ""} ${rs !== "idle" ? rs : ""}${
        pendingCreate ? " pending-create" : ""
      }`}
      data-kind={data.kind}
    >
      <Handle type="target" position={Position.Left} />
      <div className="s-node-head">
        <span className="dot" />
        <span>{stimulusHeadLabel(data)}</span>
      </div>
      <div className="s-node-body">
        <div>{data.title}</div>
        <div className="mt-1 opacity-85">{data.detail}</div>
        {isCreateStimulusKind(data.kind) ? (
          <div className={`mt-1 instance-tag${pendingCreate ? " pending" : ""}`}>
            {data.objectId ? `已登记 ${data.objectId}` : "未实例化"}
          </div>
        ) : null}
        {data.runSummary ? (
          <div
            className={`mt-1 run-summary${rs === "failed" ? " fail" : rs === "done" ? " ok" : ""}`}
            title={data.runSummary}
          >
            {data.runSummary}
          </div>
        ) : null}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
