/**
 * lib/sql-helpers.ts — SQL 构造辅助
 *
 * sql-template-strings 会把每一次 ${} 插值都变成 `?` 绑定值。
 * 表名/列名等信任标识符必须嵌入 SQL 文本,不能走绑定 —— 否则会出现
 * `FROM ?` → `near "?": syntax error`(见 economy 域修复)。
 */

import { SQL, type SQLStatement } from "sql-template-strings";

/** 参数化查询信封,与 createQuery / AnyQuery 的格式 2 对齐 */
export type BoundSql = { sql: string; values: unknown[] };

/**
 * 构造「标识符已嵌入、值走 ?」的查询。
 * 表名等信任常量用模板字符串嵌入;用户输入只放进 values。
 *
 * @example
 *   sql(`SELECT * FROM ${TABLE} WHERE id = ?`, [id])
 */
export function sql(text: string, values: unknown[] = []): BoundSql {
  return { sql: text, values };
}

/**
 * 把一段静态 SQL 文本包装成 SQLStatement,仅可与 `.append(...)` 合用。
 *
 * 警告(LSP):切勿写成 `SQL\`... FROM ${raw(table)} ...\`` —— 模板插值仍会变成 `?`,
 * 与直接插值表名同病。正确用法:
 *   SQL`SELECT * FROM `.append(raw(TABLE)).append(SQL` WHERE id = ${id}`)
 * 纯字符串 `.append(TABLE)` 效果相同;优先用 {@link sql}。
 */
export function raw(text: string): SQLStatement {
  return SQL([text]) as SQLStatement;
}
