/**
 * Canvas.tsx — 语义预览画布。
 *
 * 目标是验证信息结构、顺序、条件与数据绑定，不追求与 Minecraft 客户端像素一致。
 * 输入控件在画布内可直接交互（只改预览会话，不写盘），
 * 从而实时看到 visibleWhen / disabledWhen / derived 的联动。
 *
 * 画布同时是拖放目标：组件库条目（copy）与画布内节点（move）
 * 通过 HTML5 DnD 插入/重排，落点以插入线或槽位高亮表达。
 */

import { useEffect, useMemo, useState, type DragEvent, type MouseEvent } from "react";
import { RotateCcw } from "lucide-react";
import type {
  UiNode,
  UiScreenDocument,
  UiTrigger,
} from "../../../src/contracts/ui-document.js";
import {
  evaluateCondition,
  readPath,
  resolveTemplateJson,
  resolveTemplateText,
  toDisplayText,
  type UiEvaluateScope,
} from "../../../src/ui-studio/shared/evaluate.js";
import { parseNodeLocation, uniqueNodeId, type InsertAddress } from "../model";
import type { PreviewFixture, Selection } from "../model";
import { buildScope, type PreviewSession } from "../scope";
import { createPaletteNode, MOVE_MIME, PALETTE_MIME } from "./Palette";
import type { ActionPreview } from "../App";

/** 拖放落点：兄弟节点前/后、容器槽位末尾、或页面 body 末尾。 */
type DropHint =
  | { kind: "sibling"; path: string; pos: "before" | "after" }
  | { kind: "slot"; containerPath: string; slotKey: string; index: number }
  | { kind: "rootEnd" };

/** 画布内部拖放状态，沿 PreviewNode 递归透传。 */
interface DragState {
  dragging: boolean;
  hint: DropHint | null;
  overNode(event: DragEvent<HTMLElement>, path: string): void;
  overSlot(event: DragEvent<HTMLElement>, containerPath: string, slotKey: string, index: number): void;
  overRoot(event: DragEvent<HTMLElement>): void;
  /** 落点各自换算地址后调用；drop 不读 hint 状态（避免 dragover→drop 间未重渲染的时序问题）。 */
  dropOnNode(event: DragEvent<HTMLElement>, path: string): void;
  dropOnSlot(event: DragEvent<HTMLElement>, containerPath: string, slotKey: string, index: number): void;
  dropOnRoot(event: DragEvent<HTMLElement>): void;
  startMove(event: DragEvent<HTMLElement>, path: string): void;
}

interface CanvasProps {
  screen: UiScreenDocument;
  fixture: PreviewFixture;
  session: PreviewSession;
  selection: Selection | null;
  closed: boolean;
  onSelectNode(nodePath: string): void;
  onUpdateState(key: string, value: unknown): void;
  onNavigate(target: string, params: Record<string, unknown> | undefined, replace: boolean): void;
  onBack(): void;
  onClose(): void;
  onAction(preview: ActionPreview): void;
  onReopen(): void;
  /** 拖放插入新节点（addr 由画布按落点计算）。 */
  onInsertNode(addr: InsertAddress, node: Record<string, unknown>): void;
  /** 拖放移动已有节点。 */
  onMoveNode(fromPath: string, addr: InsertAddress): void;
  /** refresh 触发时请求画布重挂载（由 Canvas 内部注入，App 无需传入）。 */
  onRefresh?(): void;
}

/** 推断 presentation:auto 的实际呈现：含输入控件按 form，否则按 menu。 */
export function resolvePresentation(screen: UiScreenDocument): "menu" | "form" {
  if (screen.presentation === "menu") return "menu";
  if (screen.presentation === "auto") {
    return hasInputControl(screen.body) ? "form" : "menu";
  }
  // form / reactive 均按表单风格预览。
  return "form";
}

function hasInputControl(nodes: UiNode[]): boolean {
  return nodes.some((node) => {
    if (["textField", "toggle", "dropdown", "slider"].includes(node.type)) return true;
    if (node.type === "when") return hasInputControl(node.content);
    if (node.type === "each") return hasInputControl(node.template);
    return false;
  });
}

