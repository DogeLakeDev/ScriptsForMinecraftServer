import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync, StatementSync } from "node:sqlite";
import type { SQLStatement } from "sql-template-strings";

export type QueryFn = (
  sql: string | SQLStatement | { sql: string; values?: unknown[] },
  values?: unknown[]
) => unknown[] | { changes: number | bigint };

/**
 * 统一 SQL 查询接口 — 支持三种调用格式：
 *   1. query("SELECT * FROM t WHERE id=?", [1])
 *   2. query({ sql: "SELECT * FROM t WHERE id=?", values: [1] })
 *   3. query(SQL`SELECT * FROM t WHERE id=${1}`)   ← sql-template-strings
 */
export function createQuery(db: DatabaseSync, maxStatements: number = 200): QueryFn {
  const stmts = new Map<string, StatementSync>();

  function getStmt(sql: string): StatementSync {
    let s = stmts.get(sql);
    if (!s) {
      s = db.prepare(sql);
      if (stmts.size >= maxStatements) {
        const first = stmts.keys().next().value;
        if (first !== undefined) stmts.delete(first);
      }
      stmts.set(sql, s);
    }
    return s;
  }

  function runQuery(sql: string, values: unknown[]): any[] | { changes: number | bigint } {
    const s = getStmt(sql);
    const upper = sql.trim().toUpperCase();
    const needsRows =
      upper.startsWith("SELECT") ||
      upper.startsWith("WITH") ||
      upper.startsWith("PRAGMA") ||
      /\bRETURNING\b/.test(upper);
    const bind = values as any[];
    if (needsRows) return s.all(...bind);
    const r = s.run(...bind);
    return { changes: r.changes };
  }

  return function query(raw: string | { sql: string; values?: unknown[] }, maybeValues?: unknown[]): any[] | { changes: number | bigint } {
    // 格式 1：string + values
    if (typeof raw === "string") {
      return runQuery(raw, maybeValues ?? []);
    }
    // 格式 2 / 3：{ sql, values } 或 sql-template-strings 对象
    const o = raw as { sql: string; values?: unknown[] };
    return runQuery(o.sql, o.values ?? []);
  };
}

/**
 * 打开 SQLite 数据库（同步模式），启用外键、WAL、busy_timeout
 */
export function openDatabase(filePath: string): DatabaseSync {
  mkdirSync(dirname(filePath), { recursive: true });
  const db = new DatabaseSync(filePath);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  return db;
}
