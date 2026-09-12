/**
 * Inspector.tsx — 右栏：属性面板（切片 2 起可编辑）。
 *
 * 选中组件时按节点类型渲染字段表单：
 * - 标量字段（文本/数字/枚举）用专用控件；
 * - 复杂字段（表达式、options、params 等）用 JSON 文本域，失焦解析提交；
 * - trigger 提供结构化小编辑器（类型选择 + 条件字段）。
 * 选中页面时编辑页面级声明（title/presentation/params/state/load/derived/actions）。
 *
 * 所有编辑通过 onEdit 进入草稿与撤销栈；未知字段不展示但随文档保留。
 */

import { useEffect, useState } from "react";
import type {
  UiNode,
  UiScreenDocument,
} from "../../../src/contracts/ui-document.js";
import {
  FEATURE_FILE,
  fileByScreenId,
  mutateNodeAtPath,
  nodeAtPath,
  type ProjectView,
  type Selection,
} from "../model";

interface InspectorProps {
  view: ProjectView;
  selection: Selection | null;
  /** 应用一步编辑（进入撤销栈）；mutate 返回 false 表示未定位到目标。 */
  onEdit(file: string, mutate: (doc: never) => boolean | void): void;
  /** 整文件替换（其他文件的 JSON 编辑）。 */
  onReplaceFile(file: string, doc: unknown): void;
}

// ---------------------------------------------------------------------------
// 字段注册表
// ---------------------------------------------------------------------------

type FieldDef =
  | { kind: "text"; key: string; label: string; required?: boolean; placeholder?: string }
  | { kind: "number"; key: string; label: string }
  | { kind: "select"; key: string; label: string; options: Array<{ value: string; label: string }> }
  | { kind: "json"; key: string; label: string }
  | { kind: "trigger"; key: string; label: string };

const TONE_OPTIONS = [
  { value: "default", label: "default" },
  { value: "muted", label: "muted" },
  { value: "accent", label: "accent" },
  { value: "success", label: "success" },
  { value: "warning", label: "warning" },
  { value: "danger", label: "danger" },
  { value: "primary", label: "primary" },
];

const PRESENTATION_OPTIONS = [
  { value: "auto", label: "auto（自动推断）" },
  { value: "menu", label: "menu（菜单）" },
  { value: "form", label: "form（表单）" },
  { value: "reactive", label: "reactive（响应式）" },
];

const SIZE_OPTIONS = [
  { value: "small", label: "small" },
  { value: "medium", label: "medium" },
  { value: "large", label: "large" },
];

const text = (key: string, label: string, extra?: Partial<Extract<FieldDef, { kind: "text" }>>): FieldDef => ({
  kind: "text",
  key,
  label,
  ...extra,
});
const num = (key: string, label: string): FieldDef => ({ kind: "number", key, label });
const json = (key: string, label: string): FieldDef => ({ kind: "json", key, label });
const tone: FieldDef = { kind: "select", key: "tone", label: "色调 tone", options: TONE_OPTIONS };
const disabledWhen = json("disabledWhen", "禁用条件 disabledWhen");

/** 每种节点类型的可编辑字段（id 与 visibleWhen 对所有节点通用，单独渲染）。 */
const NODE_FIELDS: Record<string, FieldDef[]> = {
  header: [text("text", "文本 text", { required: true }), tone, text("tooltip", "悬停提示 tooltip")],
  text: [text("text", "文本 text", { required: true }), tone, text("tooltip", "悬停提示 tooltip")],
  info: [json("items", "行 items"), tone, text("tooltip", "悬停提示 tooltip")],
  image: [
    text("source", "图像路径 source", { required: true }),
    text("pack", "资源包 pack", { required: true }),
    text("alt", "替代文本 alt"),
    num("width", "宽度 width"),
    text("tooltip", "悬停提示 tooltip"),
    { kind: "trigger", key: "trigger", label: "触发 trigger" },
  ],
  divider: [],
  spacer: [{ kind: "select", key: "size", label: "尺寸 size", options: SIZE_OPTIONS }],
  button: [
    text("label", "文本 label", { required: true }),
    text("description", "描述 description"),
    text("tooltip", "悬停提示 tooltip"),
    text("icon", "图标路径 icon"),
    text("iconPack", "图标资源包 iconPack"),
    tone,
    disabledWhen,
    { kind: "trigger", key: "trigger", label: "触发 trigger" },
  ],
  textField: [
    text("label", "标签 label", { required: true }),
    text("bind", "绑定 bind", { required: true, placeholder: "state.xxx" }),
    text("placeholder", "占位 placeholder"),
    text("description", "描述 description"),
    text("tooltip", "悬停提示 tooltip"),
    disabledWhen,
  ],
  toggle: [
    text("label", "标签 label", { required: true }),
    text("bind", "绑定 bind", { required: true, placeholder: "state.xxx" }),
    text("description", "描述 description"),
    text("tooltip", "悬停提示 tooltip"),
    disabledWhen,
  ],
  dropdown: [
    text("label", "标签 label", { required: true }),
    text("bind", "绑定 bind", { required: true, placeholder: "state.xxx" }),
    json("options", "选项 options"),
    text("description", "描述 description"),
    text("tooltip", "悬停提示 tooltip"),
    disabledWhen,
  ],
  slider: [
    text("label", "标签 label", { required: true }),
    text("bind", "绑定 bind", { required: true, placeholder: "state.xxx" }),
    num("min", "最小值 min"),
    num("max", "最大值 max"),
    num("step", "步长 step"),
    num("fixedFormatDigits", "小数位 fixedFormatDigits"),
    text("description", "描述 description"),
    text("tooltip", "悬停提示 tooltip"),
    disabledWhen,
  ],
  when: [json("condition", "条件 condition")],
  each: [
    text("source", "数据源 source", { required: true, placeholder: "data.xxx" }),
    text("as", "条目名 as", { required: true }),
  ],
};