function hasDragMime(event: DragEvent<HTMLElement>): boolean {
  const types = event.dataTransfer.types;
  return types.includes(PALETTE_MIME) || types.includes(MOVE_MIME);
}

export function Canvas(props: CanvasProps) {
  const { screen, fixture, session, closed, onReopen } = props;
  // refresh 触发时通过 key 重挂载内容区，模拟运行时的重新求值。
  const [refreshTick, setRefreshTick] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [hint, setHint] = useState<DropHint | null>(null);
  const scope = useMemo(
    () => buildScope(screen, fixture, session),
    [screen, fixture, session],
  );

  // 组件库在画布之外，拖拽开始/结束通过 window 事件同步，用于显隐槽位落点。
  useEffect(() => {
    const start = (event: globalThis.DragEvent) => {
      const types = event.dataTransfer?.types;
      if (types && (types.includes(PALETTE_MIME) || types.includes(MOVE_MIME))) {
        setDragging(true);
      }
    };
    const end = () => {
      setDragging(false);
      setHint(null);
    };
    window.addEventListener("dragstart", start);
    window.addEventListener("dragend", end);
    window.addEventListener("drop", end);
    return () => {
      window.removeEventListener("dragstart", start);
      window.removeEventListener("dragend", end);
      window.removeEventListener("drop", end);
    };
  }, []);

  const presentation = resolvePresentation(screen);
  const nodeProps: CanvasProps = { ...props, onRefresh: () => setRefreshTick((tick) => tick + 1) };

  /** 兄弟落点地址：按指针纵坐标在中点上/下决定前插/后插。 */
  const siblingAddress = (event: DragEvent<HTMLElement>, path: string): InsertAddress | null => {
    const location = parseNodeLocation(path);
    if (!location) return null;
    const rect = event.currentTarget.getBoundingClientRect();
    const after = event.clientY >= rect.top + rect.height / 2;
    return { ...location, index: location.index + (after ? 1 : 0) };
  };

  /** 统一落点处理：读 dataTransfer 决定插入（copy）或移动（move）。 */
  const performDrop = (event: DragEvent<HTMLElement>, addr: InsertAddress | null) => {
    if (!hasDragMime(event)) return;
    event.preventDefault();
    event.stopPropagation();
    setHint(null);
    if (!addr) return;
    const paletteType = event.dataTransfer.getData(PALETTE_MIME);
    const movePath = event.dataTransfer.getData(MOVE_MIME);
    if (paletteType) {
      const node = createPaletteNode(paletteType, uniqueNodeId(screen, paletteType));
      if (node) props.onInsertNode(addr, node);
    } else if (movePath) {
      // 拖到自身原位置（前/后）属于无效操作，先挡掉（其余守卫在 moveNode）。
      const from = parseNodeLocation(movePath);
      if (
        from &&
        from.containerPath === addr.containerPath &&
        from.slotKey === addr.slotKey &&
        (addr.index === from.index || addr.index === from.index + 1)
      ) {
        return;
      }
      props.onMoveNode(movePath, addr);
    }
  };

  const drag: DragState = {
    dragging,
    hint,
    overNode(event, path) {
      if (!hasDragMime(event)) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = event.currentTarget.getBoundingClientRect();
      const pos = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
      setHint((prev) =>
        prev?.kind === "sibling" && prev.path === path && prev.pos === pos
          ? prev
          : { kind: "sibling", path, pos },
      );
      event.dataTransfer.dropEffect = event.dataTransfer.types.includes(MOVE_MIME) ? "move" : "copy";
    },
    overSlot(event, containerPath, slotKey, index) {
      if (!hasDragMime(event)) return;
      event.preventDefault();
      event.stopPropagation();
      setHint((prev) =>
        prev?.kind === "slot" &&
        prev.containerPath === containerPath &&
        prev.slotKey === slotKey &&
        prev.index === index
          ? prev
          : { kind: "slot", containerPath, slotKey, index },
      );
      event.dataTransfer.dropEffect = event.dataTransfer.types.includes(MOVE_MIME) ? "move" : "copy";
    },
    overRoot(event) {
      if (!hasDragMime(event)) return;
      event.preventDefault();
      setHint((prev) => (prev?.kind === "rootEnd" ? prev : { kind: "rootEnd" }));
      event.dataTransfer.dropEffect = event.dataTransfer.types.includes(MOVE_MIME) ? "move" : "copy";
    },
    dropOnNode(event, path) {
      performDrop(event, siblingAddress(event, path));
    },
    dropOnSlot(event, containerPath, slotKey, index) {
      performDrop(event, { containerPath, slotKey, index });
    },
    dropOnRoot(event) {
      performDrop(event, { containerPath: "", slotKey: "body", index: screen.body.length });
    },
    startMove(event, path) {
      event.stopPropagation();
      event.dataTransfer.setData(MOVE_MIME, path);
      event.dataTransfer.effectAllowed = "move";
      setDragging(true);
    },
  };

  if (closed) {
    return (
      <div className="mc-frame">
        <div className="canvas-closed">
          <p>页面已关闭（close 触发）</p>
          <button className="btn" onClick={onReopen}>
            <RotateCcw size={14} /> 重新打开
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`mc-frame mc-${presentation}`}>
      <div className="mc-titlebar">
        <span>{resolveTemplateText(screen.title, scope)}</span>
        <span className="mc-presentation">{presentation}</span>
      </div>
      <div
        className={`mc-content${hint?.kind === "rootEnd" ? " drop-append" : ""}`}
        key={refreshTick}
        onDragOver={drag.overRoot}
        onDrop={drag.dropOnRoot}
      >
        {screen.body.map((node, index) => (
          <PreviewNode
            key={node.id}
            node={node}
            path={`body/${index}`}
            scope={scope}
            props={nodeProps}
            drag={drag}
          />
        ))}
        {screen.body.length === 0 ? (
          <div className="canvas-empty">页面 body 为空{dragging ? "，释放以放入组件" : ""}</div>
        ) : null}
      </div>
    </div>
  );
}

