/**
 * 轻量断言表达式（非通用脚本）。
 *
 * 语法边界：
 * - 字面量：null / true / false / 数字 / "双引号" / '单引号'；其余裸串当字符串
 * - 对象属性：$<objectId>.<prop>[.<nested>…]（objectId 允许字母数字 _ : -）
 * - 上次结果：@lastEmit[.path|.payload[.k…]|.result[.k…]]
 *             @lastCall[.id|.method|.result]
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
};

export type ExprResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

const OBJ_REF = /^\$([A-Za-z0-9_:-]+)((?:\.[A-Za-z_][A-Za-z0-9_]*)+)$/;
const LAST_REF = /^@(lastEmit|lastCall)((?:\.[A-Za-z_][A-Za-z0-9_]*)*)$/;

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
    if (!m) {
      return {
        ok: false,
        error: `无效结果引用: ${s}（@lastEmit[.…] / @lastCall[.…]）`,
      };
    }
    const root = m[1]!;
    const path = m[2] ? m[2].slice(1).split(".").filter(Boolean) : [];
    const bag = root === "lastEmit" ? ctx.scene.lastEmit : ctx.scene.lastCall;
    if (bag == null) {
      return { ok: false, error: `${root} 尚无记录` };
    }
    if (path.length === 0) return { ok: true, value: bag };
    return { ok: true, value: dig(bag, path) };
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
