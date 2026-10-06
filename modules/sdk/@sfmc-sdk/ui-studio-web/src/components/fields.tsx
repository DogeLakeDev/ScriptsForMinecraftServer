/**
 * fields.tsx — 属性面板的基础字段控件。
 *
 * 文本/数字失焦或回车提交（可选字段清空即删除该键）；
 * 下拉/复选立即提交；JSON 失焦解析提交（非法输入不提交并标红）。
 * 所有控件在外部值变化（撤销/重做/其他入口编辑）时同步本地状态。
 * 供 Inspector 与结构化编辑器（editors.tsx）共用。
 */

import { Checkbox, Select, TextInput, type SelectOption } from "@sfmc-bds/ui/controls";
import { useEffect, useId, useState } from "react";
import type { BindGroup } from "../lib/model";
import { promptText } from "./StudioDialogs";

export function TextField({
  label,
  value,
  required,
  placeholder,
  datalist,
  onCommit,
}: {
  label: string;
  value: unknown;
  required?: boolean;
  placeholder?: string;
  /** 可选自动补全候选（原生 datalist，允许自由输入）。 */
  datalist?: string[];
  onCommit(value: unknown): void;
}) {
  const current = typeof value === "string" ? value : "";
  const [text, setText] = useState(current);
  const listId = useId();
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
      <TextInput
        value={text}
        placeholder={placeholder}
        list={datalist ? listId : undefined}
        onChange={setText}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") (event.target as HTMLInputElement).blur();
        }}
      />
      {datalist ? (
        <datalist id={listId}>
          {datalist.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      ) : null}
    </label>
  );
}

export function NumberField({
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
      <TextInput
        inputMode="decimal"
        value={text}
        onChange={setText}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") (event.target as HTMLInputElement).blur();
        }}
      />
    </label>
  );
}

export function SelectField({
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
      <Select
        label={label}
        value={current}
        options={[{ value: "", label: "（未设置）" }, ...options]}
        onChange={(next) => onCommit(next === "" ? undefined : next)}
      />
    </label>
  );
}

/** 布尔字段：三态（true/false/未设置即删除键）。 */
export function BooleanField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: unknown;
  onCommit(value: unknown): void;
}) {
  return (
    <SelectField
      label={label}
      value={value === true ? "true" : value === false ? "false" : ""}
      options={[
        { value: "true", label: "是" },
        { value: "false", label: "否" },
      ]}
      onCommit={(v) => onCommit(v === undefined ? undefined : v === "true")}
    />
  );
}

/** 复选框字段：立即提交（勾选状态即值）。 */
export function CheckField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: unknown;
  onCommit(value: unknown): void;
}) {
  return (
    <div className="insp-field insp-field-check">
      <Checkbox checked={Boolean(value)} onChange={onCommit}>
        {label}
      </Checkbox>
    </div>
  );
}

export function JsonField({
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
// 绑定路径选择器（公共 Base UI Select，按根分组；支持自定义路径）
// ---------------------------------------------------------------------------

/** 「自定义路径…」选项的哨兵值（不会与真实路径冲突）。 */
const BIND_CUSTOM = "__custom__";

export function BindField({
  label,
  value,
  groups,
  roots,
  onCommit,
}: {
  label: string;
  value: unknown;
  groups: BindGroup[];
  /** 限定候选根（如 bind 契约要求 state.*）；空表示不过滤。 */
  roots?: string[];
  onCommit(value: unknown): void;
}) {
  const current = typeof value === "string" ? value : "";
  const visible = roots
    ? groups.filter((group) => group.options.some((o) => roots.includes(o.value.split(".")[0] ?? "")))
    : groups;
  const known = visible.some((group) => group.options.some((o) => o.value === current));

  const choices: SelectOption<string>[] = [
    ...(current && !known ? [{ value: current, label: `自定义：${current}` }] : []),
    ...visible.flatMap((group) =>
      group.options.map((option) => ({
        value: option.value,
        label: option.value,
        description: [group.label, option.hint].filter(Boolean).join(" · "),
      }))
    ),
    { value: BIND_CUSTOM, label: "自定义路径…" },
  ];

  const choose = async (next: string) => {
    if (next === BIND_CUSTOM) {
      const entered = await promptText("绑定路径（如 state.keyword）", current);
      const trimmed = entered?.trim();
      if (trimmed) onCommit(trimmed);
      return;
    }
    if (next !== current) onCommit(next);
  };

  return (
    <div className="insp-field">
      <span className="insp-label">{label}</span>
      <Select
        label={label}
        value={current}
        placeholder="（未设置）"
        options={choices}
        onChange={(next) => void choose(next)}
      />
    </div>
  );
}
