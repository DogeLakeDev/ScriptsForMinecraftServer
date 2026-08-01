/**
 * 期望值输入（$id.prop / @out.x / @lastEmit / 字面量）。
 *
 * - 失焦时调用 parseExpr(value, ctx) 做软校验；失败：字段红边 + 下方一行红字提示
 * - 成功：下方一行灰字显示解析结果（类型简述），风格与 inspect 摘要一致
 * - 已知 @out.<name> / @scene.* 提供 datalist 自动补全（轻量，datalist 而非 popup）
 * - 文本框右侧「+」按钮展开「插入变量」菜单，点选把 token 插到当前光标位置
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { parseExpr, valueAsString, type AssertEvalContext } from "../../graph/assert";
import type { PlaygroundMeta, SceneSummary } from "./metaForm";
import { buildInsertMenu } from "./insertMenu";

export type ExprFieldContext = {
  /** 表达式求值所需的最小字段；logBuffer / target 在 parseExpr 里无需时忽略 */
  scene: SceneSummary | null;
  /** 已 inspect 的对象表（$id.prop 求值用） */
  refs?: Record<string, { id: string; kind?: string; props: Record<string, unknown> }>;
  /** Call 节点 out 袋（@out.<name> 求值用） */
  out?: Record<string, unknown>;
  /** PLAYGROUND_META：仅用于场景对象 @scene.* 的补全提示 */
  meta?: PlaygroundMeta | null;
};

export type ExprFieldProps = {
  value: string;
  onChange: (next: string) => void;
  context: ExprFieldContext;
  /** input placeholder（如「字面量 / $id.prop / @lastEmit.payload.x」） */
  placeholder?: string;
  /** 失焦时才校验；默认 true（避免每次按键重渲整图） */
  validateOnBlur?: boolean;
  /** 显示行（默认 1）；期望值为长 JSON 时可改大 */
  rows?: number;
};

/** 缩略展示一段解析结果；UI 用，不进求值 */
function previewValue(v: unknown): string {
  const s = valueAsString(v);
  if (!s) return "（空）";
  // 截断过长 JSON / 字符串
  return s.length > 96 ? `${s.slice(0, 95)}…` : s;
}

/** 给表达式归一个简短类型标签 */
function valueKind(v: unknown): string {
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  const t = typeof v;
  if (t === "string") return `string ${previewValue(v)}`;
  if (t === "number") return `${t === "number" ? "number" : t} ${String(v)}`;
  if (t === "boolean") return `boolean ${String(v)}`;
  if (Array.isArray(v)) return `Array(${v.length})`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    // Vector3 风格
    if (
      typeof o.x === "number" &&
      typeof o.y === "number" &&
      typeof o.z === "number" &&
      Object.keys(o).length <= 4
    ) {
      return `Vector3 {x:${o.x},y:${o.y},z:${o.z}}`;
    }
    const kind = (o as { kind?: unknown }).kind;
    if (typeof kind === "string") {
      return `${kind} ${previewValue(o)}`;
    }
    return `object ${previewValue(v)}`;
  }
  return String(v);
}

/** 收集 `@out.<name>` / `@scene.<x>` 自动补全候选（datalist） */
function collectSuggestions(ctx: ExprFieldContext): string[] {
  const out: string[] = [];
  // @out.<name>：Call 节点的具名返回
  if (ctx.out) {
    for (const k of Object.keys(ctx.out)) {
      out.push(`@out.${k}`);
    }
  }
  // @scene.*：当前场景对象的 id / dimensionId / typeId 前缀
  const scene = ctx.scene;
  if (scene) {
    if (scene.world) out.push(`@scene.world`);
    if (scene.scoreboard) out.push(`@scene.scoreboard`);
    for (const d of scene.dimensions ?? []) {
      if (d.dimensionId) out.push(`@scene.${d.dimensionId}`);
    }
    for (const p of scene.players ?? []) {
      if (p.name) out.push(`@scene.${p.name}`);
    }
    for (const e of scene.entities ?? []) {
      if (e.typeId) out.push(`@scene.${e.typeId}`);
    }
    for (const i of scene.items ?? []) {
      if (i.typeId) out.push(`@scene.${i.typeId}`);
    }
  }
  return out;
}

