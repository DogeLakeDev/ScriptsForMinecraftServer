import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { nodeColor, type StimulusNodeData } from "./StimulusNode";

export type FrameFlowNode = Node<StimulusNodeData, "frame">;

export function FrameNode({ data, selected }: NodeProps<FrameFlowNode>) {
  const color = nodeColor({ data });
  return (
    <div className={`frame-node${selected ? " selected" : ""}`} style={{ "--node-color": color } as React.CSSProperties}>
      <NodeResizer minWidth={220} minHeight={140} isVisible={selected} />
      <div className="frame-node-title">{data.title || "Frame"}</div>
    </div>
  );
}
