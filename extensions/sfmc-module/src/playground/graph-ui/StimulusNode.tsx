import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import {
  assertKindLabel,
  normalizeAssertKind,
  type AssertCountOp,
  type AssertKind,
  type AssertMatchMode,
} from "../graph/assert";

export type StimulusKind = "player" | "emit" | "call" | "tick" | "assert" | "note";

export type StimulusNodeData = {
  kind: StimulusKind;
  title: string;
  detail: string;
  path?: string;
  props?: Record<string, unknown>;
  n?: number;
  /**
   * 新建 Player 等 create 节点：objects.create 成功后的 registry id。
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
  targetKind?: string;
  targetName?: string;
  propName?: string;
  expected?: string;
  matchMode?: AssertMatchMode;
  countOp?: AssertCountOp;
  countN?: number;
  runState?: "idle" | "running" | "done" | "failed";
};

export type StimulusFlowNode = Node<StimulusNodeData, "stimulus">;

const KIND_LABEL: Record<Exclude<StimulusKind, "assert">, string> = {
  player: "新建 Player",
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
  const pendingCreate = data.kind === "player" && !data.objectId;
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
        {data.kind === "player" ? (
          <div className={`mt-1 instance-tag${pendingCreate ? " pending" : ""}`}>
            {data.objectId ? `已登记 ${data.objectId}` : "未实例化"}
          </div>
        ) : null}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