export function ExprField({
  value,
  onChange,
  context,
  placeholder,
  validateOnBlur = true,
  rows = 1,
}: ExprFieldProps) {
  const id = useId();
  const datalistId = `${id}-expr-dl`;
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<unknown | null>(null);

  // 解析用 ctx：把 ExprFieldContext 转成 AssertEvalContext（多余字段由 parseExpr 忽略）
  const evalCtx: AssertEvalContext = useMemo(
    () => ({
      logs: [],
      scene: {
        lastEmit: context.scene?.lastEmit ?? null,
        lastCall: context.scene?.lastCall ?? null,
        world: context.scene?.world,
        scoreboard: context.scene?.scoreboard,
        dimensions: context.scene?.dimensions,
        players: context.scene?.players,
        entities: context.scene?.entities,
        items: context.scene?.items,
        blocks: context.scene?.blocks,
      },
      refs: context.refs,
      out: context.out,
    }),
    [context]
  );

  const suggestions = useMemo(() => collectSuggestions(context), [context]);

  const runValidate = () => {
    if (!validateOnBlur) return;
    if (!value || !value.trim()) {
      setError(null);
      setResolved(null);
      return;
    }
    const r = parseExpr(value, evalCtx);
    if (r.ok) {
      setError(null);
      setResolved(r.value);
    } else {
      setError(r.error);
      setResolved(null);
    }
  };

  const onBlur = () => runValidate();

  const onFocus = () => {
    // 聚焦时不强制清掉预览；保留以便作者回到字段时看到上次结果
  };

  // 实时输入：只在用户修改时不报错（避免每次按键红闪）；失焦再统一提示
  const onInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange(e.target.value);
    if (error) {
      setError(null);
      setResolved(null);
    }
  };

  // 「插入变量」菜单
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const menuWrapRef = useRef<HTMLDivElement | null>(null);

  const menuSections = useMemo(() => buildInsertMenu(context), [context]);
  const menuItemCount = menuSections.reduce((n, s) => n + s.items.length, 0);

  // 点 / 选菜单项 → 在光标位置插入 token，关闭弹层并聚焦回文本框
  const insertAtCursor = (token: string) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? (value ?? "").length;
    const end = el?.selectionEnd ?? start;
    const cur = value ?? "";
    const next = cur.slice(0, start) + token + cur.slice(end);
    onChange(next);
    setMenuOpen(false);
    // 下一帧恢复焦点 + 把光标停在 token 末尾
    requestAnimationFrame(() => {
      const e2 = inputRef.current;
      if (!e2) return;
      e2.focus();
      const pos = start + token.length;
      try {
        e2.setSelectionRange(pos, pos);
      } catch {
        /* selectionRange 在某些 input type 上受限，忽略 */
      }
    });
    // 输入被覆盖 → 失焦后下一次再校验，避免菜单点击导致错闪红边
    setError(null);
    setResolved(null);
  };

  // 点选之外（弹层 / 文档其他位置）点击 → 关闭
  useEffect(() => {
    if (!menuOpen) return;
    const onDocDown = (e: MouseEvent) => {
      const w = menuWrapRef.current;
      if (!w) return;
      if (e.target instanceof Node && w.contains(e.target)) return;
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [menuOpen]);

  const inputStyle = error
    ? { borderColor: "var(--vscode-inputValidation-errorBorder, #f14c4c)" }
    : undefined;

  // 菜单项渲染：label + 可选预览（hover title）；禁用项做灰白 + 不响应点击
  const renderItems = (
    items: { insert: string; label: string; preview?: string; disabled?: boolean }[]
  ) =>
    items.map((it) => (
      <button
        key={it.insert}
        type="button"
        className="expr-insert-item"
        disabled={it.disabled}
        title={it.preview}
        onMouseDown={(e) => {
          // 用 mousedown 抢在 input blur 之前触发，避免点选瞬间 close 后失焦校验把已修改的值认作错
          e.preventDefault();
          if (it.disabled) return;
          insertAtCursor(it.insert);
        }}
      >
        <span className="expr-insert-label">{it.label}</span>
        {it.preview ? <span className="expr-insert-preview">{it.preview}</span> : null}
      </button>
    ));

  return (
    <div className="field">
      {placeholder ? <label>期望值</label> : null}
      <div className="expr-row" ref={menuWrapRef}>
        {rows > 1 ? (
          <textarea
            rows={rows}
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={value ?? ""}
            placeholder={placeholder}
            list={suggestions.length ? datalistId : undefined}
            onChange={onInput}
            onBlur={onBlur}
            onFocus={onFocus}
            style={inputStyle}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            value={value ?? ""}
            placeholder={placeholder}
            list={suggestions.length ? datalistId : undefined}
            onChange={onInput}
            onBlur={onBlur}
            onFocus={onFocus}
            style={inputStyle}
          />
        )}
        <button
          type="button"
          className="expr-insert-btn"
          aria-label="插入变量"
          title="插入变量"
          disabled={menuItemCount === 0}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? "▴" : "+"}
        </button>
        {menuOpen ? (
          <div className="expr-insert-menu" role="menu">
            {menuSections.map((sec) => (
              <div key={sec.title} className="expr-insert-section">
                <div className="rdx-label">{sec.title}</div>
                {sec.items.length ? (
                  renderItems(sec.items)
                ) : (
                  <p className="muted expr-insert-empty">（当前无可用变量）</p>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {suggestions.length ? (
        <datalist id={datalistId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      ) : null}
      {error ? (
        <p className="expr-field-msg expr-field-error" role="alert">
          {error}
        </p>
      ) : resolved != null ? (
        <p className="expr-field-msg expr-field-ok" title={previewValue(resolved)}>
          解析为: {valueKind(resolved)}
        </p>
      ) : null}
    </div>
  );
}