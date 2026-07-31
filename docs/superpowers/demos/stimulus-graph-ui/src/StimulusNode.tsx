import { Handle, Position, type NodeProps } from "@xyflow/react";

export type StimulusKind = "player" | "emit" | "tick" | "assert" | "note";

export type StimulusNodeData = {
  kind: StimulusKind;
  title: string;
  detail: string;
  runState?: "idle" | "running" | "done" | "failed";
};

const KIND_LABEL: Record<StimulusKind, string> = {
  player: "新建 Player",
  emit: "Emit",
  tick: "Tick",
  assert: "断言·日志",
  note: "注释",
};

export function StimulusNode({ data, selected }: NodeProps & { data: StimulusNodeData }) {
  const rs = data.runState ?? "idle";
  return (
    <div
      className={`s-node${selected ? " selected" : ""} ${rs !== "idle" ? rs : ""}`}
      data-kind={data.kind}
    >
      <Handle type="target" position={Position.Left} />
      <div className="s-node-head">
        <span className="dot" />
        <span>{KIND_LABEL[data.kind]}</span>
      </div>
      <div className="s-node-body">
        <div>{data.title}</div>
        <div style={{ marginTop: 4, opacity: 0.85 }}>{data.detail}</div>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
