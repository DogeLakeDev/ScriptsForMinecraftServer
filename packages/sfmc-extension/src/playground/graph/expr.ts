/**
 * 轻量断言表达式（非通用脚本）。
 *
 * 语法边界：
 * - 字面量：null / true / false / 数字 / "双引号" / '单引号'；其余裸串当字符串
 * - 对象属性：$<objectId>.<prop>[.<nested>…]（objectId 允许字母数字 _ : -）
 * - 上次结果：@lastEmit[.path|.payload[.k…]|.result[.k…]]
 *             @lastCall[.id|.method|.result]
 * - 具名返回值：@out.<name>[.<prop>…]（Call 节点 outName 绑定进 ctx.out 的任意值）
 * - 不支持：运算符、函数、赋值、三元、多语句、括号运算
 */

export type ExprScene = {
  lastEmit?: {
    path?: string;
    payload?: unknown;
    result?: unknown;
    at?: number;
  } | null;
  lastCall?: {
    id?: string;
    method?: string;
    result?: unknown;
    at?: number;
  } | null;
};

export type ExprRefSnap = {
  id: string;
  kind?: string;
  props: Record<string, unknown>;
};

export type ExprContext = {
  scene: ExprScene;
  /** 已 inspect 的对象表：id → 快照 */
  refs?: Record<string, ExprRefSnap>;
  /**
   * Call 节点返回值袋（key = outName / 默认 out_<nodeId>）。可放任意对象 / 数组 / 字面量；
   * 解析 @out.<name>[.prop] 时按 props 链下钻。
   */
  out?: Record<string, unknown>;
};

export type ExprResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

const OBJ_REF = /^\$([A-Za-z0-9_:-]+)((?:\.[A-Za-z_][A-Za-z0-9_]*)+)$/;
const LAST_REF = /^@(lastEmit|lastCall)((?:\.[A-Za-z_][A-Za-z0-9_]*)*)$/;
const OUT_REF = /^@out\.([A-Za-z_][A-Za-z0-9_]*)((?:\.[A-Za-z_][A-Za-z0-9_]*)*)$/;

function parseLiteral(raw: string): unknown {
  const s = raw.trim();
  if (s === "") return "";
  if (s === "null") return null;
  if (s === "true") return true;
  if (s === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (
    (s.startsWith('"') && s.endsWith('"') && s.length >= 2) ||
    (s.startsWith("'") && s.endsWith("'") && s.length >= 2)
  ) {
    return s.slice(1, -1);
  }
  return s;
}

function dig(root: unknown, path: string[]): unknown {
  let cur: unknown = root;
  for (const key of path) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

/** 判断是否应按表达式解析（$ / @ 前缀） */
export function looksLikeExpr(raw: string): boolean {
  const s = raw.trim();
  return s.startsWith("$") || s.startsWith("@");
}

/**
 * 解析期望值：若以 $ / @ 开头则按表达式；否则整段字面量（兼容旧 expected）。
 */
export function resolveExpr(raw: string, ctx: ExprContext): ExprResult {
  const s = raw.trim();
  if (!s) return { ok: true, value: "" };

  if (s.startsWith("$")) {
    const m = OBJ_REF.exec(s);
    if (!m) {
      return {
        ok: false,
        error: `无效对象引用: ${s}（形如 $id.prop）`,
      };
    }
    const id = m[1]!;
    const path = m[2]!.slice(1).split(".");
    const snap = ctx.refs?.[id];
    if (!snap) {
      return { ok: false, error: `引用对象未加载: ${id}` };
    }
    return { ok: true, value: dig(snap.props, path) };
  }

  if (s.startsWith("@")) {
    const m = LAST_REF.exec(s);
    if (m) {
      const root = m[1]!;
      const path = m[2] ? m[2].slice(1).split(".").filter(Boolean) : [];
      const bag = root === "lastEmit" ? ctx.scene.lastEmit : ctx.scene.lastCall;
      if (bag == null) {
        return { ok: false, error: `${root} 尚无记录` };
      }
      if (path.length === 0) return { ok: true, value: bag };
      return { ok: true, value: dig(bag, path) };
    }
    const om = OUT_REF.exec(s);
    if (om) {
      const name = om[1]!;
      const path = om[2] ? om[2].slice(1).split(".").filter(Boolean) : [];
      if (!ctx.out || !(name in ctx.out)) {
        return { ok: false, error: `@out.${name} 尚无记录` };
      }
      const bag = ctx.out[name];
      if (path.length === 0) return { ok: true, value: bag };
      // 路径首项为 `props` 时剥掉，直接以 bag.props 为根；与 inspect 快照形态一致
      //（@out.entity.props.typeId ⇒ bag.props.typeId，而非 bag.props.props.typeId）
      if (bag && typeof bag === "object" && "props" in (bag as Record<string, unknown>)) {
        const root = path[0] === "props" ? (bag as { props?: unknown }).props : bag;
        return { ok: true, value: dig(root, path[0] === "props" ? path.slice(1) : path) };
      }
      return { ok: true, value: dig(bag, path) };
    }
    return {
      ok: false,
      error: `无效结果引用: ${s}（@lastEmit[.…] / @lastCall[.…] / @out.<name>[.…]）`,
    };
  }

  return { ok: true, value: parseLiteral(s) };
}

/** 收集 expected 中出现的 $id，便于运行前 inspect */
export function collectExprObjectIds(raw: string): string[] {
  const s = raw.trim();
  if (!s.startsWith("$")) return [];
  const m = OBJ_REF.exec(s);
  return m ? [m[1]!] : [];
}

/**
 * 把任意已解析值按 JS 真值约定归一为布尔（null/undefined/0/""/false → false；其余 true）。
 * Branch 节点条件 / 表达式布尔求值共用此语义，避免在两处各自实现。
 * 约定：对象带 `ok: boolean` 字段时按其值判断（AssertResult / Result-like 形态），其余对象 / 数组仍视为真。
 */
export function exprTruthy(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (value === false) return false;
  if (value === 0) return false;
  if (typeof value === "string") return value.length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "object") {
    const ok = (value as { ok?: unknown }).ok;
    if (typeof ok === "boolean") return ok;
  }
  return true;
}
