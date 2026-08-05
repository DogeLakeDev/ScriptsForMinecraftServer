/**
 * 断言 expected 字段的类型化控件：
 * - 按 inferExpectedMeta 推断的类型渲染：string/number/boolean/vector3/enum
 * - 控件值与 expected 字符串双向同步（formatExpected / parseExpectedToControl）
 * - 控件外层包一个「或写表达式」的折叠面板（默认折叠）：
 *   作者可输入 $id.prop / @out.x 这种表达式
 *   表达式层不参与类型推断，原样写回 expected
 */

import { useEffect, useState, type ReactNode } from "react";
import { EnumSingleSelect } from "./EnumSelect";
import type { ExpectedMeta } from "./expectedMeta";
import {
  formatExpected,
  parseExpectedToControl,
} from "./expectedMeta";

function looksLikeExpr(s: string): boolean {
  return s.startsWith("$") || s.startsWith("@");
}

function ExpectedTypedControl({
  meta,
  raw,
  onChange,
  disabled,
}: {
  meta: ExpectedMeta;
  raw: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}): ReactNode {
  // 表达式（$ / @）走纯文本；不在控件里强转
  if (looksLikeExpr(raw)) {
    return (
      <input
        disabled={disabled}
        value={raw}
        placeholder='$id.prop / @lastEmit.payload.message'
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  const parsed = parseExpectedToControl(meta, raw);

  if (meta.type === "vector3") {
    const v =
      parsed.ok && parsed.value && typeof parsed.value === "object"
        ? (parsed.value as { x: number; y: number; z: number })
        : { x: 0, y: 0, z: 0 };
    return (
      <div className="vec3">
        {(["x", "y", "z"] as const).map((axis) => (
          <label key={axis} className="vec3-axis">
            <span>{axis}</span>
            <input
              type="number"
              disabled={disabled}
              value={v[axis]}
              onChange={(e) => {
                const next = { ...v, [axis]: Number(e.target.value) || 0 };
                onChange(formatExpected(meta, next));
              }}
            />
          </label>
        ))}
      </div>
    );
  }

  if (meta.type === "boolean") {
    const v = parsed.ok ? Boolean(parsed.value) : false;
    return (
      <select
        disabled={disabled}
        value={v ? "1" : "0"}
        onChange={(e) => onChange(formatExpected(meta, e.target.value === "1"))}
      >
        <option value="1">true</option>
        <option value="0">false</option>
      </select>
    );
  }

  if (meta.type === "number") {
    const v = parsed.ok ? Number(parsed.value) : 0;
    return (
      <input
        type="number"
        disabled={disabled}
        value={Number.isFinite(v) ? v : 0}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(formatExpected(meta, Number.isFinite(n) ? n : 0));
        }}
      />
    );
  }

  if (meta.type === "enum") {
    const v = parsed.ok ? String(parsed.value) : "";
    return (
      <EnumSingleSelect
        members={meta.enumValues}
        value={v}
        disabled={disabled}
        onChange={(next) => onChange(formatExpected(meta, next))}
      />
    );
  }

  // string：纯文本（fallback / 默认）
  return (
    <input
      disabled={disabled}
      value={raw}
      placeholder='字面量 / $id.prop / @lastEmit.payload.x'
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/**
 * 类型化 expected 控件 + 折叠表达式面板。
 * 控件值与 expected 字符串双向同步；展开时露出「或写表达式」文本框。
 */
export function ExpectedControl({
  meta,
  raw,
  onChange,
  disabled,
}: {
  meta: ExpectedMeta;
  raw: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}): ReactNode {
  // 表达式或空串默认展开；类型已确定时默认折叠
  const isExpr = looksLikeExpr(raw);
  const [exprOpen, setExprOpen] = useState(isExpr);
  useEffect(() => {
    // 表达式变化时自动展开，让作者看到自己写的东西
    if (isExpr) setExprOpen(true);
  }, [isExpr]);
  return (
    <div className="expected-control">
      {meta.fallback ? (
        <p className="muted meta-hint">
          拿不到 propName 类型信息，按 string 控件走；可在下方写表达式
        </p>
      ) : null}
      <ExpectedTypedControl meta={meta} raw={raw} onChange={onChange} disabled={disabled} />
      <div className="expected-control-expr">
        <button
          type="button"
          className="btn ghost compact"
          onClick={() => setExprOpen((o) => !o)}
          disabled={disabled}
        >
          {exprOpen ? "▾" : "▸"} 或写表达式
        </button>
        {exprOpen ? (
          <input
            disabled={disabled}
            value={raw}
            placeholder='$id.prop / @out.<name> / @lastEmit.payload.x'
            onChange={(e) => onChange(e.target.value)}
          />
        ) : null}
      </div>
    </div>
  );
}
