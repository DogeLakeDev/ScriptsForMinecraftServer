/**
 * types.ts — db 子路径的共享类型
 *
 * 设计原则:
 * - 模块作者**不写 SQL**。所有查询通过 WhereExpr 表达式树,平台翻译成 SQL。
 * - 字段名 = 表的列名(由 defineTable 注册);表达式是白名单的 eq/gt/lt/like/and/or/not,
 *   避免 SQL 注入。
 * - tx() 内部用 step 数组而不是闭包执行,这样 SAPI 进程崩溃 db-server 也能回滚。
 */

export type ColumnType = "TEXT" | "INTEGER" | "REAL" | "BLOB";

export interface ColumnDef {
  type: ColumnType;
  primary?: boolean;
  notNull?: boolean;
  default?: string | number;
  index?: boolean;
  unique?: boolean;
}

export type Primitive = string | number | bigint | boolean | null;

export type WhereExpr =
  | { eq: [field: string, value: Primitive] }
  | { ne: [field: string, value: Primitive] }
  | { gt: [field: string, value: Primitive] }
  | { gte: [field: string, value: Primitive] }
  | { lt: [field: string, value: Primitive] }
  | { lte: [field: string, value: Primitive] }
  | { like: [field: string, pattern: string] }
  | { in: [field: string, values: Primitive[]] }
  | { isNull: [field: string] }
  | { isNotNull: [field: string] }
  | { and: WhereExpr[] }
  | { or: WhereExpr[] }
  | { not: WhereExpr };

export type OrderBy = { field: string; dir?: "asc" | "desc" };

export interface QueryOptions {
  where?: WhereExpr;
  orderBy?: OrderBy | OrderBy[];
  limit?: number;
  offset?: number;
}

export interface InsertResult {
  ok: true;
  row: Record<string, unknown>;
}

export interface UpdateResult {
  ok: true;
  row: Record<string, unknown>;
}

export interface DeleteResult {
  ok: true;
  id: Primitive;
}

/* ── 事务 ─────────────────────────────────────────────────────── */

export type TxStep =
  | { op: "query"; table: string; opts?: QueryOptions }
  | { op: "get"; table: string; id: Primitive }
  | { op: "insert"; table: string; row: Record<string, unknown> }
  | { op: "update"; table: string; id: Primitive; patch: Record<string, unknown> }
  | { op: "delete"; table: string; id: Primitive; hard?: boolean }
  | { op: "audit"; table: string; rowId: Primitive; action: string; data?: Record<string, unknown> }
  | { op: "service"; name: string; input: Record<string, unknown> };

export interface TxStepResult {
  op: TxStep["op"];
  rows?: Record<string, unknown>[];
  row?: Record<string, unknown>;
  id?: Primitive;
  result?: unknown;
}

export interface TxResponse {
  ok: true;
  /** 与 db-server TxResponse.results 对齐(LSP);勿再命名为 steps */
  results: TxStepResult[];
}

export interface TxError {
  ok: false;
  step: number;
  error: string;
  code: "tx_aborted" | "permission_denied" | "table_not_found" | "service_not_found" | "invalid_input";
}

/* ── define-table 协议 ─────────────────────────────────────────── */

export interface DefineTableRequest {
  moduleId: string;
  name: string;
  columns: Record<string, ColumnDef>;
  softDelete?: boolean;
}

export interface DefineTableResponse {
  ok: true;
  table: string;
}
