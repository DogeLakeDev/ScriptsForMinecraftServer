/**
 * editors.tsx — 结构化属性编辑器（替代手打 JSON）。
 *
 * 覆盖：表达式（condition/visibleWhen/disabledWhen/derived）、
 * 模板 JSON（trigger input/params、effect setState）、效果列表（onSuccess/onError）、
 * service 调用（load/actions.call）、页面声明（params/state/actions）、
 * feature entries、dropdown options、info items，以及 trigger 结构化编辑器。
 *
 * 组合 fields.tsx 的失焦提交小控件；结构变化（增删/移动/类型切换）
 * 作为一步撤销提交整体字段值（undefined 表示删除该字段）。
 */

import { useEffect, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { BindField, BooleanField, CheckField, JsonField, NumberField, SelectField, TextField } from "./fields";
import type { BindGroup } from "../model";

// ---------------------------------------------------------------------------
// 通用：宽松解析 / 唯一键 / 提交约定
// ---------------------------------------------------------------------------

function asDict<T>(value: unknown): Record<string, T> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, T>)
    : {};
}

function asList<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function uniqueKey(dict: Record<string, unknown>, base: string): string {
  if (!(base in dict)) return base;
  for (let n = 2; ; n += 1) {
    if (!(`${base}-${n}` in dict)) return `${base}-${n}`;
  }
}

/** 从 SelectField 的 unknown 提交值安全取字符串（空串/非字符串回退为 fallback）。 */
function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value !== "" ? value : fallback;
}

/** 删除值为 undefined 的键（用于可选字段的整体提交）。 */
function compact<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

// ---------------------------------------------------------------------------
// 条目外壳：折叠/展开 + 摘要 + 改名（字典）/移动（列表）+ 删除
// ---------------------------------------------------------------------------

function EntryShell({
  title,
  summary,
  defaultOpen,
  onRename,
  onRemove,
  onMove,
  canMoveUp,
  canMoveDown,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  /** 缺省表示不可改名（列表条目）。 */
  onRename?(next: string): void;
  onRemove(): void;
  /** 缺省表示不可移动（字典条目）。 */
  onMove?(dir: -1 | 1): void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [name, setName] = useState(title);
  // 外部改名（撤销/重做）时同步本地键名。
  useEffect(() => setName(title), [title]);
  return (
    <div className="dict-entry">
      <div className="dict-entry-head">
        <button className="dict-toggle" onClick={() => setOpen(!open)} title={open ? "收起" : "展开"}>
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        {onRename ? (
          <input
            className="insp-input dict-key"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => {
              const trimmed = name.trim();
              if (trimmed && trimmed !== title) onRename(trimmed);
              else setName(title);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") (event.target as HTMLInputElement).blur();
            }}
          />
        ) : (
          <span className="dict-key-label" title={title}>{title}</span>
        )}
        {summary ? <span className="dict-summary" title={summary}>{summary}</span> : null}
        {onMove ? (
          <>
            <button
              className="tree-action"
              disabled={!canMoveUp}
              onClick={() => onMove(-1)}
              title="上移"
            >
              <ArrowUp size={12} />
            </button>
            <button
              className="tree-action"
              disabled={!canMoveDown}
              onClick={() => onMove(1)}
              title="下移"
            >
              <ArrowDown size={12} />
            </button>
          </>
        ) : null}
        <button className="tree-action tree-action-danger" onClick={onRemove} title="删除">
          <Trash2 size={12} />
        </button>
      </div>
      {open ? <div className="dict-entry-body">{children}</div> : null}
    </div>
  );
}

