import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import {
  assertKindLabel,
  normalizeAssertKind,
  type AssertCountOp,
  type AssertKind,
  type AssertMatchMode,
} from "../graph/assert";
import { isCreateStimulusKind } from "../graph/materialize";
import { EventLogNode } from "./EventLogNode";
import { vscodeApi } from "./vscodeApi";

export type StimulusKind =
  | "player"
  | "entity"
  | "item"
  | "scoreboard"
  | "emit"
  | "call"
  | "tick"
  | "assert"
  | "branch"
  | "repeat"
  | "frame"
  | "viewer"
  | "eventlog"
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
  /**
   * Call：具名输出。运行后把返回值（snapshot）登记到执行上下文 `out[<outName>]`，可被后续
   * 节点以 `@out.<outName>[.prop]` 引用；若未填则默认 `out_<nodeId>`。
   */
  outName?: string;
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
  /** Branch：条件表达式（字面量或 $id.prop / @lastEmit / @lastCall / @out.<name>） */
  branchCond?: string;
  /** Repeat：循环次数（≥1） */
  repeatTimes?: number;
  runState?: "idle" | "running" | "done" | "failed";
  /** 上次运行钉在节点上的短摘要（完整日志仍在 Output） */
  runSummary?: string;
  /**
   * 断言失败详情（节点 ⓘ 提示用；evaluateAssert.result 全量）。
   * 老剧本若只存了字符串，新写入路径会升级为 { message, location? }，旧字段作废读取。
   */
  lastFailure?: { message: string; location?: { file: string; line: number; column?: number } };
  /** Repeat：当前轮次（1-based）；跑图过程态，节点 rAF 刷新 */
  repeatCurrent?: number;
  /** 节点边框与标题强调色；支持预设 token 或 CSS 颜色。 */
  color?: string;
  width?: number;
  height?: number;
  targetRef?: string;
  viewerProps?: Record<string, unknown>;
  /** EventLog 节点配置（事件时间线预览；不参与控制流） */
  eventlogFilterChannel?: "system" | "player" | "module" | string;
  eventlogFilterSource?: string;
  eventlogMinLevel?: "debug" | "info" | "warn" | "error";
  eventlogMaxEntries?: number;
  /**
   * EventLog 节点在跑图时拉取的当前快照；显示用，编辑器内不直接编辑。
   * 结构见 logBuffer.ts 的 StructuredLogEvent。
   */
  eventlogSnapshot?: Array<{
    t: number;
    level: "info" | "warn" | "error" | "debug" | "success";
    source: string;
    text: string;
    nodeId?: string;
    runId?: number;
  }>;
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
  branch: "Branch",
  repeat: "Repeat",
  frame: "Frame",
  viewer: "Viewer",
  eventlog: "事件日志",
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

export const NODE_COLOR_PRESETS = {
  blue: "#569cd6",
  green: "#4ec9b0",
  amber: "#d7ba7d",
  rose: "#e06c75",
  violet: "#c586c0",
} as const;

export type NodeColorToken = keyof typeof NODE_COLOR_PRESETS;

export function nodeColor(node: { data?: Partial<StimulusNodeData> }): string {
  const color = node.data?.color;
  if (color && color in NODE_COLOR_PRESETS) return NODE_COLOR_PRESETS[color as NodeColorToken];
  return color || "#808080";
}

export function StimulusNode({ data, selected }: NodeProps<StimulusFlowNode>) {
  const rs = data.runState ?? "idle";
  const pendingCreate = isCreateStimulusKind(data.kind) && !data.objectId;
  const isBranch = data.kind === "branch";
  const isRepeat = data.kind === "repeat";
  const showPause = rs === "running" && (isBranch || isRepeat);
  return (
    <div
      className={`s-node${selected ? " selected" : ""} ${rs !== "idle" ? rs : ""}${
        pendingCreate ? " pending-create" : ""
      }${showPause ? " paused" : ""}`}
      data-kind={data.kind}
      style={data.color ? ({ "--node-color": nodeColor({ data }) } as React.CSSProperties) : undefined}
    >
      <Handle type="target" position={Position.Left} />
      <div className="s-node-head">
        <span className="dot" />
        <span>{stimulusHeadLabel(data)}</span>
        {showPause ? <span className="pause-dot" title="暂停中（可继续）" /> : null}
      </div>
      <div className="s-node-body">
        {data.kind === "eventlog" ? (
          <EventLogNode data={data} scene={null} onSnapshot={() => undefined} />
        ) : (
          <>
            <div>{data.title}</div>
            <div className="mt-1 opacity-85">{data.detail}</div>
            {isCreateStimulusKind(data.kind) ? (
              <div className={`mt-1 instance-tag${pendingCreate ? " pending" : ""}`}>
                {data.objectId ? `已登记 ${data.objectId}` : "未实例化"}
              </div>
            ) : null}
            {data.kind === "call" && data.outName ? (
              <div className="mt-1 instance-tag">→ out: {data.outName}</div>
            ) : null}
            {isRepeat && data.repeatCurrent != null ? (
              <div className="mt-1 instance-tag">
                轮次 {data.repeatCurrent}/{data.repeatTimes ?? 1}
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
          </>
        )}
      </div>
      {rs === "failed" && data.lastFailure ? (
        <span
          className={`failure-tip${data.lastFailure.location ? " failure-tip-clickable" : ""}`}
          title={data.lastFailure.message}
          aria-label="失败详情"
          role={data.lastFailure.location ? "button" : undefined}
          tabIndex={data.lastFailure.location ? 0 : undefined}
          onClick={(ev) => {
            if (!data.lastFailure?.location) return;
            ev.stopPropagation();
            vscodeApi().postMessage({
              cmd: "revealInModule",
              file: data.lastFailure.location.file,
              line: data.lastFailure.location.line,
              column: data.lastFailure.location.column ?? 0,
            });
          }}
          onKeyDown={(ev) => {
            if (!data.lastFailure?.location) return;
            if (ev.key !== "Enter" && ev.key !== " ") return;
            ev.stopPropagation();
            vscodeApi().postMessage({
              cmd: "revealInModule",
              file: data.lastFailure.location.file,
              line: data.lastFailure.location.line,
              column: data.lastFailure.location.column ?? 0,
            });
          }}
        >
          ⓘ
        </span>
      ) : null}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
