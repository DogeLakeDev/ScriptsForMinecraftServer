import { useState } from "react";
import type { ReactNode } from "react";
import type { InterfaceProp } from "./interfaces.generated.ts";
import { jsonToText, safeParseObject } from "./jsonUtils.ts";

/**
 * 对象/接口类型字段的内联子表单。
 *
 * 优先按 INTERFACE_MEMBERS 提供字段表递归渲染（深度上限 NESTED_FORM_MAX_DEPTH，避免自引用接口死循环）；
 * 没有字段表时（或超过深度上限时）回退为可折叠 JSON 编辑器（与原 textarea 行为对齐，方便批量粘贴）。
 *
 * 渲染字段时通过 `renderField` 回调，把每个字段交给外层 PropFieldControl 决定控件类型
 * （enum / object / 基本类型）；这样子表单与顶层表单保持一致语义，复用单一控件路由。
 */
export type NestedFormProps = {
  typeName: string;
  /** 该类型已抽出的字段列表（来自 INTERFACE_MEMBERS），null = 回退 JSON。 */
  fields: InterfaceProp[] | null;
  /** 当前值（通常为 Record<string, unknown> | null）。 */
  value: unknown;
  onChange: (next: Record<string, unknown> | null) => void;
  /** 当前嵌套深度（0=顶层直接子字段；> NESTED_FORM_MAX_DEPTH 时回退 JSON）。 */
  depth: number;
  /** 锁定（true = 只读），与 metaForm 语义相同。 */
  locked?: boolean;
  /** 自定义渲染子字段的回调；缺省时无法渲染对象字段。 */
  renderField: (
    field: InterfaceProp,
    value: unknown,
    setField: (next: unknown) => void,
    locked: boolean,
    depth: number
  ) => ReactNode;
};

/** 嵌套子表单的最大深度（> 后回退 JSON 编辑）。 */
export const NESTED_FORM_MAX_DEPTH = 3;

export function NestedForm({
  typeName,
  fields,
  value,
  onChange,
  depth,
  locked,
  renderField,
}: NestedFormProps): ReactNode {
  const [open, setOpen] = useState(true);
  const [forceJson, setForceJson] = useState(false);
  const [text, setText] = useState(() => jsonToText(value));

  const useFieldsView = fields && fields.length > 0 && depth < NESTED_FORM_MAX_DEPTH && !forceJson;
  const useJsonView = !useFieldsView;

  const handleTextChange = (next: string) => {
    setText(next);
    const parsed = safeParseObject(next);
    onChange(parsed);
  };

  const chevron = open ? "▾" : "▸";
  return (
    <div className={`nested-form nested-form--depth-${depth}`}>
      <div className="nested-form-header">
        <button
          type="button"
          className="nested-form-toggle"
          onClick={() => setOpen((o) => !o)}
          disabled={locked}
        >
          <span className="nested-form-chevron">{chevron}</span>
          <span className="nested-form-type">{typeName}</span>
        </button>
        {!locked && useFieldsView && (
          <button
            type="button"
            className="nested-form-json-toggle"
            onClick={() => setForceJson(true)}
          >
            还原为 JSON
          </button>
        )}
        {!locked && forceJson && (
          <button
            type="button"
            className="nested-form-json-toggle"
            onClick={() => {
              setForceJson(false);
              setText(jsonToText(value));
            }}
          >
            返回字段
          </button>
        )}
      </div>
      {open && useFieldsView && (
        <div className="nested-form-body">
          {renderFields({
            fields: fields!,
            value: value && typeof value === "object" && !Array.isArray(value)
              ? (value as Record<string, unknown>)
              : {},
            depth,
            locked: Boolean(locked),
            renderField,
            onChange,
          })}
        </div>
      )}
      {open && useJsonView && (
        <textarea
          rows={4}
          disabled={locked}
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder={`{} // ${typeName}`}
        />
      )}
    </div>
  );
}

function renderFields({
  fields,
  value,
  depth,
  locked,
  renderField,
  onChange,
}: {
  fields: InterfaceProp[];
  value: Record<string, unknown>;
  depth: number;
  locked: boolean;
  renderField: NestedFormProps["renderField"];
  onChange: (next: Record<string, unknown> | null) => void;
}): ReactNode {
  const setField = (name: string, v: unknown) => {
    const next = { ...value, [name]: v };
    if (v === undefined) delete next[name];
    onChange(next);
  };

  return (
    <div className={`nested-form-fields nested-form-fields--depth-${depth}`}>
      {fields.map((f) => {
        const fLocked = locked || f.readonly;
        const raw = value[f.name];
        return (
          <div className="field" key={f.name}>
            <label>
              {f.name}
              <span className="field-type">{f.optional ? `${f.type}（可选）` : f.type}</span>
            </label>
            {renderField(f, raw, (v) => setField(f.name, v), fLocked, depth + 1)}
          </div>
        );
      })}
    </div>
  );
}
