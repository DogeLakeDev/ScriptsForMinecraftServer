/**
 * types.ts — db 子路径的共享类型
 *
 * 设计原则:
 * - 模块作者**不写 SQL**。所有查询通过 WhereExpr 表达式树,平台翻译成 SQL。
 * - 字段名 = 表的列名(由 defineTable 注册);表达式是白名单的 eq/gt/lt/like/and/or/not,
 *   避免 SQL 注入。
 * - tx() 内部用 step 数组而不是闭包执行,这样 SAPI 进程崩溃 db-server 也能回滚。
 */

/** SQLite 列类型白名单。 */
export type ColumnType = "TEXT" | "INTEGER" | "REAL" | "BLOB";

/** 表列定义（由 `defineTable` 注册）。 */
export interface ColumnDef {
  /** 列类型。 */
  type: ColumnType;
  /** 是否主键。 */
  primary?: boolean;
  /** 是否 NOT NULL。 */
  notNull?: boolean;
  /** 默认值（字符串或数字字面量）。 */
  default?: string | number;
  /** 是否建索引。 */
  index?: boolean;
  /** 是否 UNIQUE。 */
  unique?: boolean;
}

/** WHERE 表达式可用的原始值类型。 */
export type Primitive = string | number | bigint | boolean | null;

/** 白名单 WHERE 表达式树（平台翻译为 SQL，禁止手写 SQL）。 */
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

/** 排序字段与方向。 */
export type OrderBy = { field: string; dir?: "asc" | "desc" };

/** 查询选项（WHERE / ORDER BY / 分页）。 */
export interface QueryOptions {
  /** 过滤条件。 */
  where?: WhereExpr;
  /** 排序；可传单条或数组。 */
  orderBy?: OrderBy | OrderBy[];
  /** 返回行数上限。 */
  limit?: number;
  /** 跳过行数（配合 limit）。 */
  offset?: number;
}

/** 插入成功响应。 */
export interface InsertResult {
  ok: true;
  /** 插入后的完整行。 */
  row: Record<string, unknown>;
}

/** 更新成功响应。 */
export interface UpdateResult {
  ok: true;
  /** 更新后的完整行。 */
  row: Record<string, unknown>;
}

/** 删除成功响应。 */
export interface DeleteResult {
  ok: true;
  /** 被删行主键。 */
  id: Primitive;
}

/* ── 事务 ─────────────────────────────────────────────────────── */

/** 批量事务单步操作（也用于交互式 tx step）。 */
export type TxStep =
  | { op: "query"; table: string; opts?: QueryOptions }
  | { op: "get"; table: string; id: Primitive }
  | { op: "insert"; table: string; row: Record<string, unknown> }
  | { op: "update"; table: string; id: Primitive; patch: Record<string, unknown> }
  | { op: "delete"; table: string; id: Primitive; hard?: boolean }
  | { op: "audit"; table: string; rowId: Primitive; action: string; data?: Record<string, unknown> }
  | { op: "service"; name: string; input: Record<string, unknown> };

/** 单步事务执行结果。 */
export interface TxStepResult {
  /** 对应操作类型。 */
  op: TxStep["op"];
  /** query 返回的多行。 */
  rows?: Record<string, unknown>[];
  /** get/insert/update 返回的单行。 */
  row?: Record<string, unknown>;
  /** delete 返回的主键。 */
  id?: Primitive;
  /** 受影响行数。 */
  changes?: number;
  /** service 调用的返回值。 */
  result?: unknown;
}

/** 批量事务成功响应。 */
export interface TxResponse {
  ok: true;
  /** 与 db-server TxResponse.results 对齐(LSP);勿再命名为 steps */
  results: TxStepResult[];
}

/** 事务失败响应。 */
export interface TxError {
  ok: false;
  /** 失败步骤索引。 */
  step: number;
  /** 错误信息。 */
  error: string;
  /** 错误码。 */
  code: "tx_aborted" | "permission_denied" | "table_not_found" | "service_not_found" | "invalid_input";
}

/* ── define-table 协议 ─────────────────────────────────────────── */

/** `defineTable` 请求体。 */
export interface DefineTableRequest {
  /** 模块 id。 */
  moduleId: string;
  /** 逻辑表名。 */
  name: string;
  /** 列定义。 */
  columns: Record<string, ColumnDef>;
  /** 是否启用软删除；默认 true。 */
  softDelete?: boolean;
}

/** `defineTable` 成功响应。 */
export interface DefineTableResponse {
  ok: true;
  /** 物理表名（含模块前缀）。 */
  table: string;
}
