/**
 * Inspector.tsx — 右栏：属性面板（切片 2 起可编辑）。
 *
 * 选中组件时按节点类型渲染字段表单：
 * - 标量字段（文本/数字/枚举）用专用控件；
 * - 复杂字段（表达式、options、items、params/state/load/derived/actions、
 *   entries、trigger input 等）一律用 editors.tsx 的结构化编辑器，不再手打 JSON；
 * - trigger 提供结构化小编辑器（类型选择 + 条件字段）。
 * 选中页面时编辑页面级声明（title/presentation/params/state/load/derived/actions）。
 *
 * 所有编辑通过 onEdit 进入草稿与撤销栈；未知字段不展示但随文档保留。
 */

import type {
  UiNode,
  UiScreenDocument,
} from "../../../src/contracts/ui-document.js";
import {
  collectBindPaths,
  FEATURE_FILE,
  fileByScreenId,
  mutateNodeAtPath,
  nodeAtPath,
  type BindGroup,
  type PreviewFixture,
  type ProjectView,
  type Selection,
} from "../model";
// 基础字段控件与结构化编辑器分别收敛在 fields.tsx / editors.tsx。
import { BindField, JsonField, NumberField, SelectField, TextField } from "./fields";
import {
  ActionsEditor,
  DerivedEditor,
  EntriesEditor,
  ExpressionEditor,
  ItemsEditor,
  LoadEditor,
  OptionsEditor,
  ParamsEditor,
  StateEditor,
  TriggerField,
} from "./editors";

interface InspectorProps {
  view: ProjectView;
  selection: Selection | null;
  /** 预览 fixture（绑定选择器的 player.* 候选来源）。 */
  fixture: PreviewFixture;
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
  | { kind: "trigger"; key: string; label: string }
  | { kind: "bind"; key: string; label: string; required?: boolean; roots?: string[] }
  | { kind: "expression"; key: string; label: string }
  | { kind: "stringList"; key: string; label: string }
  | { kind: "options"; key: string; label: string };

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
/** 表达式字段（condition/visibleWhen/disabledWhen）：结构化编辑器。 */
const expr = (key: string, label: string): FieldDef => ({ kind: "expression", key, label });
/** 绑定路径选择器；roots 限定候选根（bind 契约要求 state.*）。 */
const bind = (key: string, label: string, roots?: string[]): FieldDef => ({
  kind: "bind",
  key,
  label,
  required: true,
  roots,
});
const tone: FieldDef = { kind: "select", key: "tone", label: "色调 tone", options: TONE_OPTIONS };
const disabledWhen = expr("disabledWhen", "禁用条件 disabledWhen");

/** 每种节点类型的可编辑字段（id 与 visibleWhen 对所有节点通用，单独渲染）。 */
const NODE_FIELDS: Record<string, FieldDef[]> = {
  header: [text("text", "文本 text", { required: true }), tone, text("tooltip", "悬停提示 tooltip")],
  text: [text("text", "文本 text", { required: true }), tone, text("tooltip", "悬停提示 tooltip")],
  info: [{ kind: "stringList", key: "items", label: "行 items" }, tone, text("tooltip", "悬停提示 tooltip")],
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
    bind("bind", "绑定 bind", ["state"]),
    text("placeholder", "占位 placeholder"),
    text("description", "描述 description"),
    text("tooltip", "悬停提示 tooltip"),
    disabledWhen,
  ],
  toggle: [
    text("label", "标签 label", { required: true }),
    bind("bind", "绑定 bind", ["state"]),
    text("description", "描述 description"),
    text("tooltip", "悬停提示 tooltip"),
    disabledWhen,
  ],
  dropdown: [
    text("label", "标签 label", { required: true }),
    bind("bind", "绑定 bind", ["state"]),
    { kind: "options", key: "options", label: "选项 options" },
    text("description", "描述 description"),
    text("tooltip", "悬停提示 tooltip"),
    disabledWhen,
  ],
  slider: [
    text("label", "标签 label", { required: true }),
    bind("bind", "绑定 bind", ["state"]),
    num("min", "最小值 min"),
    num("max", "最大值 max"),
    num("step", "步长 step"),
    num("fixedFormatDigits", "小数位 fixedFormatDigits"),
    text("description", "描述 description"),
    text("tooltip", "悬停提示 tooltip"),
    disabledWhen,
  ],
  when: [expr("condition", "条件 condition")],
  each: [
    bind("source", "数据源 source"),
    text("as", "条目名 as", { required: true }),
  ],
};