interface PreviewNodeProps {
  node: UiNode;
  path: string;
  scope: UiEvaluateScope;
  props: CanvasProps;
  drag: DragState;
}

function PreviewNode({ node, path, scope, props, drag }: PreviewNodeProps) {
  const { selection, onSelectNode } = props;
  if (node.visibleWhen !== undefined && !evaluateCondition(node.visibleWhen, scope)) {
    return null;
  }
  const selected =
    selection?.kind === "screen" &&
    selection.nodePath === path &&
    selection.screenId === props.screen.id;
  const hintHere =
    drag.hint?.kind === "sibling" && drag.hint.path === path ? drag.hint.pos : null;
  const className =
    `pv-node pv-${node.type}${selected ? " pv-selected" : ""}` +
    (hintHere ? ` drop-${hintHere}` : "");
  const select = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onSelectNode(path);
  };
  return (
    <div
      className={className}
      onClick={select}
      title={`#${node.id}`}
      draggable
      onDragStart={(event) => drag.startMove(event, path)}
      onDragOver={(event) => drag.overNode(event, path)}
      onDrop={(event) => drag.dropOnNode(event, path)}
    >
      <NodeBody node={node} path={path} scope={scope} props={props} drag={drag} />
    </div>
  );
}

/** 容器槽位的拖放落点（仅拖拽中显示）。 */
function SlotDropZone({
  path,
  slotKey,
  index,
  label,
  drag,
}: {
  path: string;
  slotKey: string;
  index: number;
  label: string;
  drag: DragState;
}) {
  if (!drag.dragging) return null;
  const hover =
    drag.hint?.kind === "slot" &&
    drag.hint.containerPath === path &&
    drag.hint.slotKey === slotKey;
  return (
    <div
      className={`pv-slot-drop${hover ? " drop-hover" : ""}`}
      onDragOver={(event) => drag.overSlot(event, path, slotKey, index)}
      onDrop={(event) => drag.dropOnSlot(event, path, slotKey, index)}
    >
      {label}
    </div>
  );
}

