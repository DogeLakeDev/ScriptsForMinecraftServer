/**
 * where.ts — WhereExpr → SQL WHERE 子句 + 参数化 values
 *
 * 目的:模块作者写 {eq:["owner","abc"]} / {and:[...]} 这种结构化查询,
 * 平台翻译成带占位符的 SQL,杜绝 raw SQL 字符串拼接。
 *
 * 支持的算子:
 *   eq / ne / gt / gte / lt / lte / like / in / isNull / isNotNull / and / or / not
 *
 * 安全:
 *   - 列名必须匹配 /^[A-Za-z_][A-Za-z0-9_.]*$/ (允许 table.col)
 *   - 不接受字符串形式的 SQL
 *   - inList 展开成多个 ? 占位符
 */

export type Primitive = string | number | boolean | null;

export type WhereExpr =
  | { eq: [string, Primitive] }
  | { ne: [string, Primitive] }
  | { gt: [string, Primitive | number] }
  | { gte: [string, Primitive | number] }
  | { lt: [string, Primitive | number] }
  | { lte: [string, Primitive | number] }
  | { like: [string, string] }
  | { in: [string, Primitive[]] }
  | { isNull: string }
  | { isNotNull: string }
  | { and: WhereExpr[] }
  | { or: WhereExpr[] }
  | { not: WhereExpr };

export interface CompiledWhere {
  sql: string;
  values: unknown[];
}

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const IDENT_DOT = /^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$/;

function q(col: string): string {
  if (!IDENT.test(col) && !IDENT_DOT.test(col)) {
    throw new Error(`[where] invalid column name: ${JSON.stringify(col)}`);
  }
  // table.col → "table"."col"
  if (col.includes(".")) {
    const [t, c] = col.split(".");
    return `"${t}"."${c}"`;
  }
  return `"${col}"`;
}

function isPrimitive(v: unknown): v is Primitive {
  return typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v === null;
}

export function compile(expr: WhereExpr | undefined): CompiledWhere {
  if (!expr) return { sql: "1=1", values: [] };
  return compileOne(expr);
}

function compileOne(e: WhereExpr): CompiledWhere {
  if ("and" in e) {
    if (!Array.isArray(e.and) || e.and.length === 0) return { sql: "1=1", values: [] };
    const parts = e.and.map(compileOne);
    return {
      sql: "(" + parts.map((p) => p.sql).join(" AND ") + ")",
      values: parts.flatMap((p) => p.values),
    };
  }
  if ("or" in e) {
    if (!Array.isArray(e.or) || e.or.length === 0) return { sql: "1=0", values: [] };
    const parts = e.or.map(compileOne);
    return {
      sql: "(" + parts.map((p) => p.sql).join(" OR ") + ")",
      values: parts.flatMap((p) => p.values),
    };
  }
  if ("not" in e) {
    const inner = compileOne(e.not);
    return { sql: "NOT (" + inner.sql + ")", values: inner.values };
  }
  if ("isNull" in e) {
    return { sql: `${q(e.isNull)} IS NULL`, values: [] };
  }
  if ("isNotNull" in e) {
    return { sql: `${q(e.isNotNull)} IS NOT NULL`, values: [] };
  }
  if ("eq" in e) {
    if (!isPrimitive(e.eq[1])) throw new Error("[where] eq value must be primitive");
    return { sql: `${q(e.eq[0])} = ?`, values: [e.eq[1]] };
  }
  if ("ne" in e) {
    if (!isPrimitive(e.ne[1])) throw new Error("[where] ne value must be primitive");
    return { sql: `${q(e.ne[0])} <> ?`, values: [e.ne[1]] };
  }
  if ("gt" in e) return numeric(q(e.gt[0]), ">", e.gt[1]);
  if ("gte" in e) return numeric(q(e.gte[0]), ">=", e.gte[1]);
  if ("lt" in e) return numeric(q(e.lt[0]), "<", e.lt[1]);
  if ("lte" in e) return numeric(q(e.lte[0]), "<=", e.lte[1]);
  if ("like" in e) {
    if (typeof e.like[1] !== "string") throw new Error("[where] like value must be string");
    return { sql: `${q(e.like[0])} LIKE ?`, values: [e.like[1]] };
  }
  if ("in" in e) {
    if (!Array.isArray(e.in[1]) || e.in[1].length === 0) {
      throw new Error("[where] in requires non-empty array");
    }
    for (const v of e.in[1]) {
      if (!isPrimitive(v)) throw new Error("[where] in values must be primitive");
    }
    const placeholders = e.in[1].map(() => "?").join(",");
    return { sql: `${q(e.in[0])} IN (${placeholders})`, values: [...e.in[1]] };
  }
  throw new Error("[where] unknown operator");
}

function numeric(col: string, op: string, v: Primitive | number): CompiledWhere {
  if (typeof v === "string" || typeof v === "boolean" || v === null) {
    throw new Error(`[where] ${op} expects number, got ${typeof v}`);
  }
  return { sql: `${col} ${op} ?`, values: [v] };
}
