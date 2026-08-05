import type { Node, NodeProps } from "@xyflow/react";
import { nodeColor, type StimulusNodeData } from "./StimulusNode";

export type ViewerFlowNode = Node<StimulusNodeData, "viewer">;

function formatValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined) return "undefined";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function ViewerNode({ data, selected }: NodeProps<ViewerFlowNode>) {
  const rows = Object.entries(data.viewerProps ?? {});
  return (
    <div
      className={`s-node viewer-node${selected ? " selected" : ""}`}
      data-kind="viewer"
      style={{ "--node-color": nodeColor({ data }) } as React.CSSProperties}
    >
      <div className="s-node-head"><span className="dot" /><span>{data.title || "Viewer"}</span></div>
      <div className="viewer-target">{data.targetRef || data.targetKind || "自动选择"}</div>
      {rows.length ? (
        <div className="viewer-table">
          <div className="viewer-th">Key</div><div className="viewer-th">Value</div><div className="viewer-th">Type</div>
          {rows.slice(0, 12).flatMap(([key, value]) => [
            <div key={`${key}-k`}>{key}</div>,
            <div key={`${key}-v`} title={formatValue(value)}>{formatValue(value)}</div>,
            <div key={`${key}-t`}>{Array.isArray(value) ? "array" : value === null ? "null" : typeof value}</div>,
          ])}
        </div>
      ) : <div className="viewer-empty">运行后显示 inspect 属性</div>}
    </div>
  );
}