function NodeBody({ node, path, scope, props, drag }: PreviewNodeProps) {
  switch (node.type) {
    case "header":
      return <div className={`mc-header tone-${node.tone ?? "default"}`}>{resolveTemplateText(node.text, scope)}</div>;
    case "text":
      return <div className={`mc-text tone-${node.tone ?? "default"}`}>{resolveTemplateText(node.text, scope)}</div>;
    case "info":
      return (
        <div className={`mc-info tone-${node.tone ?? "default"}`}>
          {node.items.map((item, index) => (
            <div key={index}>{resolveTemplateText(item, scope)}</div>
          ))}
        </div>
      );
    case "image":
      // 预览无法加载 MC 资源包贴图，用占位框表达尺寸与来源。
      return (
        <div className="mc-image" style={{ width: node.width ?? 64 }}>
          <span className="mc-image-icon">🖼</span>
          <span className="mc-image-alt">{node.alt ?? resolveTemplateText(node.source, scope)}</span>
        </div>
      );
    case "divider":
      return <hr className="mc-divider" />;
    case "spacer":
      return <div className={`mc-spacer mc-spacer-${node.size ?? "small"}`} />;
    case "button":
      return <ButtonPreview node={node} scope={scope} props={props} />;
    case "textField":
    case "toggle":
    case "dropdown":
    case "slider":
      return <InputPreview node={node} scope={scope} props={props} />;
    case "when": {
      const visible = evaluateCondition(node.condition, scope);
      return (
        <>
          {visible
            ? node.content.map((child, index) => (
                <PreviewNode
                  key={child.id}
                  node={child}
                  path={`${path}/content/${index}`}
                  scope={scope}
                  props={props}
                  drag={drag}
                />
              ))
            : null}
          <SlotDropZone
            path={path}
            slotKey="content"
            index={node.content.length}
            label="放入条件分支"
            drag={drag}
          />
        </>
      );
    }
    case "each":
      return <EachPreview node={node} path={path} scope={scope} props={props} drag={drag} />;
    default:
      return <div className="mc-text">未知组件 {(node as UiNode).type}</div>;
  }
}

function ButtonPreview({
  node,
  scope,
  props,
}: {
  node: Extract<UiNode, { type: "button" }>;
  scope: UiEvaluateScope;
  props: CanvasProps;
}) {
  const disabled =
    node.disabledWhen !== undefined && evaluateCondition(node.disabledWhen, scope);
  return (
    <button
      className={`mc-button tone-${node.tone ?? "default"}`}
      disabled={disabled}
      title={node.tooltip ? resolveTemplateText(node.tooltip, scope) : undefined}
      onClick={(event) => {
        event.stopPropagation();
        if (!disabled) fireTrigger(node.trigger, scope, props, node);
      }}
    >
      <span>{resolveTemplateText(node.label, scope)}</span>
      {node.description ? (
        <span className="mc-button-desc">{resolveTemplateText(node.description, scope)}</span>
      ) : null}
    </button>
  );
}

/** 执行触发器的预览语义：导航换页、action 仅展示、close 显示已关闭。 */
function fireTrigger(
  trigger: UiTrigger,
  scope: UiEvaluateScope,
  props: CanvasProps,
  node: Extract<UiNode, { type: "button" }>,
): void {
  switch (trigger.type) {
    case "navigate":
      props.onNavigate(trigger.to, resolveParams(trigger.params, scope), false);
      return;
    case "replace":
      props.onNavigate(trigger.to, resolveParams(trigger.params, scope), true);
      return;
    case "back":
      props.onBack();
      return;
    case "close":
      props.onClose();
      return;
    case "refresh":
      // 预览数据来自 fixture，刷新只需重挂载内容区（会话状态保留）。
      props.onRefresh?.();
      return;
    case "action": {
      const action = props.screen.actions?.[trigger.action];
      if (!action) return;
      props.onAction({
        screenId: props.screen.id,
        actionId: trigger.action,
        action,
        input: resolveTemplateJson(trigger.input ?? {}, scope),
      });
      return;
    }
  }
}

function resolveParams(
  params: Record<string, unknown> | undefined,
  scope: UiEvaluateScope,
): Record<string, unknown> | undefined {
  if (!params) return undefined;
  return resolveTemplateJson(params, scope) as Record<string, unknown>;
}