/** 页面级可编辑字段（params/state/load/derived/actions 为结构化编辑器，单独渲染）。 */
const SCREEN_FIELDS: FieldDef[] = [
  text("name", "名称 name"),
  text("title", "标题 title", { required: true }),
  { kind: "select", key: "presentation", label: "呈现 presentation", options: PRESENTATION_OPTIONS },
  text("notes", "备注 notes"),
];

// ---------------------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------------------

export function Inspector({ view, selection, fixture, onEdit, onReplaceFile }: InspectorProps) {
  // 页面 id 清单（navigate/replace 的 to、entries 的 target 自动补全来源）。
  const screenIds =
    view.browse.feature?.screens.map((screen) => screen.id) ?? Object.keys(view.browse.screens);

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
          screenIds={screenIds}
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
  const file = fileByScreenId(view, selection.screenId);
  const rawDoc = file ? view.files[file] : null;
  if (!file || rawDoc === undefined || rawDoc === null) {
    return <div className="inspector-empty">页面文件不可用，无法编辑</div>;
  }
  // 页面未通过校验时画布/表单不可用；退化为整文件 JSON 编辑以便修复。
  if (!screen) {
    return (
      <div className="inspector" key={file}>
        <div className="inspector-heading">
          页面 <code>{selection.screenId}</code> 未通过校验
        </div>
        <div className="insp-hint">请先修复 JSON（对照底部诊断），通过后恢复表单编辑。</div>
        <JsonField
          label="文件内容"
          value={rawDoc}
          onCommit={(value) => {
            if (value !== undefined) onReplaceFile(file, value);
          }}
        />
      </div>
    );
  }

  // 编辑一律作用在原始文档上（保留未知字段）；
  // 结构上与 UiScreenDocument 一致，nodeAtPath 可直接复用。
  const node = nodeAtPath(rawDoc as UiScreenDocument, selection.nodePath);
  const formKey = `${file}#${selection.nodePath}`;
  // 绑定选择器的候选路径（廉价计算，随渲染刷新即可）。
  const bindGroups = collectBindPaths(rawDoc, fixture);
  // 当前页面的动作 id 清单（action 触发器自动补全来源）。
  const actionIds = Object.keys((rawDoc as UiScreenDocument).actions ?? {});

  return (
    <div className="inspector" key={formKey}>
      {node ? (
        <NodeForm
          node={node}
          bindGroups={bindGroups}
          screenIds={screenIds}
          actionIds={actionIds}
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
          bindGroups={bindGroups}
          services={view.services}
          screenIds={screenIds}
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

function NodeForm({
  node,
  bindGroups,
  screenIds,
  actionIds,
  commit,
}: {
  node: UiNode;
  bindGroups: BindGroup[];
  /** 页面 id 清单（trigger 的 to 自动补全）。 */
  screenIds: string[];
  /** 当前页面动作 id 清单（trigger 的 action 自动补全）。 */
  actionIds: string[];
  commit: Commit;
}) {
  const record = node as unknown as Record<string, unknown>;
  const fields = NODE_FIELDS[node.type] ?? [];
  return (
    <>
      <div className="inspector-heading">
        组件 <code>{node.type}</code>
      </div>
      <TextField label="标识 id" value={record.id} required onCommit={(v) => commit("id", v)} />
      {fields.map((field) => (
        <FieldControl
          key={field.key}
          field={field}
          value={record[field.key]}
          bindGroups={bindGroups}
          screenIds={screenIds}
          actionIds={actionIds}
          commit={commit}
        />
      ))}
      <ExpressionEditor
        label="可见条件 visibleWhen"
        value={record.visibleWhen}
        bindGroups={bindGroups}
        onCommit={(v) => commit("visibleWhen", v)}
      />
    </>
  );
}

function ScreenForm({
  doc,
  bindGroups,
  services,
  screenIds,
  commit,
}: {
  doc: Record<string, unknown>;
  bindGroups: BindGroup[];
  /** 项目 service 清单（load/actions.call 自动补全）。 */
  services: string[];
  screenIds: string[];
  commit: Commit;
}) {
  return (
    <>
      <div className="inspector-heading">
        页面 <code>{String(doc.id ?? "")}</code>
      </div>
      {SCREEN_FIELDS.map((field) => (
        <FieldControl key={field.key} field={field} value={doc[field.key]} commit={commit} />
      ))}
      <ParamsEditor value={doc.params} onCommit={(v) => commit("params", v)} />
      <StateEditor value={doc.state} onCommit={(v) => commit("state", v)} />
      <LoadEditor
        value={doc.load}
        services={services}
        bindGroups={bindGroups}
        onCommit={(v) => commit("load", v)}
      />
      <DerivedEditor
        value={doc.derived}
        bindGroups={bindGroups}
        onCommit={(v) => commit("derived", v)}
      />
      <ActionsEditor
        value={doc.actions}
        services={services}
        bindGroups={bindGroups}
        screenIds={screenIds}
        onCommit={(v) => commit("actions", v)}
      />
    </>
  );
}

/** feature.ui.json 的字段（entries 为结构化编辑器，单独渲染）。 */
const FEATURE_FIELDS: FieldDef[] = [
  text("moduleId", "模块 moduleId", { required: true }),
  text("name", "名称 name"),
  text("notes", "备注 notes"),
];

function FeatureForm({
  doc,
  screenIds,
  commit,
}: {
  doc: Record<string, unknown>;
  screenIds: string[];
  commit: Commit;
}) {
  const screens = Array.isArray(doc.screens) ? doc.screens.length : 0;
  return (
    <>
      <div className="inspector-heading">Feature 声明</div>
      {FEATURE_FIELDS.map((field) => (
        <FieldControl key={field.key} field={field} value={doc[field.key]} commit={commit} />
      ))}
      <EntriesEditor value={doc.entries} screenIds={screenIds} onCommit={(v) => commit("entries", v)} />
      <div className="insp-hint">
        页面清单（screens）由左侧「页面」分区的文件操作自动维护，当前 {screens} 个。
      </div>
    </>
  );
}

function FieldControl({
  field,
  value,
  bindGroups,
  screenIds,
  actionIds,
  commit,
}: {
  field: FieldDef;
  value: unknown;
  bindGroups?: BindGroup[];
  /** trigger 分支需要（to/action 自动补全）；节点表单总是提供。 */
  screenIds?: string[];
  actionIds?: string[];
  commit: Commit;
}) {
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
    case "trigger":
      return (
        <TriggerField
          label={field.label}
          value={value}
          bindGroups={bindGroups ?? []}
          screenIds={screenIds ?? []}
          actionIds={actionIds ?? []}
          onCommit={(v) => commit(field.key, v)}
        />
      );
    case "bind":
      return (
        <BindField
          label={field.label}
          value={value}
          groups={bindGroups ?? []}
          roots={field.roots}
          onCommit={(v) => commit(field.key, v)}
        />
      );
    case "expression":
      return (
        <ExpressionEditor
          label={field.label}
          value={value}
          bindGroups={bindGroups ?? []}
          onCommit={(v) => commit(field.key, v)}
        />
      );
    case "stringList":
      return <ItemsEditor label={field.label} value={value} onCommit={(v) => commit(field.key, v)} />;
    case "options":
      return <OptionsEditor value={value} onCommit={(v) => commit(field.key, v)} />;
  }
}
