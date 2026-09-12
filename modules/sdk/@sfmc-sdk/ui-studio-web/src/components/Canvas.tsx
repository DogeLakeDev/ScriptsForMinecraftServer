/**
 * Canvas.tsx — 语义预览画布。
 *
 * 目标是验证信息结构、顺序、条件与数据绑定，不追求与 Minecraft 客户端像素一致。
 * 输入控件在画布内可直接交互（只改预览会话，不写盘），
 * 从而实时看到 visibleWhen / disabledWhen / derived 的联动。
 */

import { useMemo, useState, type MouseEvent } from "react";
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
import type { PreviewFixture } from "../model";
import { buildScope, type PreviewSession } from "../scope";
import type { ActionPreview } from "../App";

interface CanvasProps {
  screen: UiScreenDocument;
  fixture: PreviewFixture;
  session: PreviewSession;
  selection: { screenId: string; nodePath: string } | null;
  closed: boolean;
  onSelectNode(nodePath: string): void;
  onUpdateState(key: string, value: unknown): void;
  onNavigate(target: string, params: Record<string, unknown> | undefined, replace: boolean): void;
  onBack(): void;
  onClose(): void;
  onAction(preview: ActionPreview): void;
  onReopen(): void;
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

export function Canvas(props: CanvasProps) {
  const { screen, fixture, session, closed, onReopen } = props;
  // refresh 触发时通过 key 重挂载内容区，模拟运行时的重新求值。
  const [refreshTick, setRefreshTick] = useState(0);
  const scope = useMemo(
    () => buildScope(screen, fixture, session),
    [screen, fixture, session],
  );
  const presentation = resolvePresentation(screen);
  const nodeProps: CanvasProps = { ...props, onRefresh: () => setRefreshTick((tick) => tick + 1) };

  if (closed) {
    return (
      <div className="mc-frame">
        <div className="canvas-closed">
          <p>页面已关闭（close 触发）</p>
          <button className="btn" onClick={onReopen}>
            重新打开
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
      <div className="mc-content" key={refreshTick}>
        {screen.body.map((node, index) => (
          <PreviewNode
            key={node.id}
            node={node}
            path={`body/${index}`}
            scope={scope}
            props={nodeProps}
          />
        ))}
        {screen.body.length === 0 ? (
          <div className="canvas-empty">页面 body 为空</div>
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
}

function PreviewNode({ node, path, scope, props }: PreviewNodeProps) {
  const { selection, onSelectNode } = props;
  if (node.visibleWhen !== undefined && !evaluateCondition(node.visibleWhen, scope)) {
    return null;
  }
  const selected =
    selection?.nodePath === path && selection.screenId === props.screen.id;
  const className = `pv-node pv-${node.type}${selected ? " pv-selected" : ""}`;
  const select = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onSelectNode(path);
  };
  return (
    <div className={className} onClick={select} title={`#${node.id}`}>
      <NodeBody node={node} path={path} scope={scope} props={props} />
    </div>
  );
}

function NodeBody({ node, path, scope, props }: PreviewNodeProps) {
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
    case "when":
      return evaluateCondition(node.condition, scope) ? (
        <>
          {node.content.map((child, index) => (
            <PreviewNode
              key={child.id}
              node={child}
              path={`${path}/content/${index}`}
              scope={scope}
              props={props}
            />
          ))}
        </>
      ) : null;
    case "each":
      return <EachPreview node={node} path={path} scope={scope} props={props} />;
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
}: {
  node: Extract<UiNode, { type: "each" }>;
  path: string;
  scope: UiEvaluateScope;
  props: CanvasProps;
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
          />
        ))}
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
              />
            ))}
          </div>
        );
      })}
    </>
  );
}
