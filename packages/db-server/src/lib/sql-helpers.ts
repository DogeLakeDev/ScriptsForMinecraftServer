/**
 * lib/sql-helpers.ts — SQL 语句构造辅助工具
 *
 * `sql-template-strings` 会将所有 `${}` 模板插值自动转为 `?` 参数化绑定值。
 * 数据表名、列名等受信任的标识符不能作为参数绑定，必须直接嵌入 SQL 文本中，
 * 否则会导致 `FROM ?` 语法解析错误（`near "?": syntax error`）。
 */

import { SQL, type SQLStatement } from "sql-template-strings";

/** 参数化查询对象，与 `createQuery` / `AnyQuery` 的查询输入格式完全对齐。 */
export type BoundSql = { sql: string; values: unknown[] };

/**
 * 构造安全拼接后的参数化查询结构（标识符安全嵌入文本，动态变量作为参数绑定）。
 * 表名等受信任的系统常量可直接通过模板字符串拼接，用户输入必须存入 `values` 数组中。
 *
 * @example
 * ```ts
 * sql(`SELECT * FROM ${TABLE} WHERE id = ?`, [id])
 * ```
 *
 * @param text 包含 `?` 占位符的 SQL 文本。
 * @param values 对应的参数绑定值数组。
 * @returns 构造的参数化查询结构。
 */
export function sql(text: string, values: unknown[] = []): BoundSql {
  return { sql: text, values };
}

/**
 * 将一段静态 SQL 片段包装为 `SQLStatement` 对象，专用于配合 `.append(...)` 链式拼接。
 *
 * 注意事项：
 * 切勿写成 `SQL`... FROM ${raw(table)} ...`` —— 模板插值仍会被转为 `?` 占位符。
 * 正确用法：
 * ```ts
 * SQL`SELECT * FROM `.append(raw(TABLE)).append(SQL` WHERE id = ${id}`)
 * ```
 * 推荐在日常业务中优先使用 {@link sql} 函数。
 *
 * @param text 静态 SQL 文本片段。
 * @returns 包装后的 SQLStatement 实例。
 */
export function raw(text: string): SQLStatement {
  return SQL([text]) as SQLStatement;
}