/** 页面级可编辑字段。 */
const SCREEN_FIELDS: FieldDef[] = [
  text("name", "名称 name"),
  text("title", "标题 title", { required: true }),
  { kind: "select", key: "presentation", label: "呈现 presentation", options: PRESENTATION_OPTIONS },
  text("notes", "备注 notes"),
  json("params", "参数 params"),
  json("state", "状态 state"),
  json("load", "数据源 load"),
  json("derived", "计算值 derived"),
  json("actions", "动作 actions"),
];

// ---------------------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------------------

export function Inspector({ view, selection, onEdit, onReplaceFile }: InspectorProps) {
  if (!selection) {
    return <div className="inspector-empty">在左侧选择页面、组件或文件</div>;
  }

  // feature.ui.json：模块级声明编辑。
  if (selection.kind === "feature") {
    const doc = view.files[FEATURE_FILE];
    if (typeof doc !== "object" || doc === null) {
      return <div className="inspector-empty">feature.ui.json 不可用</div>;
    }
    return (
      <div className="inspector" key="feature">
        <FeatureForm
          doc={doc as Record<string, unknown>}
          commit={(key, value) =>
            onEdit(FEATURE_FILE, (target) => {
              const record = target as Record<string, unknown>;
              if (value === undefined) delete record[key];
              else record[key] = value;
              return true;
            })
          }
        />
      </div>
    );
  }

  // 其他文件（如预览 fixture）：整文件 JSON 编辑。
  if (selection.kind === "file") {
    const doc = view.files[selection.file];
    if (doc === undefined) {
      return <div className="inspector-empty">文件不存在：{selection.file}</div>;
    }
    return (
      <div className="inspector" key={selection.file}>
        <div className="inspector-heading">
          文件 <code>{selection.file}</code>
        </div>
        <JsonField
          label="文件内容"
          value={doc}
          onCommit={(value) => {
            if (value !== undefined) onReplaceFile(selection.file, value);
          }}
        />
      </div>
    );
  }

  // 页面：节点表单或页面级表单。
  const screen = view.browse.screens[selection.screenId];
  if (!screen) {
    return <div className="inspector-empty">页面未通过校验，请先看诊断</div>;
  }
  const file = fileByScreenId(view, selection.screenId);
  const rawDoc = file ? view.files[file] : null;
  if (!file || !rawDoc) {
    return <div className="inspector-empty">页面文件不可用，无法编辑</div>;
  }

  // 编辑一律作用在原始文档上（保留未知字段）；
  // 结构上与 UiScreenDocument 一致，nodeAtPath 可直接复用。
  const node = nodeAtPath(rawDoc as UiScreenDocument, selection.nodePath);
  const formKey = `${file}#${selection.nodePath}`;

  return (
    <div className="inspector" key={formKey}>
      {node ? (
        <NodeForm
          node={node}
          commit={(key, value) =>
            onEdit(file, (doc) =>
              mutateNodeAtPath(doc, selection.nodePath, (target) => {
                if (value === undefined) delete target[key];
                else target[key] = value;
              }),
            )
          }
        />
      ) : (
        <ScreenForm
          doc={rawDoc as Record<string, unknown>}
          commit={(key, value) =>
            onEdit(file, (doc) => {
              const target = doc as Record<string, unknown>;
              if (value === undefined) delete target[key];
              else target[key] = value;
              return true;
            })
          }
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 节点 / 页面表单
// ---------------------------------------------------------------------------

type Commit = (key: string, value: unknown) => void;

function NodeForm({ node, commit }: { node: UiNode; commit: Commit }) {
  const record = node as unknown as Record<string, unknown>;
  const fields = NODE_FIELDS[node.type] ?? [];
  return (
    <>
      <div className="inspector-heading">
        组件 <code>{node.type}</code>
      </div>
      <TextField label="标识 id" value={record.id} required onCommit={(v) => commit("id", v)} />
      {fields.map((field) => (
        <FieldControl key={field.key} field={field} value={record[field.key]} commit={commit} />
      ))}
      <JsonField
        label="可见条件 visibleWhen"
        value={record.visibleWhen}
        onCommit={(v) => commit("visibleWhen", v)}
      />
    </>
  );
}

function ScreenForm({ doc, commit }: { doc: Record<string, unknown>; commit: Commit }) {
  return (
    <>
      <div className="inspector-heading">
        页面 <code>{String(doc.id ?? "")}</code>
      </div>
      {SCREEN_FIELDS.map((field) => (
        <FieldControl key={field.key} field={field} value={doc[field.key]} commit={commit} />
      ))}
    </>
  );
}

/** feature.ui.json 的字段。 */
const FEATURE_FIELDS: FieldDef[] = [
  text("moduleId", "模块 moduleId", { required: true }),
  text("name", "名称 name"),
  text("notes", "备注 notes"),
  json("entries", "入口 entries"),
];

function FeatureForm({ doc, commit }: { doc: Record<string, unknown>; commit: Commit }) {
  const screens = Array.isArray(doc.screens) ? doc.screens.length : 0;
  return (
    <>
      <div className="inspector-heading">Feature 声明</div>
      {FEATURE_FIELDS.map((field) => (
        <FieldControl key={field.key} field={field} value={doc[field.key]} commit={commit} />
      ))}
      <div className="insp-hint">
        页面清单（screens）由左侧「页面」分区的文件操作自动维护，当前 {screens} 个。
      </div>
    </>
  );
}

function FieldControl({ field, value, commit }: { field: FieldDef; value: unknown; commit: Commit }) {
  switch (field.kind) {
    case "text":
      return (
        <TextField
          label={field.label}
          value={value}
          required={field.required}
          placeholder={field.placeholder}
          onCommit={(v) => commit(field.key, v)}
        />
      );
    case "number":
      return <NumberField label={field.label} value={value} onCommit={(v) => commit(field.key, v)} />;
    case "select":
      return (
        <SelectField
          label={field.label}
          value={value}
          options={field.options}
          onCommit={(v) => commit(field.key, v)}
        />
      );
    case "json":
      return <JsonField label={field.label} value={value} onCommit={(v) => commit(field.key, v)} />;
    case "trigger":
      return <TriggerField label={field.label} value={value} onCommit={(v) => commit(field.key, v)} />;
  }
}

// ---------------------------------------------------------------------------
// 字段控件：失焦/回车提交；可选字段清空即删除该键
// ---------------------------------------------------------------------------

function TextField({
  label,
  value,
  required,
  placeholder,
  onCommit,
}: {
  label: string;
  value: unknown;
  required?: boolean;
  placeholder?: string;
  onCommit(value: unknown): void;
}) {
  const current = typeof value === "string" ? value : "";
  const [text, setText] = useState(current);
  // 外部值变化（撤销/重做/其他入口编辑）时同步本地文本。
  useEffect(() => setText(current), [current]);
  const commit = () => {
    if (text === current) return;
    if (text === "" && !required) onCommit(undefined);
    else onCommit(text);
  };
  return (
    <label className="insp-field">
      <span className="insp-label">{label}</span>
      <input
        className="insp-input"
        value={text}
        placeholder={placeholder}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") (event.target as HTMLInputElement).blur();
        }}
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: unknown;
  onCommit(value: unknown): void;
}) {
  const current = typeof value === "number" ? String(value) : "";
  const [text, setText] = useState(current);
  // 外部值变化（撤销/重做/其他入口编辑）时同步本地文本。
  useEffect(() => setText(current), [current]);
  const commit = () => {
    if (text === current) return;
    if (text.trim() === "") {
      onCommit(undefined);
      return;
    }
    const parsed = Number(text);
    if (Number.isFinite(parsed)) onCommit(parsed);
    else setText(current); // 非法输入回退
  };
  return (
    <label className="insp-field">
      <span className="insp-label">{label}</span>
      <input
        className="insp-input"
        inputMode="decimal"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") (event.target as HTMLInputElement).blur();
        }}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onCommit,
}: {
  label: string;
  value: unknown;
  options: Array<{ value: string; label: string }>;
  onCommit(value: unknown): void;
}) {
  const current = typeof value === "string" ? value : "";
  return (
    <label className="insp-field">
      <span className="insp-label">{label}</span>
      <select
        className="insp-input"
        value={current}
        onChange={(event) => onCommit(event.target.value === "" ? undefined : event.target.value)}
      >
        <option value="">（未设置）</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function JsonField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: unknown;
  onCommit(value: unknown): void;
}) {
  const serialized = value === undefined ? "" : JSON.stringify(value, null, 2);
  const [text, setText] = useState(serialized);
  const [invalid, setInvalid] = useState(false);
  // 外部值变化（撤销/重做）时同步本地文本。
  useEffect(() => {
    setText(serialized);
    setInvalid(false);
  }, [serialized]);
  const commit = () => {
    const trimmed = text.trim();
    if (trimmed === "") {
      setInvalid(false);
      if (value !== undefined) onCommit(undefined);
      return;
    }
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      setInvalid(false);
      if (JSON.stringify(parsed) !== JSON.stringify(value)) onCommit(parsed);
    } catch {
      setInvalid(true);
    }
  };
  return (
    <label className="insp-field insp-field-block">
      <span className="insp-label">
        {label}
        <span className="insp-tag">JSON</span>
      </span>
      <textarea
        className={`insp-input insp-textarea${invalid ? " invalid" : ""}`}
        value={text}
        spellCheck={false}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
      />
      {invalid ? <span className="insp-error">JSON 无法解析，未提交</span> : null}
    </label>
  );
}