function InputPreview({
  node,
  scope,
  props,
}: {
  node: Extract<UiNode, { type: "textField" | "toggle" | "dropdown" | "slider" }>;
  scope: UiEvaluateScope;
  props: CanvasProps;
}) {
  const disabled =
    node.disabledWhen !== undefined && evaluateCondition(node.disabledWhen, scope);
  const bindKey = node.bind.replace(/^state\./, "");
  const value = readPath(scope, node.bind);
  const label = resolveTemplateText(node.label, scope);
  const description = node.description
    ? resolveTemplateText(node.description, scope)
    : null;

  return (
    <label className={`mc-field${disabled ? " mc-disabled" : ""}`}>
      <span className="mc-field-label">{label}</span>
      {node.type === "textField" ? (
        <input
          className="mc-input"
          type="text"
          value={toDisplayText(value)}
          placeholder={node.placeholder}
          disabled={disabled}
          onChange={(event) => props.onUpdateState(bindKey, event.target.value)}
          onClick={(event) => event.stopPropagation()}
        />
      ) : null}
      {node.type === "toggle" ? (
        <input
          type="checkbox"
          checked={Boolean(value)}
          disabled={disabled}
          onChange={(event) => props.onUpdateState(bindKey, event.target.checked)}
          onClick={(event) => event.stopPropagation()}
        />
      ) : null}
      {node.type === "dropdown" ? (
        <select
          className="mc-input"
          value={toDisplayText(value)}
          disabled={disabled}
          onChange={(event) => {
            const option = node.options[Number(event.target.selectedIndex)];
            props.onUpdateState(bindKey, option?.value ?? event.target.value);
          }}
          onClick={(event) => event.stopPropagation()}
        >
          {node.options.map((option) => (
            <option key={String(option.value)} value={String(option.value)}>
              {option.label}
            </option>
          ))}
        </select>
      ) : null}
      {node.type === "slider" ? (
        <span className="mc-slider">
          <input
            type="range"
            min={node.min}
            max={node.max}
            step={node.step ?? 1}
            value={Number(value) || node.min}
            disabled={disabled}
            onChange={(event) => props.onUpdateState(bindKey, Number(event.target.value))}
            onClick={(event) => event.stopPropagation()}
          />
          <span className="mc-slider-value">
            {Number(value).toFixed(node.fixedFormatDigits ?? 0)}
          </span>
        </span>
      ) : null}
      {description ? <span className="mc-field-desc">{description}</span> : null}
    </label>
  );
}

function EachPreview({
  node,
  path,
  scope,
  props,
  drag,
}: {
  node: Extract<UiNode, { type: "each" }>;
  path: string;
  scope: UiEvaluateScope;
  props: CanvasProps;
  drag: DragState;
}) {
  const source = readPath(scope, node.source);
  const items = Array.isArray(source) ? source : [];
  if (items.length === 0) {
    return (
      <>
        {(node.empty ?? []).map((child, index) => (
          <PreviewNode
            key={child.id}
            node={child}
            path={`${path}/empty/${index}`}
            scope={scope}
            props={props}
            drag={drag}
          />
        ))}
        <SlotDropZone
          path={path}
          slotKey="empty"
          index={(node.empty ?? []).length}
          label="放入空态分支"
          drag={drag}
        />
        <SlotDropZone
          path={path}
          slotKey="template"
          index={node.template.length}
          label="放入循环模板"
          drag={drag}
        />
      </>
    );
  }
  return (
    <>
      {items.map((item, index) => {
        // each.as 别名仅对模板内可见。
        const childScope = { ...scope, [node.as]: item };
        return (
          <div className="mc-each-item" key={index}>
            {node.template.map((child, childIndex) => (
              <PreviewNode
                key={child.id}
                node={child}
                path={`${path}/template/${childIndex}`}
                scope={childScope}
                props={props}
                drag={drag}
              />
            ))}
          </div>
        );
      })}
      <SlotDropZone
        path={path}
        slotKey="template"
        index={node.template.length}
        label="放入循环模板"
        drag={drag}
      />
    </>
  );
}