/** 字典编辑器：Record<string, T> 的增删改名 + 条目编辑。 */
export function DictEditor<T>({
  label,
  value,
  addLabel,
  newEntry,
  summarize,
  renderEntry,
  onCommit,
}: {
  label: string;
  value: unknown;
  addLabel: string;
  newEntry(): T;
  summarize(entry: T): string;
  renderEntry(entry: T, update: (next: T) => void): ReactNode;
  onCommit(value: unknown): void;
}) {
  const dict = asDict<T>(value);
  const keys = Object.keys(dict);
  const [addedKey, setAddedKey] = useState<string | null>(null);
  const commitDict = (next: Record<string, T>) =>
    onCommit(Object.keys(next).length > 0 ? next : undefined);
  return (
    <div className="insp-field insp-field-block">
      <span className="insp-label">
        {label}
        <span className="insp-tag">{keys.length} 项</span>
      </span>
      {keys.map((key) => (
        <EntryShell
          key={key}
          title={key}
          summary={summarize(dict[key]!)}
          defaultOpen={key === addedKey}
          onRename={(next) => {
            if (next in dict) {
              window.alert(`键名已存在：${next}`);
              return;
            }
            // 保持键顺序重建。
            const nextDict: Record<string, T> = {};
            for (const existing of keys) {
              nextDict[existing === key ? next : existing] = dict[existing]!;
            }
            commitDict(nextDict);
          }}
          onRemove={() => {
            const next = { ...dict };
            delete next[key];
            commitDict(next);
          }}
        >
          {renderEntry(dict[key]!, (next) => commitDict({ ...dict, [key]: next }))}
        </EntryShell>
      ))}
      <button
        className="btn dict-add"
        onClick={() => {
          const key = uniqueKey(dict, "item");
          commitDict({ ...dict, [key]: newEntry() });
          setAddedKey(key);
        }}
      >
        <Plus size={13} /> {addLabel}
      </button>
    </div>
  );
}

