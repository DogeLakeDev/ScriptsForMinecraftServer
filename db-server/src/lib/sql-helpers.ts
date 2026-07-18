/**
 * lib/sql-helpers.ts — sql-template-strings 缺失的工具函数
 *
 * 该库没有暴露 raw(...) / join(...) 这类便捷函数。抽出一个轻量封装。
 */

import { SQL, type SQLStatement } from "sql-template-strings";

/**
 * 把一段静态 SQL 文本包装成 SQLStatement，使其可以嵌入其它 SQL 模板。
 * - 不携带任何占位符 / values；
 * - 与 SQL\`...\` 一起使用时行为一致：`append()` 调用会把字符串合并进 strings 数组。
 *
 * 实现注意：sql-template-strings 的 SQL 函数对 strings array 长度 = 1 + values 长度
 * 的情况友好处理 —— 我们传入 `["text"]` 单元素数组，得到一个无占位符、无参数的
 * SQLStatement，正好等价于把 `text` 整段直接插入。
 */
export function raw(text: string): SQLStatement {
  return SQL([text]) as SQLStatement;
}