// ---------------------------------------------------------------------------
// trigger 结构化编辑器
// ---------------------------------------------------------------------------

const TRIGGER_TYPES = ["action", "navigate", "replace", "back", "refresh", "close"] as const;

function TriggerField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: unknown;
  onCommit(value: unknown): void;
}) {
  const trigger =
    typeof value === "object" && value !== null
      ? (value as { type?: string; action?: unknown; to?: unknown; input?: unknown; params?: unknown })
      : undefined;
  const type = TRIGGER_TYPES.includes(trigger?.type as (typeof TRIGGER_TYPES)[number])
    ? (trigger!.type as (typeof TRIGGER_TYPES)[number])
    : "";

  const changeType = (nextType: string) => {
    if (nextType === "") {
      onCommit(undefined);
      return;
    }
    // 切换类型时保留可复用字段（action/input、to/params）。
    switch (nextType) {
      case "action":
        onCommit({
          type: "action",
          action: typeof trigger?.action === "string" ? trigger.action : "",
          ...(trigger?.input !== undefined ? { input: trigger.input } : {}),
        });
        return;
      case "navigate":
      case "replace":
        onCommit({
          type: nextType,
          to: typeof trigger?.to === "string" ? trigger.to : "",
          ...(trigger?.params !== undefined ? { params: trigger.params } : {}),
        });
        return;
      default:
        onCommit({ type: nextType });
    }
  };

  return (
    <div className="insp-field insp-field-block">
      <span className="insp-label">{label}</span>
      <select className="insp-input" value={type} onChange={(event) => changeType(event.target.value)}>
        <option value="">（未设置）</option>
        {TRIGGER_TYPES.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
      {type === "action" ? (
        <div className="insp-sub">
          <TextField
            label="动作 action"
            value={trigger?.action}
            required
            onCommit={(v) => onCommit({ ...trigger, type, action: v ?? "" })}
          />
          <JsonField
            label="输入 input"
            value={trigger?.input}
            onCommit={(v) => {
              const next = { ...trigger, type } as Record<string, unknown>;
              if (v === undefined) delete next.input;
              else next.input = v;
              onCommit(next);
            }}
          />
        </div>
      ) : null}
      {type === "navigate" || type === "replace" ? (
        <div className="insp-sub">
          <TextField
            label="目标页面 to"
            value={trigger?.to}
            required
            onCommit={(v) => onCommit({ ...trigger, type, to: v ?? "" })}
          />
          <JsonField
            label="参数 params"
            value={trigger?.params}
            onCommit={(v) => {
              const next = { ...trigger, type } as Record<string, unknown>;
              if (v === undefined) delete next.params;
              else next.params = v;
              onCommit(next);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