/** 列表编辑器：T[] 的增删 + 上下移动 + 条目编辑。 */
export function ListEditor<T>({
  label,
  value,
  addLabel,
  newEntry,
  summarize,
  renderEntry,
  onCommit,
}: {
  label: string;
  value: unknown;
  addLabel: string;
  newEntry(): T;
  summarize(entry: T, index: number): string;
  renderEntry(entry: T, update: (next: T) => void, index: number): ReactNode;
  onCommit(value: unknown): void;
}) {
  const list = asList<T>(value);
  const [addedIndex, setAddedIndex] = useState<number | null>(null);
  const commitList = (next: T[]) => onCommit(next.length > 0 ? next : undefined);
  return (
    <div className="insp-field insp-field-block">
      <span className="insp-label">
        {label}
        <span className="insp-tag">{list.length} 项</span>
      </span>
      {list.map((entry, index) => (
        <EntryShell
          key={index}
          title={`#${index + 1}`}
          summary={summarize(entry, index)}
          defaultOpen={index === addedIndex}
          onMove={(dir) => {
            const next = [...list];
            const [moved] = next.splice(index, 1);
            next.splice(index + dir, 0, moved!);
            commitList(next);
          }}
          canMoveUp={index > 0}
          canMoveDown={index < list.length - 1}
          onRemove={() => commitList(list.filter((_, i) => i !== index))}
        >
          {renderEntry(entry, (next) => commitList(list.map((item, i) => (i === index ? next : item))), index)}
        </EntryShell>
      ))}
      <button
        className="btn dict-add"
        onClick={() => {
          commitList([...list, newEntry()]);
          setAddedIndex(list.length);
        }}
      >
        <Plus size={13} /> {addLabel}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 表达式编辑器：{ value } | { ref } | { op, args }
// ---------------------------------------------------------------------------

type Expr = Record<string, unknown>;

const OP_OPTIONS = [
  { value: "equals", label: "equals 等于" },
  { value: "notEquals", label: "notEquals 不等" },
  { value: "greaterThan", label: "greaterThan 大于" },
  { value: "greaterThanOrEqual", label: "greaterThanOrEqual 大于等于" },
  { value: "lessThan", label: "lessThan 小于" },
  { value: "lessThanOrEqual", label: "lessThanOrEqual 小于等于" },
  { value: "and", label: "and 与" },
  { value: "or", label: "or 或" },
  { value: "not", label: "not 非" },
  { value: "add", label: "add 加" },
  { value: "subtract", label: "subtract 减" },
  { value: "multiply", label: "multiply 乘" },
  { value: "divide", label: "divide 除" },
  { value: "coalesce", label: "coalesce 空值合并" },
  { value: "contains", label: "contains 包含" },
];

/** 操作符参数个数；variadic 表示可变（至少 1 个）。 */
const OP_ARITY: Record<string, number | "variadic"> = {
  not: 1,
  equals: 2,
  notEquals: 2,
  greaterThan: 2,
  greaterThanOrEqual: 2,
  lessThan: 2,
  lessThanOrEqual: 2,
  subtract: 2,
  multiply: 2,
  divide: 2,
  contains: 2,
  add: "variadic",
  and: "variadic",
  or: "variadic",
  coalesce: "variadic",
};

function exprKind(expr: Expr | null): "none" | "value" | "ref" | "op" {
  if (!expr) return "none";
  if ("value" in expr) return "value";
  if (typeof expr.ref === "string") return "ref";
  if (typeof expr.op === "string") return "op";
  return "none";
}

/** 操作符切换时按目标 arity 调整 args（保留前缀，不足补常量 null）。 */
function adjustArgs(op: string, args: Expr[]): Expr[] {
  const arity = OP_ARITY[op] ?? 2;
  if (arity === "variadic") return args.length > 0 ? args : [{ value: null }];
  const next = args.slice(0, arity);
  while (next.length < arity) next.push({ value: null });
  return next;
}

export function ExpressionEditor({
  label,
  value,
  bindGroups,
  onCommit,
}: {
  /** 缺省为内联模式（嵌套在条目/参数里）。 */
  label?: string;
  value: unknown;
  bindGroups: BindGroup[];
  onCommit(value: unknown): void;
}) {
  const expr =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Expr)
      : null;
  const kind = exprKind(expr);

  const switchKind = (next: string) => {
    if (next === "") onCommit(undefined);
    else if (next === "value") onCommit({ value: "" });
    // ref 契约要求非空路径：默认给第一个可用候选，避免切换即失验。
    else if (next === "ref") onCommit({ ref: bindGroups[0]?.options[0]?.value ?? "state." });
    else if (next === "op") onCommit({ op: "equals", args: adjustArgs("equals", []) });
  };

  const body = (
    <>
      <SelectField
        label="形态"
        value={kind === "none" ? "" : kind}
        options={[
          { value: "value", label: "常量 value" },
          { value: "ref", label: "引用 ref" },
          { value: "op", label: "操作 op" },
        ]}
        onCommit={(v) => switchKind(typeof v === "string" ? v : "")}
      />
      {kind === "value" ? (
        <ConstValueEditor
          value={expr!.value}
          onCommit={(v) => onCommit({ value: v })}
        />
      ) : null}
      {kind === "ref" ? (
        <BindField
          label="引用路径 ref"
          value={expr!.ref}
          groups={bindGroups}
          onCommit={(v) => onCommit({ ref: typeof v === "string" ? v : "" })}
        />
      ) : null}
      {kind === "op" ? (
        <OpEditor expr={expr!} bindGroups={bindGroups} onCommit={onCommit} />
      ) : null}
    </>
  );

  if (!label) return <div className="expr-inline">{body}</div>;
  return (
    <div className="insp-field insp-field-block">
      <span className="insp-label">{label}</span>
      <div className="expr-box">{body}</div>
    </div>
  );
}

/** 常量值编辑器：文本/数字/布尔/null。 */
function ConstValueEditor({
  value,
  onCommit,
}: {
  value: unknown;
  onCommit(value: unknown): void;
}) {
  const kind =
    value === null ? "null" : typeof value === "number" ? "number" : typeof value === "boolean" ? "boolean" : "string";
  const switchKind = (next: string) => {
    if (next === "null") onCommit(null);
    else if (next === "number") onCommit(0);
    else if (next === "boolean") onCommit(false);
    else onCommit("");
  };
  return (
    <>
      <SelectField
        label="值类型"
        value={kind}
        options={[
          { value: "string", label: "文本" },
          { value: "number", label: "数字" },
          { value: "boolean", label: "布尔" },
          { value: "null", label: "null" },
        ]}
        onCommit={(v) => switchKind(asString(v, "string"))}
      />
      {kind === "string" ? (
        <TextField label="值" value={value} onCommit={(v) => onCommit(typeof v === "string" ? v : "")} />
      ) : null}
      {kind === "number" ? (
        <NumberField label="值" value={value} onCommit={(v) => onCommit(typeof v === "number" ? v : 0)} />
      ) : null}
      {kind === "boolean" ? (
        <BooleanField label="值" value={value} onCommit={(v) => onCommit(v === true)} />
      ) : null}
    </>
  );
}

function OpEditor({
  expr,
  bindGroups,
  onCommit,
}: {
  expr: Expr;
  bindGroups: BindGroup[];
  onCommit(value: unknown): void;
}) {
  const op = typeof expr.op === "string" ? expr.op : "equals";
  const args = asList<Expr>(expr.args);
  const arity = OP_ARITY[op] ?? 2;
  const commitArgs = (next: Expr[]) => onCommit({ op, args: next });
  return (
    <>
      <SelectField
        label="操作符 op"
        value={op}
        options={OP_OPTIONS}
        onCommit={(v) => {
          const op = asString(v, "equals");
          onCommit({ op, args: adjustArgs(op, args) });
        }}
      />
      <div className="expr-args">
        {args.map((arg, index) => (
          <div key={index} className="expr-arg">
            <div className="expr-arg-head">
              <span className="insp-label">参数 {index + 1}</span>
              {arity === "variadic" && args.length > 1 ? (
                <button
                  className="tree-action tree-action-danger"
                  onClick={() => commitArgs(args.filter((_, i) => i !== index))}
                  title="删除参数"
                >
                  <Trash2 size={12} />
                </button>
              ) : null}
            </div>
            <ExpressionEditor
              value={arg}
              bindGroups={bindGroups}
              onCommit={(next) =>
                commitArgs(args.map((item, i) => (i === index ? (next as Expr) : item)))
              }
            />
          </div>
        ))}
        {arity === "variadic" ? (
          <button className="btn dict-add" onClick={() => commitArgs([...args, { value: null }])}>
            <Plus size={13} /> 添加参数
          </button>
        ) : null}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// 模板 JSON 编辑器：Record<string, UiJsonValue>，字符串支持 {{path}} 绑定
// ---------------------------------------------------------------------------

type TemplateValueKind = "text" | "bind" | "number" | "boolean" | "json";

/** 从现有值推断编辑形态：纯 {{path}} 视为绑定，其余字符串为文本。 */
function inferTemplateKind(value: unknown): TemplateValueKind {
  if (typeof value === "string") {
    return /^\{\{\s*[a-z0-9_.[\]-]+\s*\}\}$/i.test(value) ? "bind" : "text";
  }
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "json";
}

function templateSummary(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > 24 ? `${text.slice(0, 24)}…` : text;
}

export function TemplateJsonEditor({
  label,
  value,
  bindGroups,
  onCommit,
}: {
  label: string;
  value: unknown;
  bindGroups: BindGroup[];
  onCommit(value: unknown): void;
}) {
  return (
    <DictEditor<unknown>
      label={label}
      value={value}
      addLabel="添加字段"
      newEntry={() => ""}
      summarize={(entry) => templateSummary(entry)}
      onCommit={onCommit}
      renderEntry={(entry, update) => {
        const kind = inferTemplateKind(entry);
        const switchKind = (next: string) => {
          if (next === "bind") update("{{state.}}");
          else if (next === "number") update(0);
          else if (next === "boolean") update(false);
          else if (next === "json") update({});
          else update("");
        };
        return (
          <>
            <SelectField
              label="值类型"
              value={kind}
              options={[
                { value: "text", label: "文本（可含 {{绑定}}）" },
                { value: "bind", label: "绑定路径" },
                { value: "number", label: "数字" },
                { value: "boolean", label: "布尔" },
                { value: "json", label: "JSON" },
              ]}
              onCommit={(v) => switchKind(asString(v, "text"))}
            />
            {kind === "text" ? (
              <TextField
                label="值"
                value={entry}
                placeholder="可写 {{player.name}} 绑定"
                onCommit={(v) => update(typeof v === "string" ? v : "")}
              />
            ) : null}
            {kind === "bind" ? (
              <BindField
                label="绑定路径"
                value={/^\{\{\s*(.+?)\s*\}\}$/.exec(String(entry))?.[1] ?? ""}
                groups={bindGroups}
                onCommit={(v) => update(`{{${typeof v === "string" ? v : ""}}}`)}
              />
            ) : null}
            {kind === "number" ? (
              <NumberField label="值" value={entry} onCommit={(v) => update(typeof v === "number" ? v : 0)} />
            ) : null}
            {kind === "boolean" ? (
              <BooleanField label="值" value={entry} onCommit={(v) => update(v === true)} />
            ) : null}
            {kind === "json" ? (
              <JsonField label="值" value={entry} onCommit={(v) => update(v ?? {})} />
            ) : null}
          </>
        );
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// 效果列表编辑器：UiEffect[]（onSuccess / onError）
// ---------------------------------------------------------------------------

const EFFECT_OPTIONS = [
  { value: "message", label: "message 提示" },
  { value: "navigate", label: "navigate 跳转" },
  { value: "replace", label: "replace 替换跳转" },
  { value: "back", label: "back 返回" },
  { value: "refresh", label: "refresh 刷新" },
  { value: "close", label: "close 关闭" },
  { value: "setState", label: "setState 置状态" },
];

const TONE_OPTIONS = [
  { value: "default", label: "default" },
  { value: "muted", label: "muted" },
  { value: "accent", label: "accent" },
  { value: "success", label: "success" },
  { value: "warning", label: "warning" },
  { value: "danger", label: "danger" },
  { value: "primary", label: "primary" },
];

function effectSummary(effect: Record<string, unknown>): string {
  const type = typeof effect.effect === "string" ? effect.effect : "?";
  if (type === "message") return `message · ${String(effect.text ?? "")}`;
  if (type === "navigate" || type === "replace") return `${type} · ${String(effect.to ?? "")}`;
  if (type === "setState") return `setState · ${Object.keys(asDict(effect.values)).length} 项`;
  return type;
}

export function EffectListEditor({
  label,
  value,
  bindGroups,
  screenIds,
  onCommit,
}: {
  label: string;
  value: unknown;
  bindGroups: BindGroup[];
  /** 页面 id 清单（navigate/replace 的 to 自动补全）。 */
  screenIds: string[];
  onCommit(value: unknown): void;
}) {
  return (
    <ListEditor<Record<string, unknown>>
      label={label}
      value={value}
      addLabel="添加效果"
      newEntry={() => ({ effect: "message", text: "提示" })}
      summarize={effectSummary}
      onCommit={onCommit}
      renderEntry={(effect, update) => {
        const type = typeof effect.effect === "string" ? effect.effect : "message";
        const switchType = (next: string) => {
          // navigate/replace 共享 to/params；其余按类型给最小骨架。
          if (next === "navigate" || next === "replace") {
            update(compact({ effect: next, to: effect.to, params: effect.params }));
          } else if (next === "message") {
            update(compact({ effect: next, text: effect.text ?? "", tone: effect.tone }));
          } else if (next === "setState") {
            update({ effect: next, values: asDict(effect.values) });
          } else {
            update({ effect: next });
          }
        };
        return (
          <>
            <SelectField
              label="效果 effect"
              value={type}
              options={EFFECT_OPTIONS}
              onCommit={(v) => switchType(asString(v, "message"))}
            />
            {type === "message" ? (
              <>
                <TextField label="文本 text" value={effect.text} onCommit={(v) => update({ ...effect, text: v })} />
                <SelectField label="色调 tone" value={effect.tone} options={TONE_OPTIONS} onCommit={(v) => update(compact({ ...effect, tone: v }))} />
              </>
            ) : null}
            {type === "navigate" || type === "replace" ? (
              <>
                <TextField label="目标页面 to" value={effect.to} datalist={screenIds} onCommit={(v) => update({ ...effect, to: v })} />
                <TemplateJsonEditor label="参数 params" value={effect.params} bindGroups={bindGroups} onCommit={(v) => update(compact({ ...effect, params: v }))} />
              </>
            ) : null}
            {type === "setState" ? (
              <TemplateJsonEditor label="状态值 values" value={effect.values} bindGroups={bindGroups} onCommit={(v) => update(compact({ ...effect, values: v }))} />
            ) : null}
          </>
        );
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// service 调用编辑器：{ service, input?, timeoutMs? }
// ---------------------------------------------------------------------------

export function ServiceCallFields({
  call,
  services,
  bindGroups,
  onCommit,
}: {
  call: unknown;
  services: string[];
  bindGroups: BindGroup[];
  onCommit(value: unknown): void;
}) {
  const record = asDict<Record<string, unknown>>(call);
  return (
    <>
      <TextField
        label="服务 service"
        value={record.service}
        required
        datalist={services}
        placeholder="module.service"
        onCommit={(v) => onCommit(compact({ ...record, service: v }))}
      />
      <NumberField
        label="超时 timeoutMs"
        value={record.timeoutMs}
        onCommit={(v) => onCommit(compact({ ...record, timeoutMs: v }))}
      />
      <TemplateJsonEditor
        label="输入 input"
        value={record.input}
        bindGroups={bindGroups}
        onCommit={(v) => onCommit(compact({ ...record, input: v }))}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// 页面级声明编辑器
// ---------------------------------------------------------------------------

const PARAM_TYPE_OPTIONS = [
  { value: "string", label: "string" },
  { value: "number", label: "number" },
  { value: "boolean", label: "boolean" },
];

/** 参数默认值输入：按声明类型选择控件。 */
function TypedDefault({
  type,
  value,
  onCommit,
}: {
  type: string;
  value: unknown;
  onCommit(value: unknown): void;
}) {
  if (type === "number") return <NumberField label="默认 default" value={value} onCommit={onCommit} />;
  if (type === "boolean") return <BooleanField label="默认 default" value={value} onCommit={onCommit} />;
  return <TextField label="默认 default" value={value} onCommit={onCommit} />;
}

export function ParamsEditor({
  value,
  onCommit,
}: {
  value: unknown;
  onCommit(value: unknown): void;
}) {
  return (
    <DictEditor<Record<string, unknown>>
      label="参数 params"
      value={value}
      addLabel="添加参数"
      newEntry={() => ({ type: "string" })}
      summarize={(entry) => `${String(entry.type ?? "string")}${entry.required ? " · 必填" : ""}`}
      onCommit={onCommit}
      renderEntry={(param, update) => {
        const type = typeof param.type === "string" ? param.type : "string";
        return (
          <>
            <SelectField
              label="类型 type"
              value={type}
              options={PARAM_TYPE_OPTIONS}
              onCommit={(v) => update(compact({ type: v ?? "string", required: param.required }))}
            />
            <CheckField label="必填 required" value={param.required} onCommit={(v) => update({ ...param, required: v })} />
            <TypedDefault type={type} value={param.default} onCommit={(v) => update(compact({ ...param, default: v }))} />
          </>
        );
      }}
    />
  );
}

export function StateEditor({
  value,
  onCommit,
}: {
  value: unknown;
  onCommit(value: unknown): void;
}) {
  return (
    <DictEditor<Record<string, unknown>>
      label="状态 state"
      value={value}
      addLabel="添加状态"
      newEntry={() => ({ type: "string" })}
      summarize={(entry) => String(entry.type ?? "string")}
      onCommit={onCommit}
      renderEntry={(state, update) => {
        const type = typeof state.type === "string" ? state.type : "string";
        return (
          <>
            <SelectField
              label="类型 type"
              value={type}
              options={PARAM_TYPE_OPTIONS}
              // 切换类型时丢弃不兼容的约束字段。
              onCommit={(v) => update({ type: v ?? "string" })}
            />
            <TypedDefault type={type} value={state.default} onCommit={(v) => update(compact({ ...state, default: v }))} />
            {type === "string" ? (
              <>
                <NumberField label="最小长度 minLength" value={state.minLength} onCommit={(v) => update(compact({ ...state, minLength: v }))} />
                <NumberField label="最大长度 maxLength" value={state.maxLength} onCommit={(v) => update(compact({ ...state, maxLength: v }))} />
              </>
            ) : null}
            {type === "number" ? (
              <>
                <NumberField label="最小值 min" value={state.min} onCommit={(v) => update(compact({ ...state, min: v }))} />
                <NumberField label="最大值 max" value={state.max} onCommit={(v) => update(compact({ ...state, max: v }))} />
                <NumberField label="步长 step" value={state.step} onCommit={(v) => update(compact({ ...state, step: v }))} />
              </>
            ) : null}
          </>
        );
      }}
    />
  );
}

export function LoadEditor({
  value,
  services,
  bindGroups,
  onCommit,
}: {
  value: unknown;
  services: string[];
  bindGroups: BindGroup[];
  onCommit(value: unknown): void;
}) {
  return (
    <DictEditor<Record<string, unknown>>
      label="数据源 load"
      value={value}
      addLabel="添加数据源"
      newEntry={() => ({ service: services[0] ?? "module.service" })}
      summarize={(entry) => String(entry.service ?? "")}
      onCommit={onCommit}
      renderEntry={(call, update) => (
        <ServiceCallFields call={call} services={services} bindGroups={bindGroups} onCommit={update} />
      )}
    />
  );
}

export function DerivedEditor({
  value,
  bindGroups,
  onCommit,
}: {
  value: unknown;
  bindGroups: BindGroup[];
  onCommit(value: unknown): void;
}) {
  return (
    <DictEditor<unknown>
      label="计算值 derived"
      value={value}
      addLabel="添加计算值"
      newEntry={() => ({ value: "" })}
      summarize={(entry) => {
        const kind = exprKind(asDict<Record<string, unknown>>(entry));
        return kind === "ref" ? String((entry as Expr).ref) : kind === "op" ? `op:${String((entry as Expr).op)}` : kind;
      }}
      onCommit={onCommit}
      renderEntry={(expr, update) => (
        <ExpressionEditor value={expr} bindGroups={bindGroups} onCommit={update} />
      )}
    />
  );
}

/** 动作确认步骤编辑器（可开关）。 */
function ConfirmEditor({
  value,
  onCommit,
}: {
  value: unknown;
  onCommit(value: unknown): void;
}) {
  const confirm = asDict<Record<string, unknown>>(value);
  const enabled = value !== undefined && value !== null;
  return (
    <div className="insp-field insp-field-block">
      <CheckField
        label="确认步骤 confirm"
        value={enabled}
        onCommit={(checked) => onCommit(checked ? { title: "", body: "" } : undefined)}
      />
      {enabled ? (
        <div className="insp-sub">
          <TextField label="标题 title" value={confirm.title} required onCommit={(v) => onCommit(compact({ ...confirm, title: v }))} />
          <TextField label="内容 body" value={confirm.body} required onCommit={(v) => onCommit(compact({ ...confirm, body: v }))} />
          <TextField label="确认按钮 confirmText" value={confirm.confirmText} onCommit={(v) => onCommit(compact({ ...confirm, confirmText: v }))} />
          <TextField label="取消按钮 cancelText" value={confirm.cancelText} onCommit={(v) => onCommit(compact({ ...confirm, cancelText: v }))} />
          <CheckField label="危险操作 danger" value={confirm.danger} onCommit={(v) => onCommit(compact({ ...confirm, danger: v }))} />
        </div>
      ) : null}
    </div>
  );
}

export function ActionsEditor({
  value,
  services,
  bindGroups,
  screenIds,
  onCommit,
}: {
  value: unknown;
  services: string[];
  bindGroups: BindGroup[];
  screenIds: string[];
  onCommit(value: unknown): void;
}) {
  return (
    <DictEditor<Record<string, unknown>>
      label="动作 actions"
      value={value}
      addLabel="添加动作"
      newEntry={() => ({ call: { service: services[0] ?? "module.service" } })}
      summarize={(entry) => String(asDict(entry.call as unknown).service ?? "")}
      onCommit={onCommit}
      renderEntry={(action, update) => (
        <>
          <ConfirmEditor value={action.confirm} onCommit={(v) => update(compact({ ...action, confirm: v }))} />
          <div className="insp-field insp-field-block">
            <span className="insp-label">调用 call</span>
            <div className="insp-sub">
              <ServiceCallFields
                call={action.call}
                services={services}
                bindGroups={bindGroups}
                onCommit={(v) => update({ ...action, call: v })}
              />
            </div>
          </div>
          <EffectListEditor
            label="成功效果 onSuccess"
            value={action.onSuccess}
            bindGroups={bindGroups}
            screenIds={screenIds}
            onCommit={(v) => update(compact({ ...action, onSuccess: v }))}
          />
          <EffectListEditor
            label="失败效果 onError"
            value={action.onError}
            bindGroups={bindGroups}
            screenIds={screenIds}
            onCommit={(v) => update(compact({ ...action, onError: v }))}
          />
        </>
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// feature entries / dropdown options / info items
// ---------------------------------------------------------------------------

export function EntriesEditor({
  value,
  screenIds,
  onCommit,
}: {
  value: unknown;
  screenIds: string[];
  onCommit(value: unknown): void;
}) {
  return (
    <ListEditor<Record<string, unknown>>
      label="入口 entries"
      value={value}
      addLabel="添加入口"
      newEntry={() => {
        // 基于现有入口 id 生成唯一标识。
        const used = Object.fromEntries(
          asList<Record<string, unknown>>(value).map((entry) => [String(entry.id ?? ""), true]),
        );
        return { id: uniqueKey(used, "entry"), surface: "player", group: "默认", title: "新入口", target: screenIds[0] ?? "" };
      }}
      summarize={(entry) => `${String(entry.title ?? entry.id ?? "")} → ${String(entry.target ?? "")}`}
      onCommit={onCommit}
      renderEntry={(entry, update) => (
        <>
          <TextField label="标识 id" value={entry.id} required onCommit={(v) => update(compact({ ...entry, id: v }))} />
          <TextField label="标题 title" value={entry.title} required onCommit={(v) => update(compact({ ...entry, title: v }))} />
          <SelectField
            label="界面 surface"
            value={entry.surface}
            options={[
              { value: "player", label: "player（玩家）" },
              { value: "admin", label: "admin（管理）" },
            ]}
            onCommit={(v) => update(compact({ ...entry, surface: v }))}
          />
          <TextField label="分组 group" value={entry.group} required onCommit={(v) => update(compact({ ...entry, group: v }))} />
          <TextField label="目标页面 target" value={entry.target} required datalist={screenIds} onCommit={(v) => update(compact({ ...entry, target: v }))} />
          <TextField label="描述 description" value={entry.description} onCommit={(v) => update(compact({ ...entry, description: v }))} />
          <TextField label="图标 icon" value={entry.icon} onCommit={(v) => update(compact({ ...entry, icon: v }))} />
          <NumberField label="排序 order" value={entry.order} onCommit={(v) => update(compact({ ...entry, order: v }))} />
          <TextField label="权限 permission" value={entry.permission} onCommit={(v) => update(compact({ ...entry, permission: v }))} />
        </>
      )}
    />
  );
}

export function OptionsEditor({
  value,
  onCommit,
}: {
  value: unknown;
  onCommit(value: unknown): void;
}) {
  return (
    <ListEditor<Record<string, unknown>>
      label="选项 options"
      value={value}
      addLabel="添加选项"
      newEntry={() => ({ label: "选项", value: "" })}
      summarize={(entry) => `${String(entry.label ?? "")} = ${String(entry.value ?? "")}`}
      onCommit={onCommit}
      renderEntry={(option, update) => (
        <>
          <TextField label="文本 label" value={option.label} required onCommit={(v) => update(compact({ ...option, label: v }))} />
          <TextField
            label="值 value（纯数字存为 number）"
            value={typeof option.value === "number" ? String(option.value) : option.value}
            required
            onCommit={(v) => {
              const text = typeof v === "string" ? v : "";
              const asNumber = Number(text);
              // 契约允许 string | number：纯数字输入存为 number。
              const stored = text.trim() !== "" && Number.isFinite(asNumber) ? asNumber : text;
              update({ ...option, value: stored });
            }}
          />
          <TextField label="描述 description" value={option.description} onCommit={(v) => update(compact({ ...option, description: v }))} />
        </>
      )}
    />
  );
}

export function ItemsEditor({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: unknown;
  onCommit(value: unknown): void;
}) {
  return (
    <ListEditor<string>
      label={label}
      value={value}
      addLabel="添加一行"
      // 契约要求非空字符串，默认值不能留空（否则插入即失验）。
      newEntry={() => "新行"}
      summarize={(entry) => (entry.length > 24 ? `${entry.slice(0, 24)}…` : entry)}
      onCommit={onCommit}
      renderEntry={(item, update) => (
        <TextField label="内容" value={item} placeholder="可写 {{player.name}} 绑定" onCommit={(v) => update(typeof v === "string" ? v : "")} />
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// trigger 结构化编辑器
// ---------------------------------------------------------------------------

const TRIGGER_TYPES = ["action", "navigate", "replace", "back", "refresh", "close"] as const;

export function TriggerField({
  label,
  value,
  bindGroups,
  screenIds,
  actionIds,
  onCommit,
}: {
  label: string;
  value: unknown;
  bindGroups: BindGroup[];
  /** 页面 id 清单（navigate/replace 的 to 自动补全）。 */
  screenIds: string[];
  /** 当前页面的动作 id 清单（action 触发器自动补全）。 */
  actionIds: string[];
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
            datalist={actionIds}
            onCommit={(v) => onCommit({ ...trigger, type, action: v ?? "" })}
          />
          <TemplateJsonEditor
            label="输入 input"
            value={trigger?.input}
            bindGroups={bindGroups}
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
            datalist={screenIds}
            onCommit={(v) => onCommit({ ...trigger, type, to: v ?? "" })}
          />
          <TemplateJsonEditor
            label="参数 params"
            value={trigger?.params}
            bindGroups={bindGroups}
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
