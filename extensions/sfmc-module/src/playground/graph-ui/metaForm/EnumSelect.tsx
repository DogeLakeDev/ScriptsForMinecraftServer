import { useState } from "react";
import type { ReactNode } from "react";

/** 将任意 raw 收敛为字符串（用于 select 双向绑定）。null/undefined → ""。 */
function asString(v: unknown): string {
  if (v == null) return "";
  return typeof v === "string" ? v : String(v);
}

/** 单值枚举 <select>。当前值不在成员列表时附「（自定义）」可编辑项。 */
export function EnumSingleSelect({
  members,
  value,
  onChange,
  disabled,
}: {
  members: readonly string[];
  value: unknown;
  onChange: (next: string) => void;
  disabled?: boolean;
}): ReactNode {
  const current = asString(value);
  const inList = members.includes(current);
  const [custom, setCustom] = useState(inList ? "" : current);

  // 任何时候当前值回到枚举内，则清掉「自定义」暂存
  const sanitizedCustom = inList ? "" : custom;

  const selectValue = inList ? current : "__custom__";
  return (
    <div className="enum-select-single">
      <select
        disabled={disabled}
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__custom__") {
            onChange(sanitizedCustom || current);
            return;
          }
          onChange(v);
        }}
      >
        {members.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
        <option value="__custom__">（自定义）</option>
      </select>
      {!inList && (
        <input
          className="enum-custom"
          type="text"
          disabled={disabled}
          value={sanitizedCustom}
          placeholder="自定义值"
          onChange={(e) => {
            setCustom(e.target.value);
            onChange(e.target.value);
          }}
        />
      )}
    </div>
  );
}

/** 数组 + 枚举 = 一组 checkbox。值以 string[] 形式回写。 */
export function EnumMultiSelect({
  members,
  value,
  onChange,
  disabled,
}: {
  members: readonly string[];
  value: unknown;
  onChange: (next: string[]) => void;
  disabled?: boolean;
}): ReactNode {
  const arr = Array.isArray(value) ? value.map(asString) : [];
  const set = new Set(arr);

  return (
    <div className="enum-select-multi">
      {members.map((m) => {
        const checked = set.has(m);
        return (
          <label key={m} className="enum-option">
            <input
              type="checkbox"
              disabled={disabled}
              checked={checked}
              onChange={(e) => {
                const next = new Set(set);
                if (e.target.checked) next.add(m);
                else next.delete(m);
                onChange([...next]);
              }}
            />
            <span>{m}</span>
          </label>
        );
      })}
    </div>
  );
}
